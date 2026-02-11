'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { WidgetConfig } from '@/types/widget';
import { ROSBridge } from '@/lib/rosbridge/client';
import WidgetContainer from './WidgetContainer';
import type { TopicInfo } from '@/lib/rosbridge/types';
import { X, GripVertical, Lock, Unlock } from 'lucide-react';
import clsx from 'clsx';
import { widgetStyles, cn } from '@/styles';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Dynamically import react-grid-layout to avoid SSR issues
import dynamic from 'next/dynamic';

const GridLayoutComponent = dynamic(
  () => import('react-grid-layout').then((mod) => mod.default),
  { ssr: false }
);

interface DraggableGridLayoutProps {
  widgets: WidgetConfig[];
  onLayoutChange: (layout: readonly any[]) => void;
  onRemoveWidget: (widgetId: string) => void;
  onToggleLock: (widgetId: string) => void;
  client: ROSBridge | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  onRefreshTopics: () => void;
  urdfConfig: {
    mode: 'topic' | 'url';
    topic: string;
    urdfUrl: string;
    meshBaseUrl: string;
    packageMapping: Record<string, string>;
  };
  onUrdfConfigChange: {
    onModeChange: (mode: 'topic' | 'url') => void;
    onTopicChange: (topic: string) => void;
    onUrdfUrlChange: (url: string) => void;
    onMeshBaseUrlChange: (url: string) => void;
    onPackageMappingChange: (mapping: Record<string, string>) => void;
  };
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
  urdfConfig,
  onUrdfConfigChange,
}: DraggableGridLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

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
    return widgets.map(w => ({
      i: w.i,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: w.minW,
      minH: w.minH,
      static: w.locked, // Make locked widgets non-draggable and non-resizable
    }));
  }, [widgets]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <GridLayoutComponent
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={30}
        width={containerWidth}
        onLayoutChange={onLayoutChange}
        draggableHandle=".drag-handle"
        draggableCancel=".react-grid-item-content, .react-grid-no-drag, button"
        compactType="vertical"
        preventCollision={false}
        isResizable={true}
        isDraggable={true}
        {...({} as any)}
      >
      {widgets.map((widget) => (
        <div
          key={widget.i}
          className={widgetStyles.container}
        >
          {/* Widget Header with drag handle and remove button */}
          <div className={widgetStyles.header.base}>
            <div className={widgetStyles.header.titleWrapper}>
              <GripVertical className={widgetStyles.buttons.icon} />
              <h2 className={widgetStyles.header.title}>
                <span className={widgetStyles.header.indicator} />
                {widget.title}
              </h2>
            </div>
            <div className={widgetStyles.header.actions}>
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
              urdfConfig={urdfConfig}
              onUrdfConfigChange={onUrdfConfigChange}
            />
          </div>
        </div>
      ))}
      </GridLayoutComponent>
    </div>
  );
}
