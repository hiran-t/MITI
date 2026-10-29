import type { Stamp } from '@/lib/scene/transforms';
export const LAYER_TYPES = {
  pointcloud: { label: 'Point Cloud', message: 'sensor_msgs/msg/PointCloud2' },
  scan: { label: 'Laser Scan', message: 'sensor_msgs/msg/LaserScan' },
  markers: { label: 'Marker Array', message: 'visualization_msgs/msg/MarkerArray' },
  marker: { label: 'Marker', message: 'visualization_msgs/msg/Marker' },
  map: { label: 'Occupancy Grid', message: 'nav_msgs/msg/OccupancyGrid' },
  path: { label: 'Path', message: 'nav_msgs/msg/Path' },
  odometry: { label: 'Odometry', message: 'nav_msgs/msg/Odometry' },
  pose: { label: 'Pose Stamped', message: 'geometry_msgs/msg/PoseStamped' },
  poses: { label: 'Pose Array', message: 'geometry_msgs/msg/PoseArray' },
  camera: { label: 'Camera / Image', message: 'sensor_msgs/msg/CameraInfo' },
} as const;
export type LayerType = keyof typeof LAYER_TYPES;
export interface SceneLayerConfig {
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
