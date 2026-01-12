'use client';

import { useState, useEffect } from 'react';
import { useRosbridge } from '../hooks/useRosbridge';
import { useTopicList } from '../hooks/useTopicList';
import { useLayoutConfig } from '../hooks/useLayoutConfig';
import ConnectionStatus from './ConnectionStatus';
import DraggableGridLayout from './Layout/DraggableGridLayout';
import LayoutConfigPanel from './Layout/LayoutConfig';
import AddWidgetButton from './Layout/AddWidgetButton';
import { Activity } from 'lucide-react';

const STORAGE_KEY = 'vizzy_rosbridge_url';
const STORAGE_KEY_URDF_CONFIG = 'vizzy_urdf_config';

// Get initial URL from localStorage or environment variable
const getInitialUrl = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_ROSBRIDGE_URL || 'ws://localhost:9090';
};

// Get initial URDF config from localStorage
const getInitialUrdfConfig = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY_URDF_CONFIG);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse URDF config:', e);
      }
    }
  }
  return {
    mode: 'topic' as const,
    topic: '/robot_description',
    urdfUrl: '',
    meshBaseUrl: '',
    packageMapping: {},
  };
};

export default function Dashboard() {
  const [rosbridgeUrl, setRosbridgeUrl] = useState(getInitialUrl);
  const { client, connected, error } = useRosbridge(rosbridgeUrl);
  const { topics, loading, refreshTopics } = useTopicList(client);
  const { layout, addWidget, removeWidget, updateLayout, resetLayout } = useLayoutConfig();

  // URDF Configuration state
  const [urdfConfig, setUrdfConfig] = useState<{
    mode: 'topic' | 'url';
    topic: string;
    urdfUrl: string;
    meshBaseUrl: string;
    packageMapping: Record<string, string>;
  }>(getInitialUrdfConfig);

  // Update localStorage when URL changes
  const handleUrlChange = (newUrl: string) => {
    setRosbridgeUrl(newUrl);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newUrl);
    }
    // Page will automatically reconnect due to useRosbridge dependency on rosbridgeUrl
  };

  // Update localStorage when URDF config changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_URDF_CONFIG, JSON.stringify(urdfConfig));
    }
  }, [urdfConfig]);

  // URDF config handlers
  const handleUrdfModeChange = (mode: 'topic' | 'url') => {
    setUrdfConfig(prev => ({ ...prev, mode }));
  };

  const handleUrdfTopicChange = (topic: string) => {
    setUrdfConfig(prev => ({ ...prev, topic }));
  };

  const handleUrdfUrlChange = (urdfUrl: string) => {
    setUrdfConfig(prev => ({ ...prev, urdfUrl }));
  };

  const handleMeshBaseUrlChange = (meshBaseUrl: string) => {
    setUrdfConfig(prev => ({ ...prev, meshBaseUrl }));
  };

  const handlePackageMappingChange = (packageMapping: Record<string, string>) => {
    setUrdfConfig(prev => ({ ...prev, packageMapping }));
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
      <div className="flex-1 flex flex-col max-w-[1920px] mx-auto w-full">
        {/* Compact Header */}
        <header className="flex-shrink-0 p-3 border-b border-gray-800">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 rounded">
                <Activity className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Vizzy
                </h1>
              </div>
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
        <main className="flex-1 overflow-auto p-4 relative">
          <DraggableGridLayout
            widgets={layout.widgets}
            onLayoutChange={updateLayout}
            onRemoveWidget={removeWidget}
            client={client}
            topics={topics}
            topicsLoading={loading}
            onRefreshTopics={refreshTopics}
            urdfConfig={urdfConfig}
            onUrdfConfigChange={{
              onModeChange: handleUrdfModeChange,
              onTopicChange: handleUrdfTopicChange,
              onUrdfUrlChange: handleUrdfUrlChange,
              onMeshBaseUrlChange: handleMeshBaseUrlChange,
              onPackageMappingChange: handlePackageMappingChange,
            }}
          />
          
          {/* Floating Add Widget Button */}
          <AddWidgetButton onAddWidget={addWidget} />
        </main>
      </div>
    </div>
  );
}
