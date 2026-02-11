'use client';

import Image from 'next/image';
import { useRosbridge } from '@/hooks/useRosbridge';
import { useTopicList } from '@/hooks/useTopicList';
import { useLayoutConfig } from '@/hooks/useLayoutConfig';
import { useUrdfConfig } from '@/hooks/useUrdfConfig';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ConnectionStatus from '../connection/ConnectionStatus';
import DraggableGridLayout from '../layout/DraggableGridLayout';
import LayoutConfigPanel from '../layout/LayoutConfig';
import AddWidgetButton from '../layout/AddWidgetButton';
import { dashboardStyles } from '@/styles';

const STORAGE_KEY_ROSBRIDGE_URL = 'miti_rosbridge_url';
const DEFAULT_ROSBRIDGE_URL = process.env.NEXT_PUBLIC_ROSBRIDGE_URL || 'ws://localhost:9090';

export default function Dashboard() {
  const [rosbridgeUrl, setRosbridgeUrl] = useLocalStorage(
    STORAGE_KEY_ROSBRIDGE_URL,
    DEFAULT_ROSBRIDGE_URL
  );
  const { client, connected, error } = useRosbridge(rosbridgeUrl);
  const { topics, loading, refreshTopics } = useTopicList(client);
  const { layout, addWidget, removeWidget, updateLayout, resetLayout, toggleLock } =
    useLayoutConfig();
  const urdfConfig = useUrdfConfig();

  const handleUrlChange = (newUrl: string) => {
    setRosbridgeUrl(newUrl);
  };

  return (
    <div className={dashboardStyles.container}>
      <div className={dashboardStyles.wrapper}>
        {/* Compact Header */}
        <header className={dashboardStyles.header.container}>
          <div className={dashboardStyles.header.toolbar}>
            {/* Logo and Title */}
            <div className={dashboardStyles.header.logoSection}>
              <Image
                src="/main_logo.svg"
                alt="MITI Logo"
                width={120}
                height={40}
                priority
                className={dashboardStyles.header.logo}
              />
            </div>

            {/* Connection Status and Layout Config */}
            <div className={dashboardStyles.header.actionsSection}>
              <ConnectionStatus
                connected={connected}
                url={rosbridgeUrl}
                onUrlChange={handleUrlChange}
              />
              <LayoutConfigPanel onAddWidget={addWidget} onResetLayout={resetLayout} />
            </div>
          </div>

          {error && (
            <div className={dashboardStyles.header.errorBanner}>
              Connection error: {error.message}
            </div>
          )}
        </header>

        {/* Main Content - Draggable Widget Grid */}
        <main className={dashboardStyles.main.container}>
          <DraggableGridLayout
            widgets={layout.widgets}
            onLayoutChange={updateLayout}
            onRemoveWidget={removeWidget}
            onToggleLock={toggleLock}
            client={client}
            topics={topics}
            topicsLoading={loading}
            onRefreshTopics={refreshTopics}
            urdfConfig={urdfConfig.config}
            onUrdfConfigChange={{
              onModeChange: urdfConfig.setMode,
              onTopicChange: urdfConfig.setTopic,
              onUrdfUrlChange: urdfConfig.setUrdfUrl,
              onMeshBaseUrlChange: urdfConfig.setMeshBaseUrl,
              onPackageMappingChange: urdfConfig.setPackageMapping,
            }}
          />

          {/* Floating Add Widget Button */}
          <AddWidgetButton onAddWidget={addWidget} />
        </main>
      </div>
    </div>
  );
}
