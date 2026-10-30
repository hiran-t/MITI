'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import URDFLoader, { type URDFRobot } from 'urdf-loader';
import type { BridgeClient } from '@/lib/bridge/client';
import { useTopic } from '@/hooks/useTopic';
import { resolveResourceUrl, resourceBase } from '@/lib/scene/resources';
import { parseParameterName } from '@/lib/scene/scene-config';
import { placeLinks } from '@/lib/scene/robot-placement';
import { disposeObject, loadMeshResource, meshErrorMessage } from '@/lib/scene/mesh-loader';
import type { TFTree } from '@/types/tf-messages';
import type { LayerStatus } from '@/types/scene';
import type { UrdfOptions, UrdfSource } from '@/types/scene-config';
import type { sensor_msgs } from '@/types/ros-messages';
import { useSceneDisplay } from './SceneContext';
import type { JointInfo, LayerInfo } from './SceneLayer';

export interface RobotSource {
  source: UrdfSource;
  topic: string;
  url: string;
  filePath: string;
  parameter: string;
}

const COLLISION_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.45,
});

async function fetchText(url: string, label: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`cannot fetch ${label}; check the address and CORS headers`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/** Fetches the robot description from the configured source. */
function useRobotDescription(source: RobotSource, client: BridgeClient | null, enabled: boolean) {
  const { data } = useTopic<{ data: string }>(
    enabled && source.source === 'topic' ? client : null,
    source.topic,
    'std_msgs/msg/String'
  );
  const [fetched, setFetched] = useState<{ urdf: string | null; error: string }>({
    urdf: null,
    error: '',
  });
  const location =
    source.source === 'url'
      ? source.url.trim()
      : source.source === 'filePath'
        ? source.filePath.trim()
        : source.source === 'parameter'
          ? source.parameter.trim()
          : '';

  useEffect(() => {
    setFetched({ urdf: null, error: '' });
    if (!enabled || !location || source.source === 'topic') return;
    if (source.source === 'parameter' && !client) return;
    let live = true;
    const load = async (): Promise<string> => {
      if (source.source === 'parameter') {
        if (!parseParameterName(location))
          throw new Error('Use /node.parameter, e.g. /robot_state_publisher.robot_description');
        const value = await client!.getParameter(location);
        if (typeof value !== 'string' || !value)
          throw new Error(`${location} is empty or not a string`);
        return value;
      }
      if (source.source === 'filePath') {
        const uri = location.startsWith('/') ? `file://${location}` : location;
        // foxglove_bridge reads the file on the robot; MITI's server is the fallback.
        if (client?.hasCapability('assets'))
          return new TextDecoder().decode(await client.fetchAsset(uri));
        return fetchText(resolveResourceUrl(uri), location);
      }
      return fetchText(location, location);
    };
    // Wait for typing to pause so every keystroke of a URL or path is not fetched.
    const timer = setTimeout(
      () =>
        load()
          .then((urdf) => live && setFetched({ urdf, error: '' }))
          .catch(
            (error) =>
              live &&
              setFetched({
                urdf: null,
                error: `${location}: ${error instanceof Error ? error.message : 'request failed'}`,
              })
          ),
      source.source === 'parameter' ? 0 : 500
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [enabled, location, source.source, client]);

  if (source.source === 'topic') return { urdf: data?.data ?? null, error: '' };
  return fetched;
}

export default function RobotLayer({
  id,
  label,
  visible,
  source,
  options,
  client,
  tree,
  fixedFrame,
  onStatus,
  unlisted = false,
  reloadKey = 0,
  onInfo,
}: {
  id: string;
  label: string;
  visible: boolean;
  source: RobotSource;
  options: UrdfOptions;
  client: BridgeClient | null;
  tree: TFTree;
  fixedFrame: string;
  onStatus: (id: string, status: LayerStatus) => void;
  /** foxglove_bridge does not advertise the topic source, so waiting will not help. */
  unlisted?: boolean;
  /** Changing it reloads the model, e.g. after the mesh cache was cleared. */
  reloadKey?: number;
  /** Reports the model's joints (with positions, twice a second) and links for the settings. */
  onInfo?: (id: string, info: LayerInfo) => void;
}) {
  const display = useSceneDisplay();
  const { urdf, error: sourceError } = useRobotDescription(source, client, visible);
  const manual = options.controlMode === 'manual';
  const { data: jointStates } = useTopic<sensor_msgs.JointState>(
    visible && !manual ? client : null,
    options.jointStatesTopic,
    'sensor_msgs/msg/JointState'
  );
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [parseError, setParseError] = useState('');
  const [meshErrors, setMeshErrors] = useState<string[]>([]);
  const [placement, setPlacement] = useState({ rootMissing: false, missingLinks: 0 });
  // Meshes arrive one by one; styling is applied again as each lands.
  const [meshVersion, setMeshVersion] = useState(0);
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const colorRef = useRef(options.color);
  colorRef.current = options.color;
  const { meshBaseUrl, packageMapping, displayMode } = options;
  const { ignoreColladaUpAxis, meshUpAxis } = display.mesh;
  const { fetchAsset } = display;
  const workingPath =
    source.source === 'url'
      ? resourceBase(source.url)
      : source.source === 'filePath'
        ? resourceBase(source.filePath)
        : '';

  useEffect(() => {
    setRobot(null);
    setParseError('');
    setMeshErrors([]);
    if (!urdf || !visible) return;
    let live = true;
    let model: URDFRobot | null = null;
    const loader = new URDFLoader();
    loader.parseVisual = displayMode !== 'collision';
    loader.parseCollision = displayMode !== 'visual';
    loader.workingPath = workingPath;
    // Keep package:// intact; loadMeshResource resolves it through the bridge or MITI's server.
    loader.packages = (pkg: string) => `package://${pkg}`;
    loader.loadMeshCb = (path, _manager, done) => {
      loadMeshResource(
        path,
        { meshBaseUrl, packageMapping, fetchAsset },
        { ignoreColladaUpAxis, meshUpAxis }
      )
        .then((mesh) => {
          if (!live) return disposeObject(mesh);
          if (colorRef.current) applyColor(mesh, colorRef.current);
          done(mesh);
          setMeshVersion((version) => version + 1);
        })
        .catch((error) => {
          if (live) setMeshErrors((errors) => [...errors, meshErrorMessage(path, error)]);
          done(new THREE.Group());
        });
    };
    try {
      model = loader.parse(urdf);
      setRobot(model);
    } catch (error) {
      setParseError(`Invalid URDF: ${error instanceof Error ? error.message : 'parse failed'}`);
    }
    return () => {
      live = false;
      if (model) disposeObject(model);
    };
  }, [
    urdf,
    visible,
    displayMode,
    workingPath,
    meshBaseUrl,
    packageMapping,
    ignoreColladaUpAxis,
    meshUpAxis,
    fetchAsset,
    reloadKey,
  ]);

  useEffect(() => {
    if (robot && options.color) applyColor(robot, options.color);
  }, [robot, options.color]);

  const {
    opacity = 1,
    showOutlines = false,
    showAxis = false,
    axisScale = 1,
    hiddenLinks = NO_LINKS,
    manualJoints = NO_JOINTS,
  } = options;
  useEffect(() => {
    if (robot)
      styleRobot(robot, { opacity, showOutlines, showAxis, axisScale, hiddenLinks, displayMode });
  }, [
    robot,
    meshVersion,
    options.color,
    opacity,
    showOutlines,
    showAxis,
    axisScale,
    hiddenLinks,
    displayMode,
  ]);

  useEffect(() => {
    if (robot && manual) robot.setJointValues(manualJoints);
  }, [robot, manual, manualJoints]);

  // Joints and links for the settings; positions are refreshed at a readable rate.
  useEffect(() => {
    if (!robot || !onInfo) return;
    onInfo(id, { joints: jointInfo(robot), links: Object.keys(robot.links).sort() });
    let last = '';
    const timer = setInterval(() => {
      const joints = jointInfo(robot);
      const key = joints.map((joint) => joint.value.toFixed(3)).join(',');
      if (key !== last) {
        last = key;
        onInfo(id, { joints });
      }
    }, 500);
    return () => clearInterval(timer);
  }, [robot, id, onInfo]);

  useEffect(() => {
    if (!robot || manual || !jointStates?.name) return;
    const values: Record<string, number> = {};
    jointStates.name.forEach((name, index) => {
      const position = jointStates.position?.[index];
      if (Number.isFinite(position)) values[name] = position;
    });
    robot.setJointValues(values);
  }, [robot, manual, jointStates]);

  // Follow TF every frame; report placement problems at most when they change.
  const lastPlacement = useRef('');
  useFrame(() => {
    if (!robot) return;
    const result = placeLinks(robot, treeRef.current, fixedFrame, options.framePrefix, !manual);
    const key = `${result.rootMissing}:${result.missingLinks}`;
    if (key !== lastPlacement.current) {
      lastPlacement.current = key;
      setPlacement(result);
    }
  });

  const linkCount = useMemo(() => (robot ? Object.keys(robot.links).length : 0), [robot]);
  useEffect(() => {
    let status: LayerStatus;
    if (!visible) status = { level: 'off', message: 'Hidden' };
    else if (sourceError) status = { level: 'error', message: sourceError };
    else if (parseError) status = { level: 'error', message: parseError };
    else if (!urdf)
      status =
        source.source === 'topic'
          ? {
              level: 'waiting',
              message: !client
                ? 'Disconnected'
                : unlisted
                  ? `${source.topic} is not published (foxglove_bridge does not advertise it). Check that robot_state_publisher is running and the topic name, or use a URDF layer with the Parameter source.`
                  : `Waiting for ${source.topic}. It is published once (latched); if it never arrives, use a URDF layer with the Parameter source.`,
            }
          : { level: 'waiting', message: `Loading ${label}` };
    else if (meshErrors.length)
      status = {
        level: 'error',
        message: `${meshErrors.length} mesh${meshErrors.length > 1 ? 'es' : ''} failed. ${meshErrors[0]}`,
      };
    else if (placement.rootMissing)
      status = {
        level: 'ok',
        message: `No transform from ${fixedFrame} to ${options.framePrefix}${robot?.urdfName}; drawn at the ${fixedFrame} origin`,
      };
    else
      status = {
        level: 'ok',
        message:
          placement.missingLinks > 0
            ? `${linkCount} links · ${placement.missingLinks} posed from joint states (no TF)`
            : `${linkCount} links`,
      };
    onStatus(id, status);
  }, [
    id,
    visible,
    sourceError,
    parseError,
    urdf,
    meshErrors,
    placement,
    linkCount,
    fixedFrame,
    options.framePrefix,
    robot,
    source.source,
    source.topic,
    label,
    client,
    unlisted,
    onStatus,
  ]);

  return robot && visible ? <primitive object={robot} /> : null;
}

const NO_LINKS: string[] = [];
const NO_JOINTS: Record<string, number> = {};
const HELPER = '__miti_helper';
const OUTLINE_MATERIAL = new THREE.LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.6,
});
const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();

type UrdfNode = THREE.Object3D & {
  isURDFLink?: boolean;
  isURDFVisual?: boolean;
  isURDFCollider?: boolean;
  urdfName?: string;
};

function jointInfo(robot: URDFRobot): JointInfo[] {
  return Object.values(robot.joints)
    .filter((joint) => joint.jointType !== 'fixed')
    .map((joint) => {
      const bounded = joint.jointType !== 'continuous' && joint.limit.lower < joint.limit.upper;
      return {
        name: joint.urdfName,
        type: joint.jointType,
        lower: bounded ? joint.limit.lower : -Math.PI,
        upper: bounded ? joint.limit.upper : Math.PI,
        value: Number(joint.angle) || 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Foxglove's robot display options: per-link visibility, opacity, mesh outlines and link axes.
 * Idempotent, so it can run again whenever a mesh loads or an option changes.
 */
function styleRobot(
  robot: URDFRobot,
  options: {
    opacity: number;
    showOutlines: boolean;
    showAxis: boolean;
    axisScale: number;
    hiddenLinks: string[];
    displayMode: UrdfOptions['displayMode'];
  }
) {
  const helpers: THREE.Object3D[] = [];
  robot.traverse((child) => child.name === HELPER && helpers.push(child));
  helpers.forEach((helper) => {
    helper.removeFromParent();
    if (helper instanceof THREE.AxesHelper) helper.dispose();
  });

  const hidden = new Set(options.hiddenLinks);
  const meshes: THREE.Mesh[] = [];
  robot.traverse((child) => {
    const link = child as UrdfNode;
    if (!link.isURDFLink) return;
    const show = !hidden.has(link.urdfName ?? '');
    const parts = link.children as UrdfNode[];
    const hasVisual = parts.some((part) => part.isURDFVisual);
    parts.forEach((part) => {
      if (part.isURDFVisual) part.visible = show;
      if (part.isURDFCollider) {
        part.visible =
          show &&
          (options.displayMode === 'collision' || (options.displayMode === 'auto' && !hasVisual));
        part.traverse((mesh) => {
          if (mesh instanceof THREE.Mesh) mesh.material = COLLISION_MATERIAL;
        });
      }
      if (part.isURDFVisual)
        part.traverse((mesh) => mesh instanceof THREE.Mesh && meshes.push(mesh));
    });
    if (options.showAxis && show) {
      const axes = new THREE.AxesHelper(0.15 * options.axisScale);
      axes.name = HELPER;
      link.add(axes);
    }
  });

  for (const mesh of meshes) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.userData.baseOpacity ??= material.opacity;
      material.userData.baseTransparent ??= material.transparent;
      const transparent = material.userData.baseTransparent || options.opacity < 1;
      if (material.transparent !== transparent) material.needsUpdate = true;
      material.transparent = transparent;
      material.opacity = material.userData.baseOpacity * options.opacity;
      material.depthWrite = options.opacity >= 1;
    }
    if (options.showOutlines) {
      let edges = edgeCache.get(mesh.geometry);
      if (!edges) {
        edges = new THREE.EdgesGeometry(mesh.geometry, 40);
        edgeCache.set(mesh.geometry, edges);
      }
      const outline = new THREE.LineSegments(edges, OUTLINE_MATERIAL);
      outline.name = HELPER;
      outline.raycast = () => {};
      mesh.add(outline);
    }
  }
}

function applyColor(object: THREE.Object3D, color: string) {
  object.traverse((child) => {
    const collider = (child as THREE.Object3D & { isURDFCollider?: boolean }).isURDFCollider;
    if (child instanceof THREE.Mesh && !collider && child.material !== COLLISION_MATERIAL)
      child.material = new THREE.MeshStandardMaterial({ color });
  });
}
