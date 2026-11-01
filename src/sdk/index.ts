/**
 * `@miti/sdk`: what widgets build their panels with. A widget imports it, and React, by name;
 * its build (`miti-widget build` from hiran-t/MITI-sdk) points those imports at the copies MITI
 * runs (see `runtime.ts`), so a widget shares MITI's React, hooks and components. MITI-sdk's
 * index.d.ts declares this API, and its CI checks that this file provides it. What this file
 * exports keeps working for every widget of the same API version; anything else in MITI may
 * change without notice.
 */

/** Widgets declare it in `manifest.json` as `miti.apiVersion`. */
export { WIDGET_API_VERSION as API_VERSION } from '@/lib/widgets/manifest';

export { definePanel, defineWidget } from './define';
export type { WidgetDefinition } from './define';
export type { MitiClient, PanelDefinition, PanelProps } from '@/panels/types';
export type { TopicInfo } from '@/lib/bridge/types';

// Data from the robot
export { useTopic } from '@/hooks/useTopic';
export type { TopicOptions } from '@/hooks/useTopic';
export { useTF } from '@/hooks/useTF';
export { usePanelVisible } from '@/hooks/usePanelVisible';
export { default as ImageCanvas } from './ImageCanvas';
export type { ImageFrame } from './ImageCanvas';

// Panel settings, shown in the sidebar while the panel is selected, and status in its tab
export {
  default as PanelSettings,
  PanelStatusPortal as PanelStatus,
  SettingsSection,
} from '@/components/features/layout/WidgetSettingsPortal';
export {
  TreeSection,
  TreeField,
  TextField,
  NumberField,
  ToggleField,
  SelectField,
  ColorField,
  SliderField,
} from '@/components/features/layout/SettingsTree';
export { default as TopicInput } from '@/components/features/topic-viewer/TopicInput';
