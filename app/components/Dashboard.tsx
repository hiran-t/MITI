'use client';

import Image from 'next/image';
import { useRosbridge } from '../hooks/useRosbridge';
import { useTopicList } from '../hooks/useTopicList';
import { useLayoutConfig } from '../hooks/useLayoutConfig';
import { useUrdfConfig } from '../hooks/useUrdfConfig';
import { useLocalStorage } from '../hooks/useLocalStorage';
import ConnectionStatus from './ConnectionStatus';
import DraggableGridLayout from './Layout/DraggableGridLayout';
import LayoutConfigPanel from './Layout/LayoutConfig';
import AddWidgetButton from './Layout/AddWidgetButton';

const STORAGE_KEY_ROSBRIDGE_URL = 'miti_rosbridge_url';
const DEFAULT_ROSBRIDGE_URL = process.env.NEXT_PUBLIC_ROSBRIDGE_URL || 'ws://localhost:9090';

export default function Dashboard() {
  const [rosbridgeUrl, setRosbridgeUrl] = useLocalStorage(
    STORAGE_KEY_ROSBRIDGE_URL,
    DEFAULT_ROSBRIDGE_URL
  );
  const { client, connected, error } = useRosbridge(rosbridgeUrl);
  const { topics, loading, refreshTopics } = useTopicList(client);
  const { layout, addWidget, removeWidget, updateLayout, resetLayout, toggleLock } = useLayoutConfig();
  const urdfConfig = useUrdfConfig();

  const handleUrlChange = (newUrl: string) => {
    setRosbridgeUrl(newUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
      <div className="flex-1 flex flex-col max-w-[1920px] mx-auto w-full">
        {/* Compact Header */}
        <header className="flex-shrink-0 p-3 border-b border-gray-800">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-2 ml-3">
              <Image
                src="/main_logo.svg"
                alt="MITI Logo"
                width={120}
                height={40}
                priority
                className="h-9 w-auto"
              />
            </div>
            
            {/* Connection Status and Layout Config */}
            <div className="flex items-center gap-3">
              <ConnectionStatus
                connected={connected}
                url={rosbridgeUrl}
                onUrlChange={handleUrlChange}
              />
              <LayoutConfigPanel
                onAddWidget={addWidget}
                onResetLayout={resetLayout}
              />
            </div>
          </div>
          
          {error && (
            <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              Connection error: {error.message}
            </div>
          )}
        </header>

        {/* Main Content - Draggable Widget Grid */}
        <main className="flex-1 p-4 relative">
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
