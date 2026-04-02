/**
 * Widget system types for flexible UI layout with drag-and-drop support
 */

import { CAMERA_TOPICS } from '@/constants/ros-topics';

// ─── Base ────────────────────────────────────────────────────────────────────

interface WidgetBase {
  i: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  locked?: boolean;
}

// ─── Per-type props ──────────────────────────────────────────────────────────

export interface CameraWidgetProps {
  topic: string;
}

export interface StateMachineWidgetProps {
  smaccTopic?: string;
  btStatusTopic?: string;
}

export type ButtonSwitchMode = 'topic' | 'service';

export interface ButtonSwitchWidgetProps {
  /** Display label on the button */
  label?: string;
  /** Whether to publish to a topic or call a service */
  mode?: ButtonSwitchMode;
  // ── Topic publish mode ──────────────────────────────────────────────
  /** ROS topic to publish to */
  topic?: string;
  /** ROS message type, e.g. "std_msgs/Bool" */
  messageType?: string;
  /** JSON string payload published when switched ON */
  onPayload?: string;
  /** JSON string payload published when switched OFF */
  offPayload?: string;
  // ── Service call mode ───────────────────────────────────────────────
  /** ROS service name to call */
  service?: string;
  /** JSON string args sent to service when switched ON */
  onArgs?: string;
  /** JSON string args sent to service when switched OFF */
  offArgs?: string;
}

// ─── Discriminated union variants ────────────────────────────────────────────

export type TopicsWidgetConfig = WidgetBase & { type: 'topics' };
export type URDFWidgetConfig = WidgetBase & { type: 'urdf-viewer' };
export type PointCloudWidgetConfig = WidgetBase & { type: 'pointcloud-viewer' };
export type CameraWidgetConfig = WidgetBase & { type: 'camera-viewer'; props: CameraWidgetProps };
export type StateMachineWidgetConfig = WidgetBase & {
  type: 'state-machine';
  props?: StateMachineWidgetProps;
};
export type ButtonSwitchWidgetConfig = WidgetBase & {
  type: 'button-switch';
  props?: ButtonSwitchWidgetProps;
};

export type WidgetConfig =
  | TopicsWidgetConfig
  | URDFWidgetConfig
  | PointCloudWidgetConfig
  | CameraWidgetConfig
  | StateMachineWidgetConfig
  | ButtonSwitchWidgetConfig;

// Derived from the union — stays in sync automatically
export type WidgetType = WidgetConfig['type'];

// ─── Layout config ───────────────────────────────────────────────────────────

export interface LayoutConfig {
  widgets: WidgetConfig[];
}

// ─── Widget type metadata ────────────────────────────────────────────────────

export interface WidgetTypeInfo {
  type: WidgetType;
  label: string;
  icon: string;
  defaultSize: { w: number; h: number };
  minSize: { minW: number; minH: number };
}

export const WIDGET_TYPES: WidgetTypeInfo[] = [
  {
    type: 'topics',
    label: 'Topics',
    icon: '📋',
    defaultSize: { w: 1, h: 2 },
    minSize: { minW: 1, minH: 2 },
  },
  {
    type: 'urdf-viewer',
    label: 'URDF Viewer',
    icon: '🤖',
    defaultSize: { w: 3, h: 3 },
    minSize: { minW: 1, minH: 1 },
  },
  {
    type: 'pointcloud-viewer',
    label: 'Point Cloud',
    icon: '☁️',
    defaultSize: { w: 2, h: 2 },
    minSize: { minW: 1, minH: 1 },
  },
  {
    type: 'camera-viewer',
    label: 'Camera',
    icon: '📷',
    defaultSize: { w: 2, h: 2 },
    minSize: { minW: 1, minH: 1 },
  },
  {
    type: 'state-machine',
    label: 'State Machine',
    icon: '🔀',
    defaultSize: { w: 3, h: 4 },
    minSize: { minW: 2, minH: 3 },
  },
  {
    type: 'button-switch',
    label: 'Button Switch',
    icon: '🔘',
    defaultSize: { w: 2, h: 2 },
    minSize: { minW: 1, minH: 1 },
  },
];

export const DEFAULT_LAYOUT: LayoutConfig = {
  widgets: [
    {
      i: 'topics-1',
      type: 'topics',
      title: 'Topics',
      x: 0,
      y: 3,
      w: 1223,
      h: 2,
      minW: 1,
      minH: 2,
      locked: true,
    },
    {
      i: 'urdf-viewer-1',
      type: 'urdf-viewer',
      title: '3D SCENE',
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      minW: 1,
      minH: 2,
      locked: true,
    },
    {
      i: 'camera-viewer-1',
      type: 'camera-viewer',
      title: 'Camera-Color',
      x: 6,
      y: 0,
      w: 3,
      h: 2,
      minW: 1,
      minH: 2,
      props: { topic: CAMERA_TOPICS.COLOR },
    },
    {
      i: 'camera-viewer-2',
      type: 'camera-viewer',
      title: 'Camera-Detection',
      x: 6,
      y: 2,
      w: 3,
      h: 2,
      minW: 1,
      minH: 2,
      props: { topic: CAMERA_TOPICS.DEPTH },
    },
    {
      i: 'camera-viewer-3',
      type: 'camera-viewer',
      title: 'Camera-Depth',
      x: 9,
      y: 0,
      w: 3,
      h: 2,
      minW: 1,
      minH: 2,
      props: { topic: CAMERA_TOPICS.DETECTION },
    },
    {
      i: 'camera-viewer-4',
      type: 'camera-viewer',
      title: 'Camera-Infrared',
      x: 9,
      y: 2,
      w: 3,
      h: 2,
      minW: 1,
      minH: 2,
      props: { topic: CAMERA_TOPICS.IR },
    },
  ],
};
