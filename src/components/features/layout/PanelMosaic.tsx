'use client';

import { useEffect, useRef, useState } from 'react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import { Lock, Maximize2, Minimize2, Unlock, X } from 'lucide-react';
import type { WidgetConfig } from '@/types/widget';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import type { MosaicTree } from '@/lib/layout/mosaic';
import { widgetStyles, cn } from '@/styles';
import WidgetContainer from './WidgetContainer';
import PanelIcon from './PanelIcon';

interface PanelMosaicProps {
  widgets: WidgetConfig[];
  mosaic: MosaicTree | null;
  /** Called when a drag or a divider move finishes. */
  onMosaicChange: (mosaic: MosaicTree | null) => void;
  onRemoveWidget: (widgetId: string) => void;
  onToggleLock: (widgetId: string) => void;
  client: BridgeClient | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  onRefreshTopics: () => void;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
  settingsTarget: HTMLElement | null;
  onCloseSettings: () => void;
  onUpdateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
}

/**
 * Panels tile the workspace like Foxglove's layout: drag a panel's header onto an edge of another
 * panel to split it there, and drag the dividers between panels to resize them.
 */
export default function PanelMosaic({
  widgets,
  mosaic,
  onMosaicChange,
  onRemoveWidget,
  onToggleLock,
  client,
  topics,
  topicsLoading,
  onRefreshTopics,
  selectedWidgetId,
  onSelectWidget,
  settingsTarget,
  onCloseSettings,
  onUpdateWidget,
}: PanelMosaicProps) {
  const pointerStart = useRef({ x: 0, y: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandTrigger = useRef<HTMLButtonElement | null>(null);
  // Dividers move continuously; the tree is shown live and saved when the drag ends.
  const [live, setLive] = useState<MosaicTree | null>(mosaic);
  useEffect(() => setLive(mosaic), [mosaic]);
  // Each tab bar has a slot that its panel fills with live status (see PanelStatusPortal).
  const [statusTargets, setStatusTargets] = useState<Record<string, HTMLElement | null>>({});
  const statusRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const statusRef = (id: string) => {
    let ref = statusRefs.current.get(id);
    if (!ref) {
      ref = (el) =>
        setStatusTargets((targets) => (targets[id] === el ? targets : { ...targets, [id]: el }));
      statusRefs.current.set(id, ref);
    }
    return ref;
  };

  useEffect(() => {
    if (!expandedId) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedId(null);
        expandTrigger.current?.focus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [expandedId]);
  useEffect(() => {
    if (expandedId && !widgets.some((widget) => widget.i === expandedId)) setExpandedId(null);
  }, [expandedId, widgets]);

  const byId = new Map(widgets.map((widget) => [widget.i, widget]));

  return (
    <div className={`panel-mosaic h-full w-full ${expandedId ? 'has-expanded-panel' : ''}`}>
      <Mosaic<string>
        className="mosaic miti-mosaic"
        value={live}
        onChange={setLive}
        onRelease={(next) => {
          setLive(next);
          onMosaicChange(next);
        }}
        resize={{ minimumPaneSizePercentage: 3 }}
        zeroStateView={<div />}
        renderTile={(id, path) => {
          const widget = byId.get(id);
          if (!widget) return <div />;
          const expanded = expandedId === id;
          return (
            <MosaicWindow<string>
              path={path}
              title={widget.title}
              draggable={!widget.locked && !expandedId}
              className={cn(
                widgetStyles.container,
                expanded && 'panel-expanded',
                selectedWidgetId === id && 'panel-selected'
              )}
              renderPreview={() => <div className="panel-drag-preview">{widget.title}</div>}
              renderToolbar={() => (
                <div
                  className={cn(widgetStyles.header.base, widget.locked && 'cursor-default')}
                  title={widget.locked ? undefined : 'Drag onto another panel to move it'}
                >
                  <div className={widgetStyles.header.titleWrapper}>
                    <h2 className="flex min-w-0">
                      <button
                        type="button"
                        className="panel-title-button"
                        title={widget.title}
                        aria-label={`Settings for ${widget.title}`}
                        aria-pressed={selectedWidgetId === id}
                        onClick={() => onSelectWidget(id)}
                      >
                        <PanelIcon type={widget.type} />
                        <span className={widgetStyles.header.title}>{widget.title}</span>
                      </button>
                    </h2>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        if (expanded) setExpandedId(null);
                        onRemoveWidget(id);
                      }}
                      className={widgetStyles.buttons.base}
                      aria-label={`Remove ${widget.title}`}
                      title="Remove panel"
                    >
                      <X className={widgetStyles.buttons.icon} />
                    </button>
                  </div>
                  <div ref={statusRef(id)} className={widgetStyles.header.status} />
                  <div className={widgetStyles.header.actions}>
                    <button
                      className={widgetStyles.buttons.base}
                      aria-label={expanded ? 'Restore panel' : `Expand ${widget.title}`}
                      title={expanded ? 'Restore panel (Escape)' : 'Expand panel'}
                      onClick={(event) => {
                        expandTrigger.current = event.currentTarget;
                        setExpandedId(expanded ? null : id);
                      }}
                    >
                      {expanded ? (
                        <Minimize2 className={widgetStyles.buttons.icon} />
                      ) : (
                        <Maximize2 className={widgetStyles.buttons.icon} />
                      )}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleLock(id);
                      }}
                      className={cn(
                        widgetStyles.buttons.base,
                        widget.locked && widgetStyles.buttons.lock
                      )}
                      aria-label={widget.locked ? 'Unlock panel position' : 'Lock panel position'}
                      title={widget.locked ? 'Unlock panel position' : 'Lock panel position'}
                    >
                      {widget.locked ? (
                        <Lock className={widgetStyles.buttons.icon} />
                      ) : (
                        <Unlock className={widgetStyles.buttons.icon} />
                      )}
                    </button>
                  </div>
                </div>
              )}
            >
              <div
                id={`panel-${id}`}
                role="region"
                aria-label={widget.title}
                className={widgetStyles.content.wrapper}
                onPointerDownCapture={(event) => {
                  pointerStart.current = { x: event.clientX, y: event.clientY };
                }}
                onPointerUpCapture={(event) => {
                  if (settingsTarget?.contains(event.target as Node)) return;
                  if ((event.target as HTMLElement).closest('button, input, select, textarea, a'))
                    return;
                  if (
                    Math.hypot(
                      event.clientX - pointerStart.current.x,
                      event.clientY - pointerStart.current.y
                    ) < 4
                  )
                    onSelectWidget(id);
                }}
              >
                <WidgetContainer
                  widget={widget}
                  client={client}
                  topics={topics}
                  topicsLoading={topicsLoading}
                  onRefreshTopics={onRefreshTopics}
                  settingsTarget={selectedWidgetId === id ? settingsTarget : null}
                  statusTarget={statusTargets[id] ?? null}
                  onCloseSettings={onCloseSettings}
                  onUpdateWidget={onUpdateWidget}
                />
              </div>
            </MosaicWindow>
          );
        }}
      />
    </div>
  );
}
