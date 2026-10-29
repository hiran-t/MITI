'use client';

import type { WidgetConfig } from '@/types/widget';
import { DEFAULT_URDF_CONFIG } from '@/types/urdf-config';
import { CAMERA_TOPICS } from '@/constants/ros-topics';
import type { ROSBridge } from '@/lib/rosbridge/client';
import type { TopicInfo } from '@/lib/rosbridge/types';
import TopicList from '../topic-viewer/TopicList';
import URDFViewer from '../visualization/urdf/URDFViewer';
import PointCloudViewer from '../visualization/pointcloud/PointCloudViewer';
import CameraViewer from '../visualization/camera/CameraViewer';
import StateMachineMonitor from '../visualization/state-machine/StateMachineMonitor';
import ButtonSwitchWidget from '../controls/ButtonSwitchWidget';
import WidgetSettingsPortal, {
  WidgetSettingsContext,
  SettingsSection,
} from './WidgetSettingsPortal';
import { widgetStyles, commonStyles } from '@/styles';

interface WidgetContainerProps {
  widget: WidgetConfig;
  client: ROSBridge | null;
  topics: TopicInfo[];
  topicsLoading: boolean;
  onRefreshTopics: () => void;
  settingsTarget: HTMLElement | null;
  onCloseSettings: () => void;
  onUpdateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
}

export default function WidgetContainer({
  widget,
  client,
  topics,
  topicsLoading,
  onRefreshTopics,
  settingsTarget,
  onCloseSettings,
  onUpdateWidget,
}: WidgetContainerProps) {
  const renderWidget = () => {
    switch (widget.type) {
      case 'topics':
        return (
          <>
            <TopicList
              topics={topics}
              loading={topicsLoading}
              onRefresh={onRefreshTopics}
              client={client}
            />
            <WidgetSettingsPortal>
              <SettingsSection title="Topics" keywords="search subscribe configuration">
                <p className="p-4 text-xs text-gray-400">
                  Search and subscribe to topics directly in this panel. No additional configuration
                  is needed.
                </p>
              </SettingsSection>
            </WidgetSettingsPortal>
          </>
        );
      case 'urdf-viewer':
        return (
          <URDFViewer
            topics={topics}
            client={client}
            config={{ ...DEFAULT_URDF_CONFIG, ...widget.props }}
            onConfigChange={(updates) =>
              onUpdateWidget(widget.i, {
                props: { ...DEFAULT_URDF_CONFIG, ...widget.props, ...updates },
              })
            }
          />
        );
      case 'pointcloud-viewer': {
        const topic = widget.props?.topic ?? CAMERA_TOPICS.DEPTH_POINTS;
        return (
          <>
            <PointCloudViewer client={client} topic={topic} />
            <WidgetSettingsPortal>
              <SettingsSection title="General" keywords="Point Cloud Topic">
                <label className="block p-4 text-sm">
                  Point Cloud Topic
                  <input
                    className={`${commonStyles.input.base} mt-2`}
                    value={topic}
                    onChange={(event) =>
                      onUpdateWidget(widget.i, { props: { topic: event.target.value } })
                    }
                  />
                </label>
              </SettingsSection>
            </WidgetSettingsPortal>
          </>
        );
      }
      case 'camera-viewer':
        return (
          <CameraViewer
            client={client}
            topic={widget.props.topic}
            onTopicChange={(topic) =>
              onUpdateWidget(widget.i, { props: { ...widget.props, topic } })
            }
          />
        );
      case 'state-machine':
        return (
          <StateMachineMonitor
            client={client}
            smaccTopic={widget.props?.smaccTopic}
            btStatusTopic={widget.props?.btStatusTopic}
            onConfigChange={(updates) =>
              onUpdateWidget(widget.i, { props: { ...widget.props, ...updates } })
            }
          />
        );
      case 'button-switch':
        return (
          <ButtonSwitchWidget
            client={client}
            props={widget.props}
            onConfigChange={(updates) =>
              onUpdateWidget(widget.i, { props: { ...widget.props, ...updates } })
            }
          />
        );
      default:
        return null;
    }
  };
  return (
    <WidgetSettingsContext.Provider value={{ target: settingsTarget, close: onCloseSettings }}>
      <div className={widgetStyles.content.inner}>{renderWidget()}</div>
    </WidgetSettingsContext.Provider>
  );
}
