import { useSyncExternalStore, type ComponentType } from 'react';
import type { TopicInfo } from '@/lib/bridge/types';
import type { MitiClient } from './types';

/** What MITI gives a widget's sidebar view. */
export interface SidebarViewProps {
  /** The connection to the robot's bridge, or null while MITI is not connected. */
  client: MitiClient | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  refreshTopics: () => void;
}

/** A view a widget adds to the sidebar: a tab after the built-in ones, and what it shows. */
export interface SidebarViewDefinition {
  /** Starts with the widget's id and a slash, e.g. `acme.vision/models`. */
  id: string;
  /** The tab's name, also the view's title. */
  label: string;
  icon?: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    'aria-hidden'?: boolean | 'true';
  }>;
  component: ComponentType<SidebarViewProps>;
}

/** A view in the registry, with the widget that added it. */
export interface RegisteredSidebarView extends SidebarViewDefinition {
  source: string;
}

const views = new Map<string, RegisteredSidebarView>();
const listeners = new Set<() => void>();
let snapshot: readonly RegisteredSidebarView[] = [];

function changed() {
  snapshot = Array.from(views.values());
  listeners.forEach((listener) => listener());
}

/** Why `view` cannot be registered by the widget `source`, or null when it can. */
function problemWith(source: string, view: SidebarViewDefinition): string | null {
  if (!view || typeof view !== 'object') return 'a sidebar view must be an object';
  if (typeof view.id !== 'string' || !view.id.startsWith(`${source}/`))
    return `sidebar view "${String(view.id)}" must start with "${source}/"`;
  if (typeof view.label !== 'string' || !view.label.trim())
    return `sidebar view "${view.id}" needs a label`;
  if (typeof view.component !== 'function' && typeof view.component !== 'object')
    return `sidebar view "${view.id}" needs a component`;
  if (view.icon !== undefined && typeof view.icon !== 'function' && typeof view.icon !== 'object')
    return `sidebar view "${view.id}" has an icon that is not a component`;
  return null;
}

/**
 * Register the sidebar views of the widget `source`, replacing any it registered before. Nothing
 * is registered when one of them is invalid.
 */
export function registerViews(source: string, definitions: readonly SidebarViewDefinition[]): void {
  const ids = new Set<string>();
  for (const view of definitions) {
    const problem = problemWith(source, view);
    if (problem) throw new Error(problem);
    if (ids.has(view.id)) throw new Error(`sidebar view "${view.id}" is listed twice`);
    ids.add(view.id);
  }
  views.forEach((view, id) => {
    if (view.source === source) views.delete(id);
  });
  for (const view of definitions) views.set(view.id, { ...view, source });
  changed();
}

/** Remove the sidebar views of the widget `source`. */
export function unregisterViews(source: string): void {
  let removed = false;
  views.forEach((view, id) => {
    if (view.source === source) removed = views.delete(id);
  });
  if (removed) changed();
}

/** Widgets' views in the order they were registered. */
export const listViews = (): readonly RegisteredSidebarView[] => snapshot;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The registered sidebar views; components re-render when widgets add or remove them. */
export function useSidebarViews(): readonly RegisteredSidebarView[] {
  return useSyncExternalStore(subscribe, listViews, listViews);
}
