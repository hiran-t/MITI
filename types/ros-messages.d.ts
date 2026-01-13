// ROS standard message types

export namespace std_msgs {
  export interface Header {
    seq?: number;
    stamp: {
      sec: number;
      nsec: number;
    };
    frame_id: string;
  }

  export interface String {
    data: string;
  }
}

export namespace sensor_msgs {
  export interface PointField {
    name: string;
    offset: number;
    datatype: number;
    count: number;
  }

  export interface PointCloud2 {
    header: std_msgs.Header;
    height: number;
    width: number;
    fields: PointField[];
    is_bigendian: boolean;
    point_step: number;
    row_step: number;
    data: number[];
    is_dense: boolean;
  }

  export interface Image {
    header: std_msgs.Header;
    height: number;
    width: number;
    encoding: string;
    is_bigendian: number;
    step: number;
    data: number[] | string; // Can be array or base64 string from rosbridge
  }

  export interface JointState {
    header: std_msgs.Header;
    name: string[];
    position: number[];
    velocity: number[];
    effort: number[];
  }
}

export namespace geometry_msgs {
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

  export interface Pose {
    position: Vector3;
    orientation: Quaternion;
  }

  export interface Transform {
    translation: Vector3;
    rotation: Quaternion;
  }
}
