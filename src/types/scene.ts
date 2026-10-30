import type { Stamp } from '@/lib/scene/transforms';
import type { ColorMapName, MapColorMode, PointColorMode } from '@/lib/scene/colors';
export const LAYER_TYPES = {
  pointcloud: { label: 'Point Cloud', message: 'sensor_msgs/msg/PointCloud2' },
  scan: { label: 'Laser Scan', message: 'sensor_msgs/msg/LaserScan' },
  markers: { label: 'Marker Array', message: 'visualization_msgs/msg/MarkerArray' },
  marker: { label: 'Marker', message: 'visualization_msgs/msg/Marker' },
  map: { label: 'Occupancy Grid', message: 'nav_msgs/msg/OccupancyGrid' },
  path: { label: 'Path', message: 'nav_msgs/msg/Path' },
  odometry: { label: 'Odometry', message: 'nav_msgs/msg/Odometry' },
  pose: { label: 'Pose Stamped', message: 'geometry_msgs/msg/PoseStamped' },
  posecov: {
    label: 'Pose With Covariance',
    message: 'geometry_msgs/msg/PoseWithCovarianceStamped',
  },
  poses: { label: 'Pose Array', message: 'geometry_msgs/msg/PoseArray' },
  camera: { label: 'Camera / Image', message: 'sensor_msgs/msg/CameraInfo' },
} as const;
export type LayerType = keyof typeof LAYER_TYPES;
/** Point cloud and laser scan display, as in Foxglove's 3D panel. */
export interface PointDisplaySettings {
  /** Screen pixels. */
  pointSize?: number;
  pointShape?: 'circle' | 'square';
  /** Seconds earlier messages stay visible; 0 shows only the latest. */
  decayTime?: number;
  /** undefined picks the message's own colors, else intensity, else flat. */
  colorMode?: PointColorMode;
  colorField?: string;
  colorMap?: ColorMapName;
  gradient?: [string, string];
  /** undefined takes the field's range in each message. */
  valueMin?: number;
  valueMax?: number;
  /** Draw a line from each point down to z = 0. */
  stixels?: boolean;
}
/** Occupancy grid display, as in Foxglove's 3D panel. */
export interface MapDisplaySettings {
  mapColorMode?: MapColorMode;
  minColor?: string;
  maxColor?: string;
  unknownColor?: string;
  invalidColor?: string;
  /** Follow the frame's latest transform instead of the transform at the message's stamp. */
  frameLocked?: boolean;
  /** Draw before, and underneath, everything else. */
  drawBehind?: boolean;
}
export type PoseDisplayType = 'axis' | 'arrow' | 'line';
/** Pose, pose array, odometry and path display, as in Foxglove's 3D panel. */
export interface PoseDisplaySettings {
  /** Poses default to axes, pose arrays and odometry to arrows, paths to a line. */
  poseType?: PoseDisplayType;
  axisScale?: number;
  shaftLength?: number;
  shaftWidth?: number;
  headLength?: number;
  headWidth?: number;
  /** Meters. */
  lineWidth?: number;
  /** Position covariance ellipsoid, for poses with covariance and odometry. */
  showCovariance?: boolean;
  covarianceColor?: string;
}
export interface MarkerDisplaySettings {
  hiddenNamespaces?: string[];
}
export interface SceneLayerConfig
  extends PointDisplaySettings, MapDisplaySettings, PoseDisplaySettings, MarkerDisplaySettings {
  id: string;
  type: LayerType;
  topic: string;
  enabled: boolean;
  color?: string;
  opacity?: number;
  size?: number;
  maxPoints?: number;
  imageTopic?: string;
  imageMode?: 'raw' | 'compressed';
  staleAfter?: number;
  /** Messages per second requested from the bridge; undefined or 0 receives every message. */
  maxRate?: number;
}
export interface Header {
  frame_id: string;
  stamp?: Stamp;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Pose {
  position: Vec3;
  orientation: { x: number; y: number; z: number; w: number };
}
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}
export interface Marker {
  header: Header;
  ns: string;
  id: number;
  type: number;
  action: number;
  pose: Pose;
  scale: Vec3;
  color: Color;
  points?: Vec3[];
  colors?: Color[];
  text?: string;
  mesh_resource?: string;
  mesh_use_embedded_materials?: boolean;
  frame_locked?: boolean;
  lifetime?: Stamp;
}
export interface LayerStatus {
  level: 'ok' | 'waiting' | 'error' | 'stale' | 'off';
  message: string;
}
