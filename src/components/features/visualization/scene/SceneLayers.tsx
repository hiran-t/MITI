'use client';
import { useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import { findTopicType } from '@/lib/bridge/topics';
import { lookupTransform } from '@/lib/scene/transforms';
import { defaultTopicVisible, topicLayerType } from '@/lib/scene/scene-config';
import {
  LAYER_TYPES,
  type LayerStatus,
  type LayerType,
  type SceneLayerConfig,
} from '@/types/scene';
import {
  DEFAULT_URDF_OPTIONS,
  type CustomLayerConfig,
  type TopicLayerType,
  type TopicSettings,
  type TransformSettings,
} from '@/types/scene-config';
import type { TFTree } from '@/types/tf-messages';
import SceneLayer, { type LayerInfo } from './SceneLayer';
import RobotLayer from './RobotLayer';
import GridLayer from './GridLayer';
import TFVisualizer from '../tf/TFVisualizer';
import { SceneDisplayContext, type SceneDisplay } from './SceneContext';
import { defaultLayerSize, type TopicRow } from './SceneSettings';

/**
 * What the 3D Scene and the Image panel share: the topic rows they can show, the layers that
 * draw them, and the status each layer reports for the settings and the status overlay.
 */

const IDENTITY = new THREE.Matrix4();

/** Layer statuses, layer info and the frames of incoming messages, by layer id. */
export function useLayerReports() {
  const [statuses, setStatuses] = useState<Record<string, LayerStatus>>({});
  const [layerInfo, setLayerInfo] = useState<Record<string, LayerInfo>>({});
  const [seenFrames, setSeenFrames] = useState<string[]>([]);
  const reportStatus = useCallback(
    (id: string, status: LayerStatus) =>
      setStatuses((previous) =>
        previous[id]?.level === status.level && previous[id]?.message === status.message
          ? previous
          : { ...previous, [id]: status }
      ),
    []
  );
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
  return { statuses, reportStatus, layerInfo, reportInfo, seenFrames, reportFrame };
}

/** Every frame in the TF tree, sorted, and the roots (parents that have no parent). */
export function useTFFrames(tfTree: TFTree) {
  return useMemo(() => {
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
}

/** Topics a scene can show, from the live list and from saved settings. */
export function useTopicRows(
  topics: TopicInfo[],
  settings: Record<string, TopicSettings>,
  {
    defaultVisible = defaultTopicVisible,
    exclude,
  }: {
    defaultVisible?: (type: TopicLayerType) => boolean;
    /** Kinds this panel does not draw. */
    exclude?: TopicLayerType[];
  } = {}
): TopicRow[] {
  const excludeKey = exclude?.join(',') ?? '';
  return useMemo(() => {
    const excluded = excludeKey.split(',');
    const rows = new Map<string, TopicRow>();
    const add = (topic: string, messageType: string, published: boolean) => {
      const type = topicLayerType(topic, messageType) ?? settings[topic]?.type;
      if (!type || excluded.includes(type) || rows.has(topic)) return;
      const stored = settings[topic] ?? {};
      rows.set(topic, {
        topic,
        type,
        messageType,
        settings: stored,
        visible: stored.visible ?? defaultVisible(type),
        published,
      });
    };
    topics.forEach((info) => add(info.topic, info.type, true));
    Object.entries(settings).forEach(([topic, stored]) => {
      if (!stored.type) return;
      const messageType =
        stored.type === 'urdf' ? 'std_msgs/msg/String' : LAYER_TYPES[stored.type].message;
      add(topic, messageType, false);
    });
    return Array.from(rows.values()).sort((a, b) => a.topic.localeCompare(b.topic));
  }, [topics, settings, defaultVisible, excludeKey]);
}

/** The scene layer config a topic row renders with. */
export function sceneLayerConfig(row: TopicRow, topics: TopicInfo[]): SceneLayerConfig {
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
}

/** Error statuses of the layers that are shown, for the status overlay. */
export function visibleProblems(
  statuses: Record<string, LayerStatus>,
  topicRows: TopicRow[],
  layers: CustomLayerConfig[] = []
) {
  const visible = new Set([
    ...topicRows.filter((row) => row.visible).map((row) => `topic:${row.topic}`),
    ...layers.filter((layer) => layer.visible).map((layer) => `layer:${layer.id}`),
  ]);
  return Object.entries(statuses).filter(
    ([id, status]) => visible.has(id) && status.level === 'error'
  );
}

/**
 * Custom layers, topic layers and TF frames in the fixed frame. Rendered inside a three.js canvas;
 * reports each layer's status through the callbacks.
 */
export default function SceneLayers({
  client,
  topics,
  topicRows,
  layers = [],
  tfTree,
  fixedFrame,
  displayFrame = fixedFrame,
  sync,
  transforms,
  scene,
  meshEpoch = 0,
  onStatus,
  onInfo,
  onFrame,
}: {
  client: BridgeClient | null;
  topics: TopicInfo[];
  topicRows: TopicRow[];
  layers?: CustomLayerConfig[];
  tfTree: TFTree;
  fixedFrame: string;
  /** Frame grids without their own frame follow. */
  displayFrame?: string;
  /** Place messages with TF at their own stamps. */
  sync: boolean;
  transforms: TransformSettings;
  scene: { labelScale: number; ignoreColladaUpAxis: boolean; meshUpAxis: 'y_up' | 'z_up' };
  /** Bumped to load robot models again. */
  meshEpoch?: number;
  onStatus: (id: string, status: LayerStatus) => void;
  onInfo: (id: string, info: LayerInfo) => void;
  onFrame?: (frameId: string) => void;
}) {
  const { labelScale, ignoreColladaUpAxis, meshUpAxis } = scene;
  const display = useMemo<SceneDisplay>(
    () => ({
      labelScale,
      mesh: { ignoreColladaUpAxis, meshUpAxis },
      fetchAsset: client?.hasCapability('assets')
        ? (uri: string) => client.fetchAsset(uri)
        : undefined,
    }),
    [labelScale, ignoreColladaUpAxis, meshUpAxis, client]
  );
  const frameMatrix = (name: string) => {
    try {
      return lookupTransform(tfTree, fixedFrame, name);
    } catch {
      return IDENTITY;
    }
  };

  return (
    <SceneDisplayContext.Provider value={display}>
      {layers.map((layer) =>
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
            onStatus={onStatus}
            onInfo={onInfo}
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
            onStatus={onStatus}
            onInfo={onInfo}
            reloadKey={meshEpoch}
            unlisted={!row.published && topics.length > 0}
          />
        ) : row.visible ? (
          <SceneLayer
            key={row.topic}
            layer={sceneLayerConfig(row, topics)}
            client={client}
            tree={tfTree}
            fixedFrame={fixedFrame}
            sync={sync}
            onStatus={onStatus}
            topics={topics}
            onFrame={onFrame}
            onInfo={onInfo}
          />
        ) : null
      )}
      {transforms.visible && (
        <TFVisualizer
          tfTree={tfTree}
          fixedFrame={fixedFrame}
          settings={transforms}
          labelScale={labelScale}
        />
      )}
    </SceneDisplayContext.Provider>
  );
}
