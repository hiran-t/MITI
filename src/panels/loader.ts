'use client';

import { useSyncExternalStore } from 'react';
import { exposeWidgetModules } from '@/sdk/runtime';
import { parseWidgetManifest, type WidgetManifest } from '@/lib/widgets/manifest';
import { registerPanels, unregisterPanels } from './registry';

/**
 * The widgets installed on the MITI server (src/lib/server/widget-store.ts), loaded into this
 * page: each widget's ES module is imported from /api/widgets and its panels registered.
 */
export interface WidgetState extends WidgetManifest {
  installedAt: number;
  status: 'loading' | 'loaded' | 'failed';
  error?: string;
}

export interface WidgetsState {
  /** False until the installed widgets have been listed once. */
  ready: boolean;
  /** Whether this MITI lets the browser import and remove widgets. */
  importAllowed: boolean;
  widgets: WidgetState[];
  /** Widget folders the server cannot read, or why the list could not be fetched. */
  problems: { id: string; error: string }[];
}

type ImportModule = (url: string) => Promise<{ default?: unknown }>;

/** Loads a widget's code as the browser does, past the bundler. */
const importFromUrl: ImportModule = (url) => import(/* webpackIgnore: true */ url);

let state: WidgetsState = { ready: false, importAllowed: false, widgets: [], problems: [] };
const listeners = new Set<() => void>();

function update(next: Partial<WidgetsState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function updateWidget(id: string, next: Partial<WidgetState>) {
  update({ widgets: state.widgets.map((w) => (w.id === id ? { ...w, ...next } : w)) });
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A file of an installed widget; the install time makes a reimported version a new URL. */
export const widgetFileUrl = (widget: Omit<WidgetState, 'status'>, file: string) =>
  `/api/widgets/files/${widget.id}/${widget.version}/${file}?t=${widget.installedAt}`;

async function load(widget: WidgetState, importModule: ImportModule) {
  try {
    const exports = await importModule(widgetFileUrl(widget, widget.main));
    const definition = exports?.default as { panels?: unknown } | undefined;
    if (!definition || !Array.isArray(definition.panels))
      throw new Error(`${widget.main} must export default defineWidget({ panels: [...] })`);
    registerPanels(widget.id, definition.panels);
    updateWidget(widget.id, { status: 'loaded', error: undefined });
  } catch (error) {
    unregisterPanels(widget.id);
    updateWidget(widget.id, { status: 'failed', error: messageOf(error) });
  }
}

/** List the installed widgets and load those this page has not loaded yet, or loaded older. */
export async function refreshWidgets(importModule: ImportModule = importFromUrl): Promise<void> {
  exposeWidgetModules();
  let listing: Pick<WidgetsState, 'importAllowed' | 'problems'> & {
    widgets: Omit<WidgetState, 'status'>[];
  };
  try {
    const response = await fetch('/api/widgets', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    listing = await response.json();
  } catch (error) {
    update({
      ready: true,
      problems: [{ id: 'widgets', error: `Cannot list the widgets: ${messageOf(error)}` }],
    });
    return;
  }
  const loaded = new Map(state.widgets.map((widget) => [widget.id, widget]));
  const installed = new Set(listing.widgets.map((widget) => widget.id));
  loaded.forEach((_widget, id) => installed.has(id) || unregisterPanels(id));
  const widgets = listing.widgets.map((widget): WidgetState => {
    const current = loaded.get(widget.id);
    return current?.installedAt === widget.installedAt && current.status !== 'failed'
      ? current
      : { ...widget, status: 'loading' };
  });
  update({
    ready: true,
    importAllowed: listing.importAllowed,
    problems: listing.problems,
    widgets,
  });
  await Promise.all(
    widgets.filter((w) => w.status === 'loading').map((w) => load(w, importModule))
  );
}

/** The manifest inside a `.miti-widget` file, read before it is sent to the server. */
export async function readWidgetManifest(file: Blob): Promise<WidgetManifest> {
  const { unzipSync } = await import('fflate');
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => entry.name === 'manifest.json',
    });
  } catch {
    throw new Error('The file is not a widget package (a zip with manifest.json)');
  }
  const raw = entries['manifest.json'];
  if (!raw) throw new Error('The package has no manifest.json at its root');
  try {
    return parseWidgetManifest(JSON.parse(new TextDecoder().decode(raw)));
  } catch (error) {
    throw new Error(`manifest.json: ${messageOf(error)}`);
  }
}

/** Install a widget package on the server and load it here. */
export async function importWidget(
  file: Blob,
  importModule: ImportModule = importFromUrl
): Promise<WidgetManifest> {
  const response = await fetch('/api/widgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `The import failed (HTTP ${response.status})`);
  await refreshWidgets(importModule);
  return body;
}

async function postUrl(url: string, check: boolean) {
  const response = await fetch('/api/widgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, check }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `The import failed (HTTP ${response.status})`);
  return body as WidgetManifest;
}

/** The manifest of the package at `url`, which the server downloads to read it. */
export const checkWidgetUrl = (url: string) => postUrl(url, true);

/** Have the server download and install the package at `url`, and load it here. */
export async function importWidgetUrl(
  url: string,
  importModule: ImportModule = importFromUrl
): Promise<WidgetManifest> {
  const manifest = await postUrl(url, false);
  await refreshWidgets(importModule);
  return manifest;
}

/** Remove a widget from the server; layouts keep its panels, shown as not installed. */
export async function removeWidget(id: string): Promise<void> {
  const response = await fetch(`/api/widgets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `The removal failed (HTTP ${response.status})`);
  }
  unregisterPanels(id);
  update({ widgets: state.widgets.filter((widget) => widget.id !== id) });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

export function useWidgets(): WidgetsState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
