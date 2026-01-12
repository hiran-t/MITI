/**
 * Widget system types for flexible UI layout with drag-and-drop support
 */

export type WidgetType = 'topics' | 'urdf-viewer' | 'pointcloud-viewer';

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
];

export const DEFAULT_LAYOUT: LayoutConfig = {
  widgets: [
    // {
    //   i: 'topics-1',
    //   type: 'topics',
    //   title: 'Topics',
    //   x: 0,
    //   y: 0,
    //   w: 1,
    //   h: 2,
    //   minW: 1,
    //   minH: 2,
    // },
    // {
    //   i: 'urdf-viewer-1',
    //   type: 'urdf-viewer',
    //   title: 'URDF Viewer',
    //   x: 4,
    //   y: 0,
    //   w: 2,
    //   h: 2,
    //   minW: 1,
    //   minH: 2,
    // },
    // {
    //   i: 'pointcloud-viewer-1',
    //   type: 'pointcloud-viewer',
    //   title: 'Point Cloud',
    //   x: 4,
    //   y: 6,
    //   w: 2,
    //   h: 2,
    //   minW: 1,
    //   minH: 2,
    // },
  ],
};
