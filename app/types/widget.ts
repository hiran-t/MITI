/**
 * Widget system types for flexible UI layout
 */

export type WidgetType = 'topics' | 'urdf-viewer' | 'pointcloud-viewer';

export interface WidgetSize {
  cols: number; // Grid columns (1-12)
  rows: number; // Grid rows (1-12)
}

export interface WidgetPosition {
  x: number; // Column position (0-based)
  y: number; // Row position (0-based)
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  visible: boolean;
  position: WidgetPosition;
  size: WidgetSize;
  props?: Record<string, any>;
}

export interface LayoutConfig {
  widgets: WidgetConfig[];
  gridRows: number; // Total grid rows
  gridCols: number; // Total grid columns (typically 12)
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  gridRows: 12,
  gridCols: 12,
  widgets: [
    {
      id: 'topics-1',
      type: 'topics',
      title: 'Topics',
      visible: true,
      position: { x: 0, y: 0 },
      size: { cols: 4, rows: 12 },
    },
    {
      id: 'urdf-viewer-1',
      type: 'urdf-viewer',
      title: 'URDF Viewer',
      visible: true,
      position: { x: 4, y: 0 },
      size: { cols: 8, rows: 6 },
    },
    {
      id: 'pointcloud-viewer-1',
      type: 'pointcloud-viewer',
      title: 'Point Cloud Viewer',
      visible: true,
      position: { x: 4, y: 6 },
      size: { cols: 8, rows: 6 },
    },
  ],
};
