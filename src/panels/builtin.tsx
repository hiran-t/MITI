'use client';

import { Box, Camera, Cloud, GitBranch, ListTree, ScrollText, ToggleLeft } from 'lucide-react';
import type { BridgeClient } from '@/lib/bridge/client';
import type { ImagePanelConfig } from '@/lib/camera/image-config';
import type { SceneConfig } from '@/types/scene-config';
import type {
  ButtonSwitchWidgetProps,
  CameraWidgetProps,
  LogWidgetProps,
  StateMachineWidgetProps,
  URDFWidgetProps,
} from '@/types/widget';
import { CAMERA_TOPICS } from '@/constants/ros-topics';
import { commonStyles } from '@/styles';
import TopicList from '@/components/features/topic-viewer/TopicList';
import TopicInput from '@/components/features/topic-viewer/TopicInput';
import SceneViewer from '@/components/features/visualization/scene/SceneViewer';
import PointCloudViewer from '@/components/features/visualization/pointcloud/PointCloudViewer';
import CameraViewer from '@/components/features/visualization/camera/CameraViewer';
import StateMachineMonitor from '@/components/features/visualization/state-machine/StateMachineMonitor';
import ButtonSwitchWidget from '@/components/features/controls/ButtonSwitchWidget';
import LogPanel from '@/components/features/logs/LogPanel';
import WidgetSettingsPortal, {
  SettingsSection,
} from '@/components/features/layout/WidgetSettingsPortal';
import type { AnyPanelDefinition, PanelDefinition, PanelProps } from './types';

type Props<Config> = PanelProps<Config, BridgeClient>;
const builtin = <Config,>(panel: PanelDefinition<Config, BridgeClient>) => panel;

function TopicsPanel({ client, topics, topicsLoading, refreshTopics }: Props<undefined>) {
  return (
    <>
      <TopicList
        topics={topics}
        loading={topicsLoading}
        onRefresh={refreshTopics}
        client={client}
      />
      <WidgetSettingsPortal>
        <SettingsSection title="Topics" keywords="search subscribe configuration">
          <p className="p-4 text-xs text-gray-400">
            Search and subscribe to topics directly in this panel. No additional configuration is
            needed.
          </p>
        </SettingsSection>
      </WidgetSettingsPortal>
    </>
  );
}

function PointCloudPanel({ client, topics, config, setConfig }: Props<{ topic: string }>) {
  const topic = config?.topic ?? CAMERA_TOPICS.DEPTH_POINTS;
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
              onCommit={(next) => setConfig({ topic: next })}
              topics={topics}
              messageType="sensor_msgs/msg/PointCloud2"
            />
          </label>
        </SettingsSection>
      </WidgetSettingsPortal>
    </>
  );
}

/** The panels MITI ships with, in the order Add panel lists them. */
export const BUILTIN_PANELS: AnyPanelDefinition[] = [
  builtin<undefined>({
    type: 'topics',
    label: 'Topics',
    description: "The bridge's topics, with a button to subscribe to each",
    icon: ListTree,
    component: TopicsPanel,
  }),
  builtin<URDFWidgetProps | SceneConfig | undefined>({
    type: 'urdf-viewer',
    label: '3D Scene',
    description: 'The robot model, TF and 3D topics',
    icon: Box,
    component: ({ client, topics, config, setConfig }) => (
      <SceneViewer client={client} topics={topics} props={config} onPropsChange={setConfig} />
    ),
  }),
  builtin<{ topic: string }>({
    type: 'pointcloud-viewer',
    label: 'Point Cloud',
    description: 'One point cloud topic on its own',
    icon: Cloud,
    component: PointCloudPanel,
  }),
  builtin<CameraWidgetProps | ImagePanelConfig>({
    type: 'camera-viewer',
    label: 'Camera',
    description: 'A color or depth image, with 3D topics drawn over it',
    icon: Camera,
    defaultConfig: () => ({ topic: CAMERA_TOPICS.COLOR }),
    component: ({ client, topics, config, setConfig }) => (
      <CameraViewer client={client} topics={topics} props={config} onPropsChange={setConfig} />
    ),
  }),
  builtin<StateMachineWidgetProps | undefined>({
    type: 'state-machine',
    label: 'State Machine',
    description: 'SMACC2 state machines and behavior trees',
    icon: GitBranch,
    component: ({ client, config, updateConfig }) => (
      <StateMachineMonitor
        client={client}
        smaccTopic={config?.smaccTopic}
        btStatusTopic={config?.btStatusTopic}
        onConfigChange={updateConfig}
      />
    ),
  }),
  builtin<ButtonSwitchWidgetProps | undefined>({
    type: 'button-switch',
    label: 'Button Switch',
    description: 'A button that publishes a message or calls a service',
    icon: ToggleLeft,
    defaultConfig: () => ({}),
    component: ({ client, config, updateConfig }) => (
      <ButtonSwitchWidget client={client} props={config} onConfigChange={updateConfig} />
    ),
  }),
  builtin<LogWidgetProps | undefined>({
    type: 'log',
    label: 'Log',
    description: 'Messages from /rosout',
    icon: ScrollText,
    component: ({ client, topics, config, updateConfig }) => (
      <LogPanel client={client} topics={topics} props={config} onConfigChange={updateConfig} />
    ),
  }),
];
