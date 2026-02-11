'use client';

import React from 'react';
import { WidgetConfig } from '@/types/widget';
import { ROSBridge } from '@/lib/rosbridge/client';
import TopicList from '../topic-viewer/TopicList';
import URDFViewer from '../visualization/urdf/URDFViewer';
import PointCloudViewer from '../visualization/pointcloud/PointCloudViewer';
import CameraViewer from '../visualization/camera/CameraViewer';
import type { TopicInfo } from '@/lib/rosbridge/types';
import type { URDFConfig } from '@/types/urdf-config';
import { widgetStyles } from '@/styles';

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
        return <div className={widgetStyles.types.unknown}>Unknown widget type</div>;
    }
  };

  return <div className={widgetStyles.content.inner}>{renderWidget()}</div>;
}
