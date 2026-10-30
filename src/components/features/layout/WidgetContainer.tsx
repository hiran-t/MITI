'use client';

import type { WidgetConfig } from '@/types/widget';
import { CAMERA_TOPICS } from '@/constants/ros-topics';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import TopicList from '../topic-viewer/TopicList';
import SceneViewer from '../visualization/scene/SceneViewer';
import PointCloudViewer from '../visualization/pointcloud/PointCloudViewer';
import CameraViewer from '../visualization/camera/CameraViewer';
import StateMachineMonitor from '../visualization/state-machine/StateMachineMonitor';
import ButtonSwitchWidget from '../controls/ButtonSwitchWidget';
import LogPanel from '../logs/LogPanel';
import TopicInput from '../topic-viewer/TopicInput';
import WidgetSettingsPortal, {
  WidgetSettingsContext,
  SettingsSection,
} from './WidgetSettingsPortal';
import { widgetStyles, commonStyles } from '@/styles';

interface WidgetContainerProps {
  widget: WidgetConfig;
  client: BridgeClient | null;
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
          <SceneViewer
            topics={topics}
            client={client}
            props={widget.props}
            onPropsChange={(props) => onUpdateWidget(widget.i, { props })}
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
                  <TopicInput
                    className={`${commonStyles.input.base} mt-2`}
                    value={topic}
                    onCommit={(next) => onUpdateWidget(widget.i, { props: { topic: next } })}
                    topics={topics}
                    messageType="sensor_msgs/msg/PointCloud2"
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
            topics={topics}
            onTopicChange={(topic) =>
              onUpdateWidget(widget.i, { props: { ...widget.props, topic } })
            }
            maxFps={widget.props.maxFps}
            onMaxFpsChange={(maxFps) =>
              onUpdateWidget(widget.i, { props: { ...widget.props, maxFps } })
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
      case 'log':
        return (
          <LogPanel
            client={client}
            topics={topics}
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
