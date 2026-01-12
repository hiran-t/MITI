'use client';

'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { WidgetConfig } from '@/app/types/widget';
import { ROSBridge } from '@/lib/rosbridge/client';
import WidgetContainer from './WidgetContainer';
import type { TopicInfo } from '@/lib/rosbridge/types';
import { X } from 'lucide-react';

// Dynamically import react-grid-layout to avoid SSR issues
import dynamic from 'next/dynamic';

const GridLayoutComponent = dynamic(
  () => import('react-grid-layout').then((mod) => {
    // Import CSS
    import('react-grid-layout/css/styles.css');
    import('react-resizable/css/styles.css');
    return mod.default;
  }),
  { ssr: false }
);

interface DraggableGridLayoutProps {
  widgets: WidgetConfig[];
  onLayoutChange: (layout: readonly any[]) => void;
  onRemoveWidget: (widgetId: string) => void;
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
        compactType="vertical"
        preventCollision={false}
        isResizable={true}
        isDraggable={true}
      >
      {widgets.map((widget) => (
        <div
          key={widget.i}
          className="bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-800 overflow-hidden flex flex-col"
        >
          {/* Widget Header with drag handle and remove button */}
          <div className="drag-handle px-4 py-3 border-b border-gray-800 flex items-center justify-between cursor-move bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              {widget.title}
            </h2>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveWidget(widget.i);
              }}
              className="p-1 hover:bg-red-500/20 rounded transition-colors"
              title="Remove widget"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
            </button>
          </div>
          
          {/* Widget Content */}
          <div className="flex-1 overflow-hidden p-4">
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
