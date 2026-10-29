import { LAYER_TYPES, type LayerType, type SceneLayerConfig } from '@/types/scene';
import {
  DEFAULT_SCENE_CONFIG,
  DEFAULT_URDF_OPTIONS,
  newGridLayer,
  newUrdfLayer,
  type CustomLayerConfig,
  type SceneConfig,
  type TopicLayerType,
  type TopicSettings,
} from '@/types/scene-config';
import { normalizeMessageType } from '@/lib/bridge/topics';

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const pick = <T>(value: unknown, fallback: T): T =>
  value !== undefined && typeof value === typeof fallback ? (value as T) : fallback;

/** The kind of scene layer that renders `topic`, or undefined when the scene cannot show it. */
export function topicLayerType(topic: string, messageType: string): TopicLayerType | undefined {
  const type = normalizeMessageType(messageType);
  if (type === 'std_msgs/String') return /robot_description$/.test(topic) ? 'urdf' : undefined;
  return (Object.keys(LAYER_TYPES) as LayerType[]).find(
    (layer) => normalizeMessageType(LAYER_TYPES[layer].message) === type
  );
}

/** Robot descriptions show up as soon as they are published; sensor streams are opt-in. */
export const defaultTopicVisible = (type: TopicLayerType | undefined) => type === 'urdf';

/** Fill missing settings with defaults so older or partial configs still render. */
function withDefaults(stored: Record<string, unknown>): SceneConfig {
  const section = <K extends 'frame' | 'scene' | 'view' | 'transforms' | 'publish'>(key: K) =>
    ({
      ...DEFAULT_SCENE_CONFIG[key],
      ...(isObject(stored[key]) ? stored[key] : {}),
    }) as SceneConfig[K];
  const layers = Array.isArray(stored.layers)
    ? stored.layers.flatMap((layer): CustomLayerConfig[] => {
        if (!isObject(layer) || typeof layer.id !== 'string') return [];
        if (layer.type === 'grid')
          return [{ ...newGridLayer(layer.id), ...layer } as CustomLayerConfig];
        if (layer.type === 'urdf')
          return [{ ...newUrdfLayer(layer.id), ...layer } as CustomLayerConfig];
        return [];
      })
    : DEFAULT_SCENE_CONFIG.layers;
  return {
    version: 2,
    frame: section('frame'),
    scene: section('scene'),
    view: section('view'),
    transforms: section('transforms'),
    publish: section('publish'),
    topics: isObject(stored.topics) ? (stored.topics as Record<string, TopicSettings>) : {},
    layers,
  };
}

/**
 * Read a 3D Scene widget's props. Version 1 props (MITI ≤ 2.0: a URDF source, joint states topic
 * and a list of layers) are converted so existing workspaces keep their robot and topics.
 */
export function normalizeSceneConfig(props: unknown): SceneConfig {
  const stored = isObject(props) ? props : {};
  if (stored.version === 2) return withDefaults(stored);

  const topics: Record<string, TopicSettings> = {};
  const layers: CustomLayerConfig[] = [newGridLayer('grid')];
  const urdf = {
    jointStatesTopic: pick(stored.jointStatesTopic, DEFAULT_URDF_OPTIONS.jointStatesTopic),
    meshBaseUrl: pick(stored.meshBaseUrl, ''),
    packageMapping: isObject(stored.packageMapping)
      ? (stored.packageMapping as Record<string, string>)
      : {},
  };
  if (stored.mode === 'url' && typeof stored.urdfUrl === 'string' && stored.urdfUrl)
    layers.push({ ...newUrdfLayer('urdf'), ...urdf, source: 'url', url: stored.urdfUrl });
  else
    topics[pick(stored.topic, '/robot_description') || '/robot_description'] = {
      visible: true,
      type: 'urdf',
      ...urdf,
    };

  const legacyLayers: Partial<SceneLayerConfig>[] = Array.isArray(stored.layers)
    ? stored.layers.filter(isObject)
    : Array.isArray(stored.pointCloudTopics)
      ? stored.pointCloudTopics.map((topic) => ({ topic, type: 'pointcloud', enabled: true }))
      : [];
  for (const layer of legacyLayers) {
    if (typeof layer.topic !== 'string' || !layer.topic) continue;
    topics[layer.topic] = {
      visible: layer.enabled !== false,
      type: layer.type,
      color: layer.color,
      opacity: layer.opacity,
      size: layer.size,
      maxPoints: layer.maxPoints,
      imageTopic: layer.imageTopic,
      staleAfter: layer.staleAfter,
    };
  }

  const config = withDefaults({});
  return {
    ...config,
    frame: {
      ...config.frame,
      fixedFrame: pick(stored.fixedFrame, ''),
      syncTimestamps: pick(stored.syncTransforms, config.frame.syncTimestamps),
    },
    transforms: {
      ...config.transforms,
      visible: pick(stored.showTF, true),
      tfTopics: Array.isArray(stored.tfTopics) ? stored.tfTopics : config.transforms.tfTopics,
      staticTfTopics: Array.isArray(stored.staticTfTopics) ? stored.staticTfTopics : undefined,
    },
    topics,
    layers,
  };
}

/** Pick the TF frame data should be accumulated in when the user has not chosen one. */
export function autoFixedFrame(
  roots: string[],
  frames: string[],
  seenFrames: string[]
): string | undefined {
  for (const preferred of ['map', 'odom', 'world']) if (roots.includes(preferred)) return preferred;
  return roots[0] ?? frames[0] ?? seenFrames[0];
}

/** `/robot_state_publisher.robot_description` → node and parameter (node names have no dots). */
export function parseParameterName(parameter: string): { node: string; name: string } | null {
  const match = parameter.trim().match(/^(\/?[^.]+)\.(.+)$/);
  if (!match) return null;
  return { node: match[1].startsWith('/') ? match[1] : `/${match[1]}`, name: match[2] };
}
