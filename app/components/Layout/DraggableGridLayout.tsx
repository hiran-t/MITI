'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { WidgetConfig } from '@/app/types/widget';
import { ROSBridge } from '@/lib/rosbridge/client';
import WidgetContainer from './WidgetContainer';
import type { TopicInfo } from '@/lib/rosbridge/types';
import { X, GripVertical, Lock, Unlock } from 'lucide-react';
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
          className="bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-800 overflow-hidden flex flex-col react-grid-no-drag"
        >
          {/* Widget Header with drag handle and remove button */}
          <div className="drag-handle px-4 py-3 border-b border-gray-800 flex items-center justify-between cursor-move bg-gray-800/50 hover:bg-gray-800/70 transition-colors select-none">
            <div className="flex items-center gap-2 pointer-events-none">
              <GripVertical className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                {widget.title}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(widget.i);
                }}
                className={`p-1 rounded transition-colors pointer-events-auto ${
                  widget.locked 
                    ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400' 
                    : 'hover:bg-gray-700/50 text-gray-400'
                }`}
                title={widget.locked ? 'Unlock widget' : 'Lock widget'}
              >
                {widget.locked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveWidget(widget.i);
                }}
                className="p-1 hover:bg-red-500/20 rounded transition-colors pointer-events-auto"
                title="Remove widget"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
              </button>
            </div>
          </div>
          
          {/* Widget Content - NOT draggable */}
          <div className="flex-1 overflow-hidden p-4 react-grid-item-content">
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
