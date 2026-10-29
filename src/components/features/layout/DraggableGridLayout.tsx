'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { WidgetConfig } from '@/types/widget';
import { BridgeClient } from '@/lib/bridge/client';
import WidgetContainer from './WidgetContainer';
import type { TopicInfo } from '@/lib/bridge/types';
import { X, GripVertical, Lock, Unlock, Maximize2, Minimize2 } from 'lucide-react';
import PanelIcon from './PanelIcon';
import { widgetStyles, cn } from '@/styles';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Dynamically import react-grid-layout to avoid SSR issues
import dynamic from 'next/dynamic';
import type ReactGridLayout from 'react-grid-layout';

const GridLayoutComponent = dynamic(
  () => import('react-grid-layout/legacy').then((mod) => mod.default),
  {
    ssr: false,
  }
);

interface DraggableGridLayoutProps {
  widgets: WidgetConfig[];
  onLayoutChange: (layout: readonly ReactGridLayout.Layout[]) => void;
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

export default function DraggableGridLayout({
  widgets,
  onLayoutChange,
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
}: DraggableGridLayoutProps) {
  const pointerStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const expandTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
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

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    setContainerWidth(containerRef.current.offsetWidth);

    return () => resizeObserver.disconnect();
  }, []);

  // Convert widgets to react-grid-layout format
  const layout = useMemo(() => {
    let mobileY = 0;
    return widgets.map((w) => {
      const y = mobileY;
      mobileY += Math.max(10, w.h);
      return {
        i: w.i,
        x: mobile ? 0 : w.x,
        y: mobile ? y : w.y,
        w: mobile ? 12 : w.w,
        h: mobile ? Math.max(10, w.h) : w.h,
        minW: w.minW,
        minH: w.minH,
        static: mobile || w.locked, // Make locked widgets non-draggable and non-resizable
      };
    });
  }, [widgets, mobile]);

  return (
    <div
      ref={containerRef}
      className={`panel-grid h-full w-full ${expandedId ? 'has-expanded-panel' : ''}`}
    >
      <GridLayoutComponent
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={30}
        width={containerWidth}
        onDragStop={(nextLayout) => {
          if (!mobile && !expandedId) onLayoutChange(nextLayout);
        }}
        onResizeStop={(nextLayout) => {
          if (!mobile && !expandedId) onLayoutChange(nextLayout);
        }}
        margin={[8, 8]}
        containerPadding={[0, 0]}
        draggableHandle=".drag-handle"
        draggableCancel=".react-grid-item-content, .react-grid-no-drag, button"
        compactType="vertical"
        preventCollision={false}
        isResizable={!mobile && !expandedId}
        isDraggable={!mobile && !expandedId}
      >
        {widgets.map((widget) => (
          <div
            key={widget.i}
            id={`panel-${widget.i}`}
            className={`${widgetStyles.container} ${expandedId === widget.i ? 'panel-expanded' : ''} ${selectedWidgetId === widget.i ? 'panel-selected' : ''}`}
            onPointerDownCapture={(event) => {
              pointerStart.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUpCapture={(event) => {
              if (settingsTarget?.contains(event.target as Node)) return;
              if (
                (event.target as HTMLElement).closest(
                  'button, input, select, textarea, a, .react-resizable-handle'
                )
              )
                return;
              if (
                Math.hypot(
                  event.clientX - pointerStart.current.x,
                  event.clientY - pointerStart.current.y
                ) < 4
              )
                onSelectWidget(widget.i);
            }}
            role="region"
            aria-label={widget.title}
          >
            {/* Widget Header with drag handle and remove button */}
            <div className={widgetStyles.header.base}>
              <div className={widgetStyles.header.titleWrapper}>
                <GripVertical className={widgetStyles.buttons.icon} />
                <h2 className={widgetStyles.header.title}>
                  <button
                    type="button"
                    className="panel-title-button"
                    title={widget.title}
                    aria-label={`Settings for ${widget.title}`}
                    aria-pressed={selectedWidgetId === widget.i}
                    onClick={() => onSelectWidget(widget.i)}
                  >
                    <PanelIcon type={widget.type} />
                    <span className="truncate">{widget.title}</span>
                  </button>
                </h2>
              </div>
              <div className={widgetStyles.header.actions}>
                <button
                  className={widgetStyles.buttons.base}
                  aria-label={expandedId === widget.i ? 'Restore panel' : `Expand ${widget.title}`}
                  title={expandedId === widget.i ? 'Restore panel (Escape)' : 'Expand panel'}
                  onClick={(event) => {
                    expandTrigger.current = event.currentTarget;
                    setExpandedId(expandedId === widget.i ? null : widget.i);
                  }}
                >
                  {expandedId === widget.i ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLock(widget.i);
                  }}
                  className={cn(
                    widgetStyles.buttons.base,
                    widget.locked ? widgetStyles.buttons.lock : widgetStyles.buttons.unlock
                  )}
                  title={widget.locked ? 'Unlock widget' : 'Lock widget'}
                >
                  {widget.locked ? (
                    <Lock className={widgetStyles.buttons.icon} />
                  ) : (
                    <Unlock className={widgetStyles.buttons.icon} />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (expandedId === widget.i) setExpandedId(null);
                    onRemoveWidget(widget.i);
                  }}
                  className={cn(widgetStyles.buttons.base, widgetStyles.buttons.remove)}
                  title="Remove widget"
                >
                  <X className={widgetStyles.buttons.icon} />
                </button>
              </div>
            </div>

            {/* Widget Content - NOT draggable */}
            <div className={widgetStyles.content.wrapper}>
              <WidgetContainer
                widget={widget}
                client={client}
                topics={topics}
                topicsLoading={topicsLoading}
                onRefreshTopics={onRefreshTopics}
                settingsTarget={selectedWidgetId === widget.i ? settingsTarget : null}
                onCloseSettings={onCloseSettings}
                onUpdateWidget={onUpdateWidget}
              />
            </div>
          </div>
        ))}
      </GridLayoutComponent>
    </div>
  );
}
