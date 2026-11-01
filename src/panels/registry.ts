import { useSyncExternalStore } from 'react';
import type { AnyPanelDefinition, RegisteredPanel } from './types';

export const BUILTIN_SOURCE = 'builtin';

const panels = new Map<string, RegisteredPanel>();
const listeners = new Set<() => void>();
let snapshot: readonly RegisteredPanel[] = [];
let revision = 0;

function changed() {
  snapshot = Array.from(panels.values());
  listeners.forEach((listener) => listener());
}

/** Why a definition cannot be registered by `source`, or null when it can. */
function problemWith(source: string, panel: AnyPanelDefinition): string | null {
  if (!panel || typeof panel !== 'object') return 'a panel definition must be an object';
  if (typeof panel.type !== 'string' || !panel.type.trim()) return 'a panel needs a type';
  if (source !== BUILTIN_SOURCE && !panel.type.startsWith(`${source}/`))
    return `panel type "${panel.type}" must start with "${source}/"`;
  if (typeof panel.label !== 'string' || !panel.label.trim())
    return `panel "${panel.type}" needs a label`;
  if (typeof panel.component !== 'function' && typeof panel.component !== 'object')
    return `panel "${panel.type}" needs a component`;
  const owner = panels.get(panel.type)?.source;
  if (owner && owner !== source) return `panel type "${panel.type}" belongs to ${owner}`;
  return null;
}

/**
 * Register the panels of `source` (`builtin` or a widget's id), replacing any it registered
 * before. Nothing is registered when one of them is invalid.
 */
export function registerPanels(source: string, definitions: readonly AnyPanelDefinition[]): void {
  const types = new Set<string>();
  for (const panel of definitions) {
    const problem = problemWith(source, panel);
    if (problem) throw new Error(problem);
    if (types.has(panel.type)) throw new Error(`panel type "${panel.type}" is listed twice`);
    types.add(panel.type);
  }
  panels.forEach((panel, type) => {
    if (panel.source === source) panels.delete(type);
  });
  revision += 1;
  for (const panel of definitions) panels.set(panel.type, { ...panel, source, revision });
  changed();
}

/** Remove the panels of `source`; layouts keep its panels, shown as not installed. */
export function unregisterPanels(source: string): void {
  let removed = false;
  panels.forEach((panel, type) => {
    if (panel.source === source) removed = panels.delete(type);
  });
  if (removed) changed();
}

export const getPanel = (type: string): RegisteredPanel | undefined => panels.get(type);

/** Built-in panels first, then widgets' panels in the order they were registered. */
export const listPanels = (): readonly RegisteredPanel[] => snapshot;

export function subscribeToPanels(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The registered panels; components re-render when widgets add or remove panels. */
export function usePanels(): readonly RegisteredPanel[] {
  return useSyncExternalStore(subscribeToPanels, listPanels, listPanels);
}

export function usePanel(type: string): RegisteredPanel | undefined {
  usePanels();
  return panels.get(type);
}
