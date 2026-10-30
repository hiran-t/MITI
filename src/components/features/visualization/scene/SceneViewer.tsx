'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import * as THREE from 'three';
import WidgetSettingsPortal from '../../layout/WidgetSettingsPortal';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import { findTopicType } from '@/lib/bridge/topics';
import { useTF } from '@/hooks/useTF';
import { lookupTransform } from '@/lib/scene/transforms';
import {
  autoFixedFrame,
  defaultTopicVisible,
  normalizeSceneConfig,
  topicLayerType,
} from '@/lib/scene/scene-config';
import {
  LAYER_TYPES,
  type LayerStatus,
  type LayerType,
  type SceneLayerConfig,
} from '@/types/scene';
import {
  DEFAULT_URDF_OPTIONS,
  type PublishType,
  type SceneConfig,
  type ViewSettings,
} from '@/types/scene-config';
import { visualizationStyles } from '@/styles';
import SceneCanvas, { type RenderStats } from './SceneCanvas';
import SceneLayer, { type LayerInfo } from './SceneLayer';
import RobotLayer from './RobotLayer';
import GridLayer from './GridLayer';
import PublishTool, { type PublishTarget } from './PublishTool';
import TFVisualizer from '../tf/TFVisualizer';
import { SceneDisplayContext, type SceneDisplay } from './SceneContext';
import SceneSettings, { defaultLayerSize, type TopicRow } from './SceneSettings';

const IDENTITY = new THREE.Matrix4();

const PUBLISH_TOOLS: Record<PublishType, { label: string; icon: typeof MapPin; hint: string }> = {
  point: { label: 'Publish point', icon: MapPin, hint: 'Click to publish a point' },
  pose: {
    label: 'Publish pose',
    icon: Navigation,
    hint: 'Drag toward the heading to publish a pose',
  },
  pose_estimate: {
    label: 'Publish pose estimate',
    icon: LocateFixed,
    hint: 'Drag toward the heading to publish a pose estimate',
  },
};

function stamp() {
  const ms = Date.now();
  return { sec: Math.floor(ms / 1000), nanosec: (ms % 1000) * 1e6 };
}

