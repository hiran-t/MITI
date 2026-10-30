/**
 * 3D Scene panel settings, grouped like Foxglove's 3D panel so its users find the same controls.
 * Stored as the `urdf-viewer` widget's props (the widget type name predates the scene).
 */
import type {
  LayerType,
  MapDisplaySettings,
  MarkerDisplaySettings,
  PointDisplaySettings,
  PoseDisplaySettings,
} from './scene';

export type FollowMode = 'pose' | 'position' | 'fixed';
export type UrdfSource = 'topic' | 'url' | 'filePath' | 'parameter';
export type UrdfDisplayMode = 'auto' | 'visual' | 'collision';
export type UrdfControlMode = 'jointStates' | 'manual';
export type PublishType = 'point' | 'pose' | 'pose_estimate';
export type Vec3Tuple = [number, number, number];
/** Renderable topic kinds: the scene layer types plus robot descriptions. */
export type TopicLayerType = LayerType | 'urdf';

export interface FrameSettings {
  /** Frame data is accumulated in; '' picks the TF root. */
  fixedFrame: string;
  /** Frame the camera follows; '' uses the fixed frame. */
  displayFrame: string;
  followMode: FollowMode;
  /** Look up transforms at each message's stamp instead of the latest transform. */
  syncTimestamps: boolean;
}

export interface SceneSettings {
  renderStats: boolean;
  background: string;
  labelScale: number;
  ignoreColladaUpAxis: boolean;
  /** Up axis for meshes whose format has no orientation (STL, OBJ). */
  meshUpAxis: 'y_up' | 'z_up';
}

export interface ViewSettings {
  distance: number;
  perspective: boolean;
  targetOffset: Vec3Tuple;
  /** Azimuth around the up axis, degrees. */
  thetaOffset: number;
  /** Angle from the up axis, degrees. */
  phi: number;
  fovy: number;
  near: number;
  far: number;
}

export interface TransformSettings {
  visible: boolean;
  showLabels: boolean;
  labelSize: number;
  axisScale: number;
  lineWidth: number;
  lineColor: string;
  tfTopics: string[];
  /** undefined infers static topics from names containing "static". */
  staticTfTopics?: string[];
  frames: Record<string, { visible: boolean }>;
}

/** Robot model options shared by robot-description topics and URDF custom layers. */
export interface UrdfOptions {
  jointStatesTopic: string;
  displayMode: UrdfDisplayMode;
  framePrefix: string;
  /** '' keeps the URDF's own materials. */
  color: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
  /** Joint states follows the joint states topic (and TF); manual uses `manualJoints`. */
  controlMode: UrdfControlMode;
  /** Joint positions for manual control, by joint name. */
  manualJoints: Record<string, number>;
  opacity: number;
  showOutlines: boolean;
  /** Draw each link's axes. */
  showAxis: boolean;
  axisScale: number;
  hiddenLinks: string[];
}

export interface TopicSettings
  extends
    Partial<UrdfOptions>,
    PointDisplaySettings,
    MapDisplaySettings,
    PoseDisplaySettings,
    MarkerDisplaySettings {
  visible?: boolean;
  /** Last known kind, so the topic still renders before the topic list arrives. */
  type?: TopicLayerType;
  opacity?: number;
  size?: number;
  maxPoints?: number;
  imageTopic?: string;
  staleAfter?: number;
  /** Messages per second requested from the bridge; undefined or 0 receives every message. */
  maxRate?: number;
}

export interface GridLayerConfig {
  id: string;
  type: 'grid';
  label: string;
  visible: boolean;
  /** '' follows the display frame. */
  frameId: string;
  size: number;
  divisions: number;
  lineWidth: number;
  color: string;
  position: Vec3Tuple;
  /** Roll, pitch, yaw in degrees. */
  rotation: Vec3Tuple;
}

export interface UrdfLayerConfig extends UrdfOptions {
  id: string;
  type: 'urdf';
  label: string;
  visible: boolean;
  source: UrdfSource;
  topic: string;
  url: string;
  /** package:// or absolute path, read through MITI's server. */
  filePath: string;
  /** `/node.parameter`, read with the node's get_parameters service. */
  parameter: string;
}

export type CustomLayerConfig = GridLayerConfig | UrdfLayerConfig;

export interface PublishSettings {
  type: PublishType;
  pointTopic: string;
  poseTopic: string;
  poseEstimateTopic: string;
  poseEstimateXDeviation: number;
  poseEstimateYDeviation: number;
  poseEstimateThetaDeviation: number;
}

export interface SceneConfig {
  version: 2;
  frame: FrameSettings;
  scene: SceneSettings;
  view: ViewSettings;
  transforms: TransformSettings;
  topics: Record<string, TopicSettings>;
  layers: CustomLayerConfig[];
  publish: PublishSettings;
}

export const DEFAULT_URDF_OPTIONS: UrdfOptions = {
  jointStatesTopic: '/joint_states',
  displayMode: 'auto',
  framePrefix: '',
  color: '',
  meshBaseUrl: '',
  packageMapping: {},
  controlMode: 'jointStates',
  manualJoints: {},
  opacity: 1,
  showOutlines: false,
  showAxis: false,
  axisScale: 1,
  hiddenLinks: [],
};

export const DEFAULT_VIEW: ViewSettings = {
  distance: 10,
  perspective: true,
  targetOffset: [0, 0, 0],
  thetaOffset: 45,
  phi: 60,
  fovy: 45,
  near: 0.01,
  far: 5000,
};

export const newGridLayer = (id: string): GridLayerConfig => ({
  id,
  type: 'grid',
  label: 'Grid',
  visible: true,
  frameId: '',
  size: 10,
  divisions: 10,
  lineWidth: 1,
  color: '#6b7280',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
});

export const newUrdfLayer = (id: string): UrdfLayerConfig => ({
  ...DEFAULT_URDF_OPTIONS,
  id,
  type: 'urdf',
  label: 'URDF',
  visible: true,
  source: 'topic',
  topic: '/robot_description',
  url: '',
  filePath: '',
  parameter: '/robot_state_publisher.robot_description',
});

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  version: 2,
  // Place each message with TF at its own stamp, as Foxglove's 3D panel does, so data that
  // arrives late still lines up with the robot.
  frame: { fixedFrame: '', displayFrame: '', followMode: 'pose', syncTimestamps: true },
  scene: {
    renderStats: false,
    background: '#15161a',
    labelScale: 1,
    ignoreColladaUpAxis: false,
    meshUpAxis: 'z_up',
  },
  view: DEFAULT_VIEW,
  transforms: {
    visible: true,
    showLabels: true,
    labelSize: 11,
    axisScale: 1,
    lineWidth: 1,
    lineColor: '#a78bfa',
    tfTopics: ['/tf', '/tf_static'],
    frames: {},
  },
  topics: {},
  layers: [newGridLayer('grid')],
  publish: {
    type: 'point',
    pointTopic: '/clicked_point',
    poseTopic: '/goal_pose',
    poseEstimateTopic: '/initialpose',
    poseEstimateXDeviation: 0.5,
    poseEstimateYDeviation: 0.5,
    poseEstimateThetaDeviation: 0.26179939,
  },
};
