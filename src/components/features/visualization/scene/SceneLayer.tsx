'use client';
import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useTopic } from '@/hooks/useTopic';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import { topicTypeMismatch } from '@/lib/bridge/topics';
import { parsePointCloud2 } from '@/lib/parsers/pointcloud-parser';
import {
  laserPoints,
  messageTransform,
  occupancyPixels,
  poseMatrix,
  updateMarkers,
  xyz,
  type StoredMarker,
} from '@/lib/scene/geometry';
import {
  LAYER_TYPES,
  type SceneLayerConfig,
  type Header,
  type Pose,
  type Marker,
  type LayerStatus,
} from '@/types/scene';
import type { sensor_msgs } from '@/types/ros-messages';
import type { TFTree } from '@/types/tf-messages';
import { Cloud, PoseArrow, MapPlane } from './Primitives';
import MarkerShape from './MarkerShape';
import CameraLayer, { cameraCorners, type CameraInfo } from './CameraLayer';

class LayerBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void; resetKey: unknown },
  { failed: boolean; resetKey: unknown }
> {
  state = { failed: false, resetKey: undefined as unknown };
  static getDerivedStateFromProps(props: { resetKey: unknown }, state: { resetKey: unknown }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const EMPTY_PACKAGES: Record<string, string> = {};
const EMPTY_TOPICS: TopicInfo[] = [];
// Sensor streams can exceed what the main thread can parse and render; ~10 Hz with the newest
// message winning keeps the scene live. Markers must not be dropped.
const HEAVY_TOPIC = { throttleRate: 100 };
export default function SceneLayer({
  layer,
  client,
  tree,
  fixedFrame,
  sync,
  onStatus,
  meshBaseUrl = '',
  packages = EMPTY_PACKAGES,
  topics = EMPTY_TOPICS,
  onFrame,
}: {
  layer: SceneLayerConfig;
  client: BridgeClient | null;
  tree: TFTree;
  fixedFrame: string;
  sync: boolean;
  onStatus: (id: string, status: LayerStatus) => void;
  meshBaseUrl?: string;
  packages?: Record<string, string>;
  topics?: TopicInfo[];
  /** Reports the frame_id of incoming messages, e.g. to choose a fixed frame without TF. */
  onFrame?: (frameId: string) => void;
}) {
  const { data, lastUpdate } = useTopic<unknown>(
    layer.enabled ? client : null,
    layer.topic,
    LAYER_TYPES[layer.type]?.message,
    {
      ...(['pointcloud', 'scan'].includes(layer.type) ? HEAVY_TOPIC : {}),
      maxRate: layer.maxRate || undefined,
    }
  );
  const actualType = topicTypeMismatch(topics, layer.topic, LAYER_TYPES[layer.type]?.message);
  const frameId = (data as { header?: Header } | null)?.header?.frame_id;
  useEffect(() => {
    if (frameId) onFrame?.(frameId);
  }, [frameId, onFrame]);
  const [now, setNow] = useState(Date.now);
  const [markers, setMarkers] = useState(new Map<string, StoredMarker>());
  const [renderError, setRenderError] = useState('');
  const onError = useCallback((message: string) => setRenderError(message), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setRenderError('');
  }, [data, layer]);
  useEffect(() => {
    setMarkers(new Map());
  }, [layer.topic, layer.type, layer.enabled, client]);
  useEffect(() => {
    setMarkers(
      (previous) =>
        new Map(Array.from(previous, ([key, entry]) => [key, { ...entry, matrix: undefined }]))
    );
  }, [fixedFrame, sync]);
  useEffect(() => {
    if (!layer.enabled || !client || !['marker', 'markers'].includes(layer.type) || !layer.topic)
      return;
    const callback = (message: unknown) => {
      try {
        const incoming =
          layer.type === 'marker'
            ? [message as Marker]
            : (message as { markers: Marker[] }).markers;
        if (!Array.isArray(incoming)) throw new Error('Invalid MarkerArray');
        if (
          incoming.some(
            (marker) =>
              !marker ||
              typeof marker.ns !== 'string' ||
              !Number.isFinite(marker.id) ||
              ![0, 2, 3].includes(marker.action)
          )
        )
          throw new Error('Invalid marker identity or action');
        setMarkers((previous) => updateMarkers(previous, incoming, Date.now()));
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Invalid markers');
      }
    };
    client.subscribe(layer.topic, callback, LAYER_TYPES[layer.type].message);
    return () => client.unsubscribe(layer.topic, callback);
  }, [client, layer.topic, layer.type, layer.enabled, onError]);
  // Freeze non-frame-locked markers at their initial transform, even when timestamps are zero.
  useEffect(() => {
    let changed = false;
    const next = new Map(markers);
    next.forEach((entry, key) => {
      if (!entry.matrix && !entry.marker.frame_locked) {
        try {
          next.set(key, {
            ...entry,
            matrix: messageTransform(tree, fixedFrame, entry.marker.header, sync),
          });
          changed = true;
        } catch {
          /* Reported by renderer until transform arrives. */
        }
      }
    });
    if (changed) setMarkers(next);
  }, [tree, markers, fixedFrame, sync]);
  const decoded = useMemo(() => {
    try {
      if (!data) return { error: '' };
      const max = Math.max(1, Math.min(layer.maxPoints ?? 100000, 1000000));
      if (layer.type === 'pointcloud') {
        const points = parsePointCloud2(data as sensor_msgs.PointCloud2, max);
        return {
          error: '',
          positions: points.flatMap((p) => [p.x, p.y, p.z]),
          colors: points.some((p) => p.r !== undefined)
            ? points.flatMap((p) => [p.r ?? 1, p.g ?? 1, p.b ?? 1])
            : undefined,
        };
      }
      if (layer.type === 'scan')
        return {
          error: '',
          positions: laserPoints(data as Parameters<typeof laserPoints>[0], max),
        };
      if (layer.type === 'map') {
        const msg = data as { info: { width: number; height: number }; data: number[] | string };
        return { error: '', pixels: occupancyPixels(msg.info.width, msg.info.height, msg.data) };
      }
      return { error: '' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid message' };
    }
  }, [data, layer.type, layer.maxPoints]);
  const prepared = useMemo(() => {
    if (!layer.enabled || !client || !data) return { node: null, error: '', empty: false };
    const color = layer.color ?? '#a78bfa',
      opacity = layer.opacity ?? 1,
      size = layer.size ?? 0.04,
      max = Math.max(1, Math.min(layer.maxPoints ?? 100000, 1000000));
    try {
      if (decoded.error) throw new Error(decoded.error);
      if (layer.type === 'marker' || layer.type === 'markers') {
        const active = Array.from(markers.values()).filter((entry) => entry.expires > now);
        if (active.length > 5000) throw new Error('Marker layer exceeds 5,000 entities');
        const errors: string[] = [];
        const children = active.map(({ marker, matrix }, index) => {
          try {
            if (!Number.isInteger(marker.type) || marker.type < 0 || marker.type > 12)
              throw new Error(`Unsupported marker type ${marker.type}`);
            const transform =
              matrix ??
              messageTransform(tree, fixedFrame, marker.header, marker.frame_locked ? false : sync);
            xyz(marker.scale);
            poseMatrix(marker.pose);
            if ((marker.points?.length ?? 0) > max)
              throw new Error(`Marker exceeds ${max} points; raise point limit`);
            return (
              <group
                key={`${marker.ns}/${marker.id}`}
                matrix={transform.clone().multiply(poseMatrix(marker.pose))}
                matrixAutoUpdate={false}
              >
                <MarkerShape
                  marker={marker}
                  opacity={opacity}
                  baseUrl={meshBaseUrl}
                  packages={packages}
                  onError={onError}
                />
              </group>
            );
          } catch (e) {
            errors.push(`Marker ${index}: ${e instanceof Error ? e.message : 'invalid'}`);
            return null;
          }
        });
        return { node: <>{children}</>, error: errors[0] ?? '', empty: active.length === 0 };
      }
      const header = (data as { header: Header }).header;
      const matrix = messageTransform(tree, fixedFrame, header, sync);
      let child: ReactNode = null,
        empty = false;
      switch (layer.type) {
        case 'pointcloud':
        case 'scan': {
          const positions = decoded.positions ?? [];
          empty = !positions.length;
          child = (
            <Cloud
              positions={positions}
              colors={decoded.colors}
              size={size}
              color={color}
              opacity={opacity}
            />
          );
          break;
        }
        case 'map': {
          const msg = data as {
            info: { width: number; height: number; resolution: number; origin: Pose };
            data: number[] | string;
          };
          const { width, height, resolution, origin } = msg.info;
          if (!Number.isFinite(resolution) || resolution <= 0)
            throw new Error('Invalid map resolution');
          child = (
            <MapPlane
              pixels={decoded.pixels!}
              width={width}
              height={height}
              resolution={resolution}
              matrix={poseMatrix(origin)}
              opacity={opacity}
            />
          );
          break;
        }
        case 'path': {
          const poses = (data as { poses: { header: Header; pose: Pose }[] }).poses;
          if (!Array.isArray(poses)) throw new Error('Invalid Path');
          if (poses.length > max) throw new Error(`Path exceeds ${max} poses`);
          const points = poses.map((p) => {
            const local = p.header?.frame_id
              ? messageTransform(tree, fixedFrame, p.header, sync)
              : matrix;
            return new THREE.Vector3(...xyz(p.pose.position)).applyMatrix4(local);
          });
          empty = !points.length;
          return {
            node:
              points.length > 1 ? (
                <Line
                  points={points}
                  color={color}
                  lineWidth={Math.max(1, size * 100)}
                  transparent
                  opacity={opacity}
                />
              ) : null,
            error: '',
            empty,
          };
        }
        case 'pose':
        case 'poses':
        case 'odometry': {
          const poses =
            layer.type === 'poses'
              ? (data as { poses: Pose[] }).poses
              : layer.type === 'odometry'
                ? [(data as { pose: { pose: Pose } }).pose.pose]
                : [(data as { pose: Pose }).pose];
          if (!Array.isArray(poses)) throw new Error('Invalid poses');
          if (poses.length > max) throw new Error(`Pose array exceeds ${max} poses`);
          poses.forEach(poseMatrix);
          empty = !poses.length;
          child = (
            <>
              {poses.map((pose, i) => (
                <PoseArrow
                  key={i}
                  pose={pose}
                  size={layer.size ?? 0.5}
                  color={color}
                  opacity={opacity}
                />
              ))}
            </>
          );
          break;
        }
        case 'camera': {
          cameraCorners(data as CameraInfo, layer.size ?? 1);
          child = (
            <CameraLayer
              info={data as CameraInfo}
              layer={layer}
              client={client}
              onError={onError}
            />
          );
          break;
        }
      }
      return {
        node: (
          <group matrix={matrix} matrixAutoUpdate={false}>
            {child}
          </group>
        ),
        error: '',
        empty,
      };
    } catch (error) {
      return {
        node: null,
        error: error instanceof Error ? error.message : 'Invalid message',
        empty: false,
      };
    }
  }, [
    decoded,
    data,
    layer,
    client,
    tree,
    fixedFrame,
    sync,
    markers,
    now,
    meshBaseUrl,
    packages,
    onError,
  ]);
  useEffect(() => {
    const error = prepared.error || renderError;
    let status: LayerStatus;
    if (!layer.enabled) status = { level: 'off', message: 'Hidden' };
    else if (!client) status = { level: 'waiting', message: 'Disconnected' };
    else if (!layer.topic) status = { level: 'waiting', message: 'Choose a topic' };
    else if (error) status = { level: 'error', message: error };
    // A topic of another type is never subscribed, so explain why no data arrives.
    else if (!data && actualType)
      status = {
        level: 'error',
        message: `${layer.topic} publishes ${actualType}; this layer shows ${LAYER_TYPES[layer.type].message}`,
      };
    else if (!data) status = { level: 'waiting', message: 'Waiting for message' };
    else if (prepared.empty) status = { level: 'waiting', message: 'Empty data' };
    else if (
      layer.type !== 'map' &&
      layer.type !== 'marker' &&
      layer.type !== 'markers' &&
      lastUpdate &&
      now - lastUpdate.getTime() > (layer.staleAfter ?? 5) * 1000
    )
      status = { level: 'stale', message: 'Stale · no recent message' };
    else status = { level: 'ok', message: 'Receiving' };
    onStatus(layer.id, status);
  }, [
    layer,
    client,
    data,
    lastUpdate,
    now,
    prepared.error,
    prepared.empty,
    renderError,
    actualType,
    onStatus,
  ]);
  return (
    <LayerBoundary resetKey={data} onError={onError}>
      {prepared.node}
    </LayerBoundary>
  );
}
