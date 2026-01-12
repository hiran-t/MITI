'use client';

import React from 'react';
import { LayoutConfig, WidgetConfig } from '@/app/types/widget';
import { ROSBridge } from '@/lib/rosbridge/client';
import WidgetContainer from './WidgetContainer';
import type { TopicInfo } from '@/lib/rosbridge/types';

interface GridLayoutProps {
  layout: LayoutConfig;
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

export default function GridLayout({
  layout,
  client,
  topics,
  topicsLoading,
  onRefreshTopics,
  urdfConfig,
  onUrdfConfigChange,
}: GridLayoutProps) {
  const visibleWidgets = layout.widgets.filter(w => w.visible);

  // Calculate grid template based on layout configuration
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${layout.gridCols}, 1fr)`,
    gridTemplateRows: `repeat(${layout.gridRows}, 1fr)`,
    gap: '1rem',
    height: '100%',
    width: '100%',
  };

  return (
    <div style={gridStyle}>
      {visibleWidgets.map((widget) => {
        const itemStyle = {
          gridColumn: `${widget.position.x + 1} / span ${widget.size.cols}`,
          gridRow: `${widget.position.y + 1} / span ${widget.size.rows}`,
        };

        return (
          <div
            key={widget.id}
            style={itemStyle}
            className="bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-800 overflow-hidden"
          >
            <div className="h-full flex flex-col">
              {/* Widget Header */}
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  {widget.title}
                </h2>
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
          </div>
        );
      })}
    </div>
  );
}
