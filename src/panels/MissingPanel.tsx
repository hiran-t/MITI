'use client';

import { Puzzle } from 'lucide-react';
import { useWidgets } from './loader';

/** The widget a panel type belongs to: the part before the slash, e.g. `acme.vision`. */
export const widgetOf = (type: string): string | null =>
  type.includes('/') ? type.slice(0, type.indexOf('/')) : null;

/** Stands in for a panel whose widget is loading, failed or is not installed; settings are kept. */
export default function MissingPanel({ type }: { type: string }) {
  const id = widgetOf(type);
  const { ready, widgets } = useWidgets();
  const widget = widgets.find((w) => w.id === id);
  if (id && (!ready || widget?.status === 'loading'))
    return (
      <div role="status" className="panel-notice">
        <Puzzle size={24} aria-hidden="true" />
        Loading the widget <code>{id}</code>…
      </div>
    );
  return (
    <div role="status" className={`panel-notice ${widget?.status === 'failed' ? 'is-error' : ''}`}>
      <Puzzle size={24} aria-hidden="true" />
      {widget?.status === 'failed' ? (
        <>
          <strong>Widget failed to load</strong>
          <p>
            <code>{widget.name}</code> {widget.version}: {widget.error}
          </p>
        </>
      ) : widget ? (
        <>
          <strong>Panel not in this widget</strong>
          <p>
            <code>{widget.name}</code> {widget.version} has no <code>{type}</code> panel. Its
            settings are kept.
          </p>
        </>
      ) : id ? (
        <>
          <strong>Widget not installed</strong>
          <p>
            This panel comes from the widget <code>{id}</code>. Import it under Widgets in the
            sidebar to show the panel again; its settings are kept.
          </p>
        </>
      ) : (
        <>
          <strong>Unknown panel</strong>
          <p>
            This version of MITI has no <code>{type}</code> panel. Its settings are kept.
          </p>
        </>
      )}
    </div>
  );
}
