/**
 * Widget system types for flexible UI layout with drag-and-drop support
 */

import type { URDFConfig } from './urdf-config';
import type { SceneConfig } from './scene-config';
import { CAMERA_TOPICS } from '@/constants/ros-topics';
import { mosaicFromGrid, type MosaicTree } from '@/lib/layout/mosaic';

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
  /** Frames per second requested from the bridge; 0 receives every frame. */
  maxFps?: number;
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

/** MITI ≤ 2.0 3D Scene props; read through normalizeSceneConfig. */
export interface LegacyURDFWidgetProps extends URDFConfig {
  pointCloudTopics?: string[];
  jointStatesTopic?: string;
  tfTopics?: string[];
  staticTfTopics?: string[];
  showTF?: boolean;
  fixedFrame?: string;
  robotFrame?: string;
  layers?: import('./scene').SceneLayerConfig[];
  syncTransforms?: boolean;
}

export interface LogWidgetProps {
  /** Default `/rosout`. */
  topic?: string;
  minLevel?: import('@/lib/logs/log-messages').LogLevel;
  /** Filter chips: each matches a node name or message text. */
  searchTerms?: string[];
  /** Node names whose messages are hidden. */
  hiddenNames?: string[];
  fontSize?: number;
  showLevel?: boolean;
  showDate?: boolean;
  showTime?: boolean;
  showTimezone?: boolean;
  showName?: boolean;
  showSource?: boolean;
}

// ─── Discriminated union variants ────────────────────────────────────────────

export type TopicsWidgetConfig = WidgetBase & { type: 'topics' };
export type URDFWidgetProps = SceneConfig | LegacyURDFWidgetProps;
export type URDFWidgetConfig = WidgetBase & { type: 'urdf-viewer'; props?: URDFWidgetProps };
export type PointCloudWidgetConfig = WidgetBase & {
  type: 'pointcloud-viewer';
  props?: { topic: string };
};
export type CameraWidgetConfig = WidgetBase & { type: 'camera-viewer'; props: CameraWidgetProps };
export type StateMachineWidgetConfig = WidgetBase & {
  type: 'state-machine';
  props?: StateMachineWidgetProps;
};
export type ButtonSwitchWidgetConfig = WidgetBase & {
  type: 'button-switch';
  props?: ButtonSwitchWidgetProps;
};

export type LogWidgetConfig = WidgetBase & { type: 'log'; props?: LogWidgetProps };

export type WidgetConfig =
  | LogWidgetConfig
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
  /**
   * How panels tile the workspace, as in Foxglove: a split tree of panel ids. Widget x/y/w/h
   * are the MITI 2.x grid positions, kept only to convert older layouts.
   */
  mosaic?: MosaicTree | null;
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
    defaultSize: { w: 4, h: 10 },
    minSize: { minW: 1, minH: 2 },
  },
  {
    type: 'urdf-viewer',
    label: '3D Scene',
    icon: '🤖',
    defaultSize: { w: 6, h: 16 },
    minSize: { minW: 1, minH: 1 },
  },
  {
    type: 'pointcloud-viewer',
    label: 'Point Cloud',
    icon: '☁️',
    defaultSize: { w: 4, h: 9 },
    minSize: { minW: 1, minH: 1 },
  },
  {
    type: 'camera-viewer',
    label: 'Camera',
    icon: '📷',
    defaultSize: { w: 4, h: 9 },
    minSize: { minW: 1, minH: 1 },
  },
  {
    type: 'state-machine',
    label: 'State Machine',
    icon: '🔀',
    defaultSize: { w: 6, h: 14 },
    minSize: { minW: 2, minH: 3 },
  },
  {
    type: 'button-switch',
    label: 'Button Switch',
    icon: '🔘',
    defaultSize: { w: 4, h: 9 },
    minSize: { minW: 1, minH: 1 },
  },
  {
    type: 'log',
    label: 'Log',
    icon: '📜',
    defaultSize: { w: 6, h: 10 },
    minSize: { minW: 2, minH: 3 },
  },
];

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    i: 'urdf-viewer-1',
    type: 'urdf-viewer',
    title: '3D Scene',
    x: 0,
    y: 0,
    w: 6,
    h: 18,
    minW: 3,
    minH: 6,
  },
  ...(
    [
      ['Color', CAMERA_TOPICS.COLOR],
      ['Depth', CAMERA_TOPICS.DEPTH],
      ['Detection', CAMERA_TOPICS.DETECTION],
      ['Infrared', CAMERA_TOPICS.IR],
    ] as const
  ).map(
    ([name, topic], index): CameraWidgetConfig => ({
      i: `camera-viewer-${index + 1}`,
      type: 'camera-viewer',
      title: `Camera · ${name}`,
      x: 6 + (index % 2) * 3,
      y: Math.floor(index / 2) * 9,
      w: 3,
      h: 9,
      minW: 2,
      minH: 6,
      props: { topic },
    })
  ),
];

export const DEFAULT_LAYOUT: LayoutConfig = {
  widgets: DEFAULT_WIDGETS,
  mosaic: mosaicFromGrid(DEFAULT_WIDGETS.map(({ i, x, y, w, h }) => ({ id: i, x, y, w, h }))),
};
