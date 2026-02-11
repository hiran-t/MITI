/**
 * Widget system types for flexible UI layout with drag-and-drop support
 */

export type WidgetType = 'topics' | 'urdf-viewer' | 'pointcloud-viewer' | 'camera-viewer';

export interface WidgetConfig {
  i: string; // Unique identifier (required by react-grid-layout)
  type: WidgetType;
  title: string;
  x: number; // Grid column position (0-based)
  y: number; // Grid row position (0-based)
  w: number; // Width in grid columns
  h: number; // Height in grid rows
  minW?: number; // Minimum width
  minH?: number; // Minimum height
  locked?: boolean; // Whether the widget is locked (non-draggable/non-resizable)
  props?: Record<string, any>;
}

export interface LayoutConfig {
  widgets: WidgetConfig[];
}

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
      props: {
        topic: '/camera/color/image_raw',
      },
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
      props: {
        topic: '/camera/depth/image_raw',
      },
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
      props: {
        topic: '/pacen_decon_vision/detection_image',
      },
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
      props: {
        topic: '/camera/ir/image_raw',
      },
    },
  ],
};
