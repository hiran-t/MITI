'use client';

import { useState, useEffect } from 'react';
import { useRosbridge } from '../hooks/useRosbridge';
import { useTopicList } from '../hooks/useTopicList';
import ConnectionStatus from './ConnectionStatus';
import TopicList from './TopicViewer/TopicList';
import URDFViewer from './Visualization/URDFViewer';
import PointCloudViewer from './Visualization/PointCloudViewer';
import { Activity } from 'lucide-react';

const STORAGE_KEY = 'vizzy_rosbridge_url';

// Get initial URL from localStorage or environment variable
const getInitialUrl = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_ROSBRIDGE_URL || 'ws://localhost:9090';
};

export default function Dashboard() {
  const [rosbridgeUrl, setRosbridgeUrl] = useState(getInitialUrl);
  const { client, connected, error } = useRosbridge(rosbridgeUrl);
  const { topics, loading, refreshTopics } = useTopicList(client);

  // Update localStorage when URL changes
  const handleUrlChange = (newUrl: string) => {
    setRosbridgeUrl(newUrl);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newUrl);
    }
    // Page will automatically reconnect due to useRosbridge dependency on rosbridgeUrl
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Vizzy
              </h1>
              <p className="text-sm text-gray-400">ROS2 Web Dashboard</p>
            </div>
          </div>
          
          <ConnectionStatus
            connected={connected}
            url={rosbridgeUrl}
            onUrlChange={handleUrlChange}
          />
          
          {error && (
            <div className="mt-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">
                Connection error: {error.message}
              </p>
            </div>
          )}
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {/* Topic List - Left Panel */}
          <div className="lg:col-span-1 bg-gray-900/30 backdrop-blur-sm rounded-lg border border-gray-800 p-4 overflow-hidden">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              Topics
            </h2>
            <TopicList
              topics={topics}
              loading={loading}
              onRefresh={refreshTopics}
              client={client}
            />
          </div>

          {/* Visualization Panels - Right Side */}
          <div className="lg:col-span-2 grid grid-rows-2 gap-4">
            {/* URDF Viewer */}
            <div className="relative">
              <URDFViewer client={client} />
            </div>

            {/* Point Cloud Viewer */}
            <div className="relative">
              <PointCloudViewer client={client} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 text-center text-xs text-gray-500">
          <p>
            ROS2 Web Dashboard • Built with Next.js, React Three Fiber, and rosbridge
          </p>
        </footer>
      </div>
    </div>
  );
}
