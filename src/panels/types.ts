import type { ComponentType } from 'react';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';

/** The part of the foxglove_bridge connection a widget's panels may use. */
export type MitiClient = Pick<
  BridgeClient,
  | 'subscribe'
  | 'unsubscribe'
  | 'advertise'
  | 'publish'
  | 'callService'
  | 'getParameter'
  | 'getServerTime'
  | 'hasCapability'
  | 'getTopics'
  | 'onTopicsChanged'
  | 'isConnected'
>;

/** What MITI gives a panel. Built-in panels get the whole `BridgeClient`. */
export interface PanelProps<Config = unknown, Client = MitiClient> {
  /** The panel's id in the layout. */
  id: string;
  /** The panel's settings, as `normalizeConfig` returns them from the saved layout. */
  config: Config;
  /** Merge changes into the settings; they are saved with the layout. */
  updateConfig: (patch: Partial<Config>) => void;
  /** Replace the settings. */
  setConfig: (config: Config) => void;
  /** The connection to foxglove_bridge, or null while MITI is not connected. */
  client: Client | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  refreshTopics: () => void;
}

/** A kind of panel offered in Add panel. */
export interface PanelDefinition<Config = unknown, Client = MitiClient> {
  /**
   * Saved in layouts, so it never changes. A widget's panel types start with the widget's id and a
   * slash, e.g. `acme.vision/detections`.
   */
  type: string;
  /** Shown in Add panel and as a new panel's title. */
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  /** Settings of a new panel. */
  defaultConfig?: () => Config;
  /** Settings from a saved layout, which may come from an older version or be missing. */
  normalizeConfig?: (stored: unknown) => Config;
  component: ComponentType<PanelProps<Config, Client>>;
}

/** Any panel, whatever its settings and client types, as the registry holds them. */
export type AnyPanelDefinition = PanelDefinition<any, any>;

/** A panel in the registry. */
export interface RegisteredPanel extends AnyPanelDefinition {
  /** `builtin`, or the id of the widget that added the panel. */
  source: string;
  /** Changes whenever the panel is registered again, e.g. by a new version of its widget. */
  revision: number;
}
