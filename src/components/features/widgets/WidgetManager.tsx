'use client';

import { useRef, useState, type DragEvent } from 'react';
import { AlertCircle, Puzzle, Upload } from 'lucide-react';
import { usePanels } from '@/panels';
import {
  checkWidgetUrl,
  importWidget,
  importWidgetUrl,
  readWidgetManifest,
  removeWidget,
  useWidgets,
} from '@/panels/loader';
import { WIDGET_FILE_EXTENSION, type WidgetManifest } from '@/lib/widgets/manifest';

const STATUS = { loading: 'Loading…', loaded: 'Loaded', failed: 'Failed' } as const;

/**
 * The Widgets view of the sidebar: the widgets installed on the MITI server, importing a
 * `.miti-widget` file and removing a widget. Imported widgets' panels appear in Add panel.
 */
export default function WidgetManager({ usedTypes }: { usedTypes: string[] }) {
  const { ready, importAllowed, widgets, problems } = useWidgets();
  const panels = usePanels();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await task();
      if (text) setMessage({ text });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  /** Ask before importing, naming the widget and what it replaces. */
  const confirmImport = (manifest: WidgetManifest, from?: string) => {
    const installed = widgets.find((widget) => widget.id === manifest.id);
    const by = manifest.author ? ` by ${manifest.author}` : '';
    const replaces = installed ? ` It replaces version ${installed.version}.` : '';
    const source = from ? `\n\nFrom ${from}` : '';
    return window.confirm(
      `Import ${manifest.name} ${manifest.version} (${manifest.id})${by}?${replaces}${source}\n\n` +
        'A widget runs inside MITI with the same access as MITI, including sending commands ' +
        'to the robot. Import only widgets from sources you trust.'
    );
  };
  const imported = (manifest: WidgetManifest) =>
    `Imported ${manifest.name} ${manifest.version}. Its panels are in Add panel.`;

  const importFile = (file: File) =>
    run(async () => {
      const manifest = await readWidgetManifest(file);
      if (!confirmImport(manifest)) return null;
      return imported(await importWidget(file));
    });

  const importUrl = (address: string) =>
    run(async () => {
      const manifest = await checkWidgetUrl(address);
      if (!confirmImport(manifest, address)) return null;
      const done = await importWidgetUrl(address);
      setUrl('');
      return imported(done);
    });

  const remove = (id: string, name: string) => {
    const used = usedTypes.filter((type) => type.startsWith(`${id}/`)).length;
    const keeps =
      used === 1
        ? '\n\n1 panel in this layout uses it; it keeps its settings and shows again if you ' +
          'import the widget later.'
        : used > 1
          ? `\n\n${used} panels in this layout use it; they keep their settings and show again ` +
            'if you import the widget later.'
          : '';
    if (!window.confirm(`Remove the widget ${name} from this MITI?${keeps}`)) return;
    run(async () => {
      await removeWidget(id);
      return `Removed ${name}.`;
    });
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && importAllowed && !busy) importFile(file);
  };

  return (
    <div
      className={`widget-manager ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => {
        if (!importAllowed || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <div className="widget-toolbar">
        <button
          className="sidebar-button"
          disabled={!importAllowed || busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={13} aria-hidden="true" />
          Import widget…
        </button>
        <input
          ref={input}
          type="file"
          accept={`${WIDGET_FILE_EXTENSION},application/zip`}
          aria-label="Widget file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) importFile(file);
          }}
        />
        {!importAllowed && ready && (
          <span className="widget-note">Importing is turned off on this MITI.</span>
        )}
      </div>
      {importAllowed && (
        <form
          className="widget-url"
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim() && !busy) importUrl(url.trim());
          }}
        >
          <input
            type="url"
            aria-label="Widget address"
            placeholder={`https://…/widget${WIDGET_FILE_EXTENSION}`}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            spellCheck={false}
          />
          <button className="sidebar-button" type="submit" disabled={!url.trim() || busy}>
            Import
          </button>
        </form>
      )}
      {message && (
        <p role={message.error ? 'alert' : 'status'} className="widget-message">
          {message.error && <AlertCircle size={13} aria-hidden="true" />}
          {message.text}
        </p>
      )}
      {ready && widgets.length === 0 && (
        <div className="inspector-empty">
          <Puzzle size={24} />
          <strong>No widgets</strong>
          <p>
            Import a <code>{WIDGET_FILE_EXTENSION}</code> file, or drop it here, to add its panels
            to Add panel.
          </p>
        </div>
      )}
      {widgets.map((widget) => {
        const own = panels.filter((panel) => panel.source === widget.id);
        const used = usedTypes.filter((type) => type.startsWith(`${widget.id}/`)).length;
        return (
          <details key={widget.id} className="source-details widget-item" open>
            <summary>
              <Puzzle size={14} />
              <span>{widget.name}</span> <span className="widget-version">{widget.version}</span>
            </summary>
            {widget.description && <p className="widget-description">{widget.description}</p>}
            <dl>
              <dt>Id</dt>
              <dd>
                <code>{widget.id}</code>
              </dd>
              {widget.author && (
                <>
                  <dt>Author</dt>
                  <dd>{widget.author}</dd>
                </>
              )}
              <dt>Status</dt>
              <dd className={widget.status === 'failed' ? 'widget-failed' : undefined}>
                {STATUS[widget.status]}
                {widget.error && `: ${widget.error}`}
              </dd>
              <dt>Panels</dt>
              <dd>{own.length ? own.map((panel) => panel.label).join(', ') : '—'}</dd>
              <dt>In layout</dt>
              <dd>{used ? `${used} panel${used === 1 ? '' : 's'}` : 'Not used'}</dd>
            </dl>
            {importAllowed && (
              <div className="source-settings">
                <span>
                  {widget.homepage && (
                    <a href={widget.homepage} target="_blank" rel="noreferrer">
                      Homepage
                    </a>
                  )}
                </span>
                <button
                  className="sidebar-button"
                  disabled={busy}
                  onClick={() => remove(widget.id, widget.name)}
                >
                  Remove
                </button>
              </div>
            )}
          </details>
        );
      })}
      {problems.map((problem) => (
        <details key={problem.id} className="inspector-problem" open>
          <summary>
            <AlertCircle size={14} />
            {problem.id}
          </summary>
          <p>{problem.error}</p>
        </details>
      ))}
      <div className="sidebar-footer widget-footer">
        Widgets are kept on the MITI server, so every browser that opens this MITI has them.
      </div>
    </div>
  );
}
