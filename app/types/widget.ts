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
    defaultSize: { w: 4, h: 6 },
    minSize: { minW: 3, minH: 4 },
  },
  {
    type: 'urdf-viewer',
    label: 'URDF Viewer',
    icon: '🤖',
    defaultSize: { w: 8, h: 6 },
    minSize: { minW: 4, minH: 4 },
  },
  {
    type: 'pointcloud-viewer',
    label: 'Point Cloud',
    icon: '☁️',
    defaultSize: { w: 8, h: 6 },
    minSize: { minW: 4, minH: 4 },
  },
];

export const DEFAULT_LAYOUT: LayoutConfig = {
  widgets: [
    {
      i: 'topics-1',
      type: 'topics',
      title: 'Topics',
      x: 0,
      y: 0,
      w: 4,
      h: 12,
      minW: 3,
      minH: 4,
    },
    {
      i: 'urdf-viewer-1',
      type: 'urdf-viewer',
      title: 'URDF Viewer',
      x: 4,
      y: 0,
      w: 8,
      h: 6,
      minW: 4,
      minH: 4,
    },
    {
      i: 'pointcloud-viewer-1',
      type: 'pointcloud-viewer',
      title: 'Point Cloud',
      x: 4,
      y: 6,
      w: 8,
      h: 6,
      minW: 4,
      minH: 4,
    },
  ],
};
