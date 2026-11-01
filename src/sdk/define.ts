import type { AnyPanelDefinition, PanelDefinition } from '@/panels/types';

/** What a widget's `index.js` exports as default: the panels it adds to Add panel. */
export interface WidgetDefinition {
  /** Each panel's settings type is checked where it is written with `definePanel`. */
  panels: AnyPanelDefinition[];
}

/** Types a panel's settings from its `defaultConfig`, `normalizeConfig` and component. */
export const definePanel = <Config>(panel: PanelDefinition<Config>): PanelDefinition<Config> =>
  panel;

export const defineWidget = (widget: WidgetDefinition): WidgetDefinition => widget;
