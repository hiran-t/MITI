export const CAMERA_TOPICS = {
  COLOR: '/camera/color/image_raw',
  DEPTH: '/camera/depth/image_raw',
  IR: '/camera/ir/image_raw',
  DETECTION: '/pacen_decon_vision/detection_image',
  DEPTH_POINTS: '/camera/depth/points',
} as const;

export type CameraTopicValue = (typeof CAMERA_TOPICS)[keyof typeof CAMERA_TOPICS];

export const TF_TOPICS = {
  DYNAMIC: '/tf',
  STATIC: '/tf_static',
} as const;

export const STATE_MACHINE_TOPICS = {
  SMACC2: '/smacc2/status',
  BEHAVIOR_TREE: '/behavior_tree/execution_status',
} as const;
