import { Box, Camera, Cloud, GitBranch, ListTree, ScrollText, ToggleLeft } from 'lucide-react';
import type { WidgetType } from '@/types/widget';

const icons = {
  topics: ListTree,
  'urdf-viewer': Box,
  'pointcloud-viewer': Cloud,
  'camera-viewer': Camera,
  'state-machine': GitBranch,
  'button-switch': ToggleLeft,
  log: ScrollText,
};

export default function PanelIcon({ type }: { type: WidgetType }) {
  const Icon = icons[type];
  return <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />;
}
