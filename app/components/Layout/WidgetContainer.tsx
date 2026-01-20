'use client';

import React from 'react';
import { WidgetConfig } from '@/app/types/widget';
import { ROSBridge } from '@/lib/rosbridge/client';
import TopicList from '../TopicViewer/TopicList';
import URDFViewer from '../Visualization/URDFViewer';
import PointCloudViewer from '../Visualization/PointCloudViewer';
import CameraViewer from '../Visualization/CameraViewer';
import type { TopicInfo } from '@/lib/rosbridge/types';
import type { URDFConfig } from '@/app/types/urdf-config';

interface WidgetContainerProps {
  widget: WidgetConfig;
  client: ROSBridge | null;
  // Additional props for specific widgets
  topics?: TopicInfo[];
  topicsLoading?: boolean;
  onRefreshTopics?: () => void;
  urdfConfig?: URDFConfig;
  onUrdfConfigChange?: {
    onModeChange: (mode: 'topic' | 'url') => void;
    onTopicChange: (topic: string) => void;
    onUrdfUrlChange: (url: string) => void;
    onMeshBaseUrlChange: (url: string) => void;
    onPackageMappingChange: (mapping: Record<string, string>) => void;
  };
}

export default function WidgetContainer({
  widget,
  client,
  topics = [],
  topicsLoading = false,
  onRefreshTopics,
  urdfConfig,
  onUrdfConfigChange,
}: WidgetContainerProps) {
  const renderWidget = () => {
    switch (widget.type) {
      case 'topics':
        return (
          <TopicList
            topics={topics}
            loading={topicsLoading}
            onRefresh={onRefreshTopics || (() => {})}
            client={client}
          />
        );
      
      case 'urdf-viewer':
        return urdfConfig && onUrdfConfigChange ? (
          <URDFViewer
            client={client}
            mode={urdfConfig.mode}
            topic={urdfConfig.topic}
            urdfUrl={urdfConfig.urdfUrl}
            meshBaseUrl={urdfConfig.meshBaseUrl}
            packageMapping={urdfConfig.packageMapping}
            onModeChange={onUrdfConfigChange.onModeChange}
            onTopicChange={onUrdfConfigChange.onTopicChange}
            onUrdfUrlChange={onUrdfConfigChange.onUrdfUrlChange}
            onMeshBaseUrlChange={onUrdfConfigChange.onMeshBaseUrlChange}
            onPackageMappingChange={onUrdfConfigChange.onPackageMappingChange}
          />
        ) : null;
      
      case 'pointcloud-viewer':
        return <PointCloudViewer client={client} />;
      
      case 'camera-viewer':
        return <CameraViewer client={client} topic={widget.props?.topic} />;
      
      default:
        return <div className="text-gray-400">Unknown widget type</div>;
    }
  };

  return (
    <div className="h-full w-full overflow-hidden">
      {renderWidget()}
    </div>
  );
}
