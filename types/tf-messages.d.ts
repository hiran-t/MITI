/**
 * ROS TF (Transform) message types
 * These types represent the geometry_msgs and tf2_msgs used in ROS
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  translation: Vector3;
  rotation: Quaternion;
}

export interface TransformStamped {
  header: {
    seq?: number;
    stamp: {
      secs: number;
      nsecs: number;
    };
    frame_id: string;
  };
  child_frame_id: string;
  transform: Transform;
}

export interface TFMessage {
  transforms: TransformStamped[];
}

/**
 * Represents a TF frame in the TF tree
 */
export interface TFFrame {
  name: string;
  parent: string | null;
  transform: Transform;
  timestamp: number; // in milliseconds
  children: string[];
}

/**
 * The complete TF tree structure
 */
export interface TFTree {
  frames: Map<string, TFFrame>;
  rootFrame: string | null;
}
