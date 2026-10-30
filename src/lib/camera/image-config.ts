/**
 * Image panel settings, named after Foxglove's Image panel. Stored as the `camera-viewer` widget's
 * props; MITI ≤ 3.0 props (`{ topic, maxFps? }`) are read through `normalizeImageConfig`.
 */
import type { ColorMapName } from '@/lib/scene/colors';
import {
  DEFAULT_SCENE_CONFIG,
  type TopicSettings,
  type TransformSettings,
} from '@/types/scene-config';
import { DEFAULT_IMAGE_GRADIENT, type ImageColorMode } from './image-colors';
import type { ImageRotation } from './projection';

export interface ImagePanelConfig {
  version: 2;
  topic: string;
  /** CameraInfo topic; undefined follows the image topic (`<dir>/camera_info`), '' is None. */
  calibrationTopic?: string;
  /** Frames per second requested from the bridge; 0 receives every frame. */
  maxFps: number;
  rectify: boolean;
  /** Place the camera with TF at the image's stamp instead of the latest transform. */
  syncTimestamps: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: ImageRotation;
  colorMode: ImageColorMode;
  colorMap: ColorMapName;
  gradient: [string, string];
  valueMin?: number;
  valueMax?: number;
  scene: { labelScale: number; ignoreColladaUpAxis: boolean; meshUpAxis: 'y_up' | 'z_up' };
  transforms: TransformSettings;
  /** Overlay topics drawn on the image, as in the 3D Scene's Topics. */
  topics: Record<string, TopicSettings>;
}

/** Frames decoded per second unless the user picks another rate. */
export const DEFAULT_CAMERA_MAX_FPS = 15;
export const ROTATIONS: ImageRotation[] = [0, 90, 180, 270];

export const DEFAULT_IMAGE_CONFIG: ImagePanelConfig = {
  version: 2,
  topic: '',
  maxFps: DEFAULT_CAMERA_MAX_FPS,
  rectify: false,
  syncTimestamps: true,
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0,
  colorMode: 'gradient',
  colorMap: 'turbo',
  gradient: DEFAULT_IMAGE_GRADIENT,
  scene: { labelScale: 1, ignoreColladaUpAxis: false, meshUpAxis: 'z_up' },
  // TF frames are opt-in on an image, as in Foxglove.
  transforms: { ...DEFAULT_SCENE_CONFIG.transforms, visible: false },
  topics: {},
};

/** `/camera/color/image_raw` (or its `/compressed` stream) → `/camera/color/camera_info`. */
export function defaultCalibrationTopic(imageTopic: string): string {
  const base = imageTopic.replace(/\/(compressed|compressedDepth|theora)$/, '');
  const slash = base.lastIndexOf('/');
  return slash < 0 ? '' : `${base.slice(0, slash)}/camera_info`;
}

export const calibrationTopicOf = (config: ImagePanelConfig) =>
  config.calibrationTopic ?? defaultCalibrationTopic(config.topic);

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const pick = <T>(value: unknown, fallback: T): T =>
  value !== undefined && typeof value === typeof fallback ? (value as T) : fallback;
const optionalNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Read a camera widget's props, filling defaults. Older props keep their topic and a Max FPS the
 * user chose (including 0, every frame); panels that never set one get the new default.
 */
export function normalizeImageConfig(props: unknown, fallbackTopic = ''): ImagePanelConfig {
  const stored = isObject(props) ? props : {};
  const d = DEFAULT_IMAGE_CONFIG;
  const gradient =
    Array.isArray(stored.gradient) &&
    stored.gradient.length === 2 &&
    stored.gradient.every((color) => typeof color === 'string')
      ? (stored.gradient as [string, string])
      : d.gradient;
  const maxFps = optionalNumber(stored.maxFps);
  return {
    version: 2,
    topic: pick(stored.topic, '') || fallbackTopic,
    calibrationTopic:
      typeof stored.calibrationTopic === 'string' ? stored.calibrationTopic : undefined,
    maxFps: maxFps !== undefined && maxFps >= 0 ? maxFps : d.maxFps,
    rectify: pick(stored.rectify, d.rectify),
    syncTimestamps: pick(stored.syncTimestamps, d.syncTimestamps),
    flipHorizontal: pick(stored.flipHorizontal, d.flipHorizontal),
    flipVertical: pick(stored.flipVertical, d.flipVertical),
    rotation: ROTATIONS.includes(stored.rotation as ImageRotation)
      ? (stored.rotation as ImageRotation)
      : d.rotation,
    colorMode: stored.colorMode === 'colormap' ? 'colormap' : 'gradient',
    colorMap: stored.colorMap === 'rainbow' ? 'rainbow' : 'turbo',
    gradient,
    valueMin: optionalNumber(stored.valueMin),
    valueMax: optionalNumber(stored.valueMax),
    scene: { ...d.scene, ...(isObject(stored.scene) ? stored.scene : {}) },
    transforms: { ...d.transforms, ...(isObject(stored.transforms) ? stored.transforms : {}) },
    topics: isObject(stored.topics) ? (stored.topics as Record<string, TopicSettings>) : {},
  };
}