/** The 3D Scene panel: a Foxglove-style scene with its settings in the sidebar. */
export default function SceneViewer({
  client,
  topics = [],
  props,
  onPropsChange,
}: {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  /** Stored widget props; older layouts are migrated on read. */
  props: unknown;
  onPropsChange: (config: SceneConfig) => void;
}) {
  const config = useMemo(() => normalizeSceneConfig(props), [props]);
  const { frame, scene, transforms, publish } = config;
  const [statuses, setStatuses] = useState<Record<string, LayerStatus>>({});
  const [seenFrames, setSeenFrames] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [stats, setStats] = useState<RenderStats | null>(null);
  const [meshEpoch, setMeshEpoch] = useState(0);
  const reloadRobots = async () => {
    await client?.clearAssetCache();
    setMeshEpoch((epoch) => epoch + 1);
  };

  const { tfTree } = useTF({
    client,
    tfTopics: transforms.tfTopics,
    staticTopics: transforms.staticTfTopics,
  });

  const reportStatus = useCallback(
    (id: string, status: LayerStatus) =>
      setStatuses((previous) =>
        previous[id]?.level === status.level && previous[id]?.message === status.message
          ? previous
          : { ...previous, [id]: status }
      ),
    []
  );
  const [layerInfo, setLayerInfo] = useState<Record<string, LayerInfo>>({});
  const reportInfo = useCallback(
    (id: string, info: LayerInfo) =>
      setLayerInfo((previous) => ({ ...previous, [id]: { ...previous[id], ...info } })),
    []
  );
  const reportFrame = useCallback(
    (frameId: string) =>
      setSeenFrames((previous) => (previous.includes(frameId) ? previous : [...previous, frameId])),
    []
  );

  // ── Frames ──
  const { frames, roots } = useMemo(() => {
    const names = new Set<string>();
    const parents = new Set<string>();
    tfTree.frames.forEach((info) => {
      names.add(info.name);
      if (info.parent) parents.add(info.parent);
    });
    const roots = Array.from(parents).filter((parent) => !names.has(parent));
    return {
      frames: Array.from(new Set(Array.from(names).concat(Array.from(parents)))).sort(),
      roots,
    };
  }, [tfTree]);
  const fixedFrame = frame.fixedFrame || autoFixedFrame(roots, frames, seenFrames) || 'base_link';
  const displayFrame = frame.displayFrame || fixedFrame;

  const follow = useMemo(() => {
    if (frame.followMode === 'fixed' || displayFrame === fixedFrame) return IDENTITY;
    try {
      const pose = lookupTransform(tfTree, fixedFrame, displayFrame);
      return frame.followMode === 'position'
        ? new THREE.Matrix4().makeTranslation(
            new THREE.Vector3().setFromMatrixPosition(pose).negate()
          )
        : pose.clone().invert();
    } catch {
      return IDENTITY;
    }
  }, [tfTree, fixedFrame, displayFrame, frame.followMode]);

  const frameMatrix = (name: string) => {
    try {
      return lookupTransform(tfTree, fixedFrame, name);
    } catch {
      return IDENTITY;
    }
  };

  // ── Topics the scene can show, from the live list and from saved settings ──
  const topicRows = useMemo<TopicRow[]>(() => {
    const rows = new Map<string, TopicRow>();
    const add = (topic: string, messageType: string, published: boolean) => {
      const type = topicLayerType(topic, messageType) ?? config.topics[topic]?.type;
      if (!type || rows.has(topic)) return;
      const settings = config.topics[topic] ?? {};
      rows.set(topic, {
        topic,
        type,
        messageType,
        settings,
        visible: settings.visible ?? defaultTopicVisible(type),
        published,
      });
    };
    topics.forEach((info) => add(info.topic, info.type, true));
    Object.entries(config.topics).forEach(([topic, settings]) => {
      if (!settings.type) return;
      const messageType =
        settings.type === 'urdf' ? 'std_msgs/msg/String' : LAYER_TYPES[settings.type].message;
      add(topic, messageType, false);
    });
    return Array.from(rows.values()).sort((a, b) => a.topic.localeCompare(b.topic));
  }, [topics, config.topics]);

  const sceneLayer = (row: TopicRow): SceneLayerConfig => {
    const imageType = row.settings.imageTopic
      ? findTopicType(topics, row.settings.imageTopic)
      : undefined;
    return {
      // Point and map display settings pass through unchanged.
      ...row.settings,
      id: `topic:${row.topic}`,
      type: row.type as LayerType,
      topic: row.topic,
      enabled: row.visible,
      color: row.settings.color,
      opacity: row.settings.opacity,
      size: row.settings.size ?? defaultLayerSize(row.type),
      maxPoints: row.settings.maxPoints,
      imageTopic: row.settings.imageTopic,
      imageMode: imageType?.endsWith('CompressedImage') ? 'compressed' : 'raw',
      staleAfter: row.settings.staleAfter,
      maxRate: row.settings.maxRate,
    };
  };

  // ── Publishing ──
  const advertised = useRef(new Set<string>());
  useEffect(() => {
    advertised.current = new Set();
  }, [client]);
  const send = (topic: string, type: string, message: unknown) => {
    if (!client) return;
    if (!advertised.current.has(`${topic}|${type}`)) {
      client.advertise(topic, type);
      advertised.current.add(`${topic}|${type}`);
    }
    client.publish(topic, message);
  };
  const handlePublish = ({ x, y, yaw = 0 }: PublishTarget) => {
    const header = { frame_id: fixedFrame, stamp: stamp() };
    const pose = {
      position: { x, y, z: 0 },
      orientation: { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) },
    };
    if (publish.type === 'point')
      send(publish.pointTopic, 'geometry_msgs/msg/PointStamped', {
        header,
        point: { x, y, z: 0 },
      });
    else if (publish.type === 'pose')
      send(publish.poseTopic, 'geometry_msgs/msg/PoseStamped', { header, pose });
    else {
      const covariance = new Array(36).fill(0);
      covariance[0] = publish.poseEstimateXDeviation ** 2;
      covariance[7] = publish.poseEstimateYDeviation ** 2;
      covariance[35] = publish.poseEstimateThetaDeviation ** 2;
      send(publish.poseEstimateTopic, 'geometry_msgs/msg/PoseWithCovarianceStamped', {
        header,
        pose: { pose, covariance },
      });
    }
    setPublishing(false);
  };
  useEffect(() => {
    if (!publishing) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setPublishing(false);
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, [publishing]);

  const display = useMemo<SceneDisplay>(
    () => ({
      labelScale: scene.labelScale,
      mesh: { ignoreColladaUpAxis: scene.ignoreColladaUpAxis, meshUpAxis: scene.meshUpAxis },
      fetchAsset: client?.hasCapability('assets')
        ? (uri: string) => client.fetchAsset(uri)
        : undefined,
    }),
    [scene.labelScale, scene.ignoreColladaUpAxis, scene.meshUpAxis, client]
  );
  const onViewChange = useCallback(
    (view: ViewSettings) => onPropsChange({ ...config, view }),
    [config, onPropsChange]
  );

  const visibleLayerIds = new Set([
    ...topicRows.filter((row) => row.visible).map((row) => `topic:${row.topic}`),
    ...config.layers.filter((layer) => layer.visible).map((layer) => `layer:${layer.id}`),
  ]);
  const problems = Object.entries(statuses).filter(
    ([id, status]) => visibleLayerIds.has(id) && status.level === 'error'
  );
  const tool = PUBLISH_TOOLS[publish.type];
  const ToolIcon = tool.icon;

  return (
    <div className={visualizationStyles.urdfViewer.container}>
      <SceneCanvas
        background={scene.background}
        view={config.view}
        onViewChange={onViewChange}
        follow={follow}
        controlsEnabled={!publishing}
        onStats={scene.renderStats ? setStats : undefined}
      >
        <SceneDisplayContext.Provider value={display}>
          {config.layers.map((layer) =>
            !layer.visible ? null : layer.type === 'grid' ? (
              <GridLayer
                key={layer.id}
                layer={layer}
                frame={frameMatrix(layer.frameId || displayFrame)}
              />
            ) : (
              <RobotLayer
                key={layer.id}
                id={`layer:${layer.id}`}
                label={layer.label}
                visible={layer.visible}
                source={layer}
                options={layer}
                client={client}
                tree={tfTree}
                fixedFrame={fixedFrame}
                onStatus={reportStatus}
                onInfo={reportInfo}
                reloadKey={meshEpoch}
              />
            )
          )}
          {topicRows.map((row) =>
            row.type === 'urdf' ? (
              <RobotLayer
                key={row.topic}
                id={`topic:${row.topic}`}
                label={row.topic}
                visible={row.visible}
                source={{ source: 'topic', topic: row.topic, url: '', filePath: '', parameter: '' }}
                options={{ ...DEFAULT_URDF_OPTIONS, ...row.settings }}
                client={client}
                tree={tfTree}
                fixedFrame={fixedFrame}
                onStatus={reportStatus}
                onInfo={reportInfo}
                reloadKey={meshEpoch}
                unlisted={!row.published && topics.length > 0}
              />
            ) : row.visible ? (
              <SceneLayer
                key={row.topic}
                layer={sceneLayer(row)}
                client={client}
                tree={tfTree}
                fixedFrame={fixedFrame}
                sync={frame.syncTimestamps}
                onStatus={reportStatus}
                topics={topics}
                onFrame={reportFrame}
                onInfo={reportInfo}
              />
            ) : null
          )}
          {transforms.visible && (
            <TFVisualizer
              tfTree={tfTree}
              fixedFrame={fixedFrame}
              settings={transforms}
              labelScale={scene.labelScale}
            />
          )}
          {publishing && <PublishTool type={publish.type} onPublish={handlePublish} />}
        </SceneDisplayContext.Provider>
      </SceneCanvas>

      <div className="scene-toolbar">
        <button
          type="button"
          className={`scene-tool ${publishing ? 'active' : ''}`}
          aria-label={tool.label}
          aria-pressed={publishing}
          title={client ? tool.label : 'Connect to ROS to publish'}
          disabled={!client}
          onClick={() => setPublishing(!publishing)}
        >
          <ToolIcon size={15} />
        </button>
      </div>
      {publishing && <div className="scene-tool-hint">{tool.hint} · Esc to cancel</div>}

      {scene.renderStats && stats && (
        <div className="scene-stats">
          {stats.fps} fps · {stats.calls} draw calls · {stats.triangles.toLocaleString()} tris
        </div>
      )}

      <div className="scene-status-overlay">
        <span>
          {client ? 'ROS connected' : 'ROS disconnected'} · Fixed frame: {fixedFrame}
          {displayFrame !== fixedFrame && ` · Display: ${displayFrame}`}
        </span>
        {problems.map(([id, status]) => (
          <span key={id} className="text-danger">
            {id.replace(/^(topic|layer):/, '')}: {status.message}
          </span>
        ))}
      </div>

      <WidgetSettingsPortal>
        <SceneSettings
          config={config}
          onChange={onPropsChange}
          topics={topics}
          topicRows={topicRows}
          frames={frames}
          tree={tfTree}
          fixedFrame={fixedFrame}
          displayFrame={displayFrame}
          statuses={statuses}
          layerInfo={layerInfo}
          onReloadRobots={reloadRobots}
        />
      </WidgetSettingsPortal>
    </div>
  );
}
