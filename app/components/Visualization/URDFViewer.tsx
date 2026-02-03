'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/app/hooks/useTopic';
import { useTF } from '@/app/hooks/useTF';
import Scene3D from './Scene3D';
import { Loader2, Download } from 'lucide-react';
import URDFSourceSelector from './URDFSourceSelector';
import URDFSettings from './URDFSettings';
import URDFLoadStatus from './URDFLoadStatus';
import PointCloudRenderer from './PointCloudRenderer';
import TFVisualizer from './TFVisualizer';
import URDFModel from './URDFModel';
import { useUrdfUrlLoader } from './hooks/useUrdfUrlLoader';
import { sensor_msgs } from '@/types/ros-messages';
import * as THREE from 'three';

interface URDFViewerProps {
  client: ROSBridge | null;
  // Mode selection
  mode?: 'topic' | 'url';
  // For topic mode
  topic?: string;
  // For URL mode
  urdfUrl?: string;
  meshBaseUrl?: string;
  packageMapping?: Record<string, string>;
  // Point cloud topics
  pointCloudTopics?: string[];
  // Callbacks
  onModeChange?: (mode: 'topic' | 'url') => void;
  onTopicChange?: (topic: string) => void;
  onUrdfUrlChange?: (url: string) => void;
  onMeshBaseUrlChange?: (url: string) => void;
  onPackageMappingChange?: (mapping: Record<string, string>) => void;
  onPointCloudTopicsChange?: (topics: string[]) => void;
}


export default function URDFViewer({
  client,
  mode: initialMode = 'topic',
  topic: initialTopic = '/robot_description',
  urdfUrl: initialUrdfUrl = '',
  meshBaseUrl: initialMeshBaseUrl = '',
  packageMapping: initialPackageMapping = {},
  pointCloudTopics: initialPointCloudTopics = [],
  onModeChange,
  onTopicChange,
  onUrdfUrlChange,
  onMeshBaseUrlChange,
  onPackageMappingChange,
  onPointCloudTopicsChange,
}: URDFViewerProps) {
  const [currentMode, setCurrentMode] = useState<'topic' | 'url'>(initialMode);
  const [currentTopic, setCurrentTopic] = useState(initialTopic);
  const [currentUrdfUrl, setCurrentUrdfUrl] = useState(initialUrdfUrl);
  const [currentMeshBaseUrl, setCurrentMeshBaseUrl] = useState(initialMeshBaseUrl);
  const [currentPackageMapping, setCurrentPackageMapping] = useState(initialPackageMapping);
  const [currentPointCloudTopics, setCurrentPointCloudTopics] = useState<string[]>(initialPointCloudTopics);
  const [modelLoading, setModelLoading] = useState(false);
  const [showTF, setShowTF] = useState(true); // Toggle TF visualization
  const [baseLinkTransform, setBaseLinkTransform] = useState<{
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  } | null>(null);
  const [tfSettings, setTfSettings] = useState({
    showAxes: true,
    showConnections: true,
    showLabels: false,
    axisLength: 0.15, // ขนาดของ coordinate axes
  });

  const urlLoader = useUrdfUrlLoader();
  // Extract stable functions to use in dependency arrays
  const { loadFromUrl, reset, setLoadProgress } = urlLoader;

  // Subscribe to TF topics
  const { tfTree } = useTF({
    rosbridgeClient: client,
    enabled: showTF,
  });



  // Use topic subscription for topic mode
  const { data: urdfData } = useTopic<{ data: string }>(
    currentMode === 'topic' ? client : null,
    currentTopic,
    'std_msgs/String'
  );

  // Get URDF string based on current mode
  const urdfString = currentMode === 'topic' ? urdfData?.data : urlLoader.urdfContent;

  // Subscribe to joint_states topic for robot motion (only when URDF is loaded)
  const { data: jointStatesData } = useTopic<sensor_msgs.JointState>(
    urdfString ? client : null,
    '/robot_inbound/joint_states',
    'sensor_msgs/JointState'
  );

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: 'topic' | 'url') => {
      setCurrentMode(newMode);
      reset();
      if (onModeChange) {
        onModeChange(newMode);
      }
    },
    [onModeChange, reset]
  );

  // Handle URL loading
  const handleLoadFromUrl = useCallback(() => {
    loadFromUrl({
      urdfUrl: currentUrdfUrl,
      meshBaseUrl: currentMeshBaseUrl,
      packageMapping: currentPackageMapping,
    });
  }, [currentUrdfUrl, currentMeshBaseUrl, currentPackageMapping, loadFromUrl]);

  // Handle preset loading
  const handleLoadPreset = useCallback(
    (preset: { urdfUrl: string; meshBaseUrl: string; packageMapping: Record<string, string> }) => {
      setCurrentUrdfUrl(preset.urdfUrl);
      setCurrentMeshBaseUrl(preset.meshBaseUrl);
      setCurrentPackageMapping(preset.packageMapping);
    },
    []
  );

  // Memoize callbacks to prevent unnecessary URDFModel reloads
  const handleModelLoadStart = useCallback(() => {
    setModelLoading(true);
  }, []);

  const handleModelLoadComplete = useCallback(() => {
    setModelLoading(false);
  }, []);

  const handleModelLoadError = useCallback(() => {
    setModelLoading(false);
    // Error is already handled by URDFModel internally
  }, []);

  const handleModelLoadProgress = useCallback(
    (loaded: number, total: number) => {
      setLoadProgress({ loaded, total });
    },
    [setLoadProgress]
  );

  const handleBaseLinkTransform = useCallback(
    (position: THREE.Vector3, quaternion: THREE.Quaternion) => {
      setBaseLinkTransform({ position, quaternion });
    },
    []
  );

  // Removed auto-load - now requires manual "Load URDF" button press

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
      {/* Header */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800">
            URDF Viewer
            {currentMode === 'topic' && urdfData && (
              <span className="ml-2 text-green-400">• Connected</span>
            )}
            {currentMode === 'url' && urlLoader.urdfContent && (
              <span className="ml-2 text-purple-400">• Loaded</span>
            )}
          </div>

          <URDFSourceSelector 
            mode={currentMode} 
            onModeChange={handleModeChange}
            topic={currentTopic}
            onTopicChange={(topic) => {
              setCurrentTopic(topic);
              if (onTopicChange) onTopicChange(topic);
            }}
            urdfUrl={currentUrdfUrl}
            onUrdfUrlChange={(url) => {
              setCurrentUrdfUrl(url);
              if (onUrdfUrlChange) onUrdfUrlChange(url);
            }}
            meshBaseUrl={currentMeshBaseUrl}
            onMeshBaseUrlChange={(url) => {
              setCurrentMeshBaseUrl(url);
              if (onMeshBaseUrlChange) onMeshBaseUrlChange(url);
            }}
            onLoadUrl={handleLoadFromUrl}
            isLoadingUrl={urlLoader.loading}
          />
        </div>

        <URDFSettings 
          onLoadPreset={handleLoadPreset}
          pointCloudTopics={currentPointCloudTopics}
          onPointCloudTopicsChange={(topics) => {
            setCurrentPointCloudTopics(topics);
            if (onPointCloudTopicsChange) onPointCloudTopicsChange(topics);
          }}
        />

        {/* TF Visualization Toggle */}
        <button
          onClick={() => setShowTF(!showTF)}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
            showTF
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30'
              : 'bg-gray-800/90 text-gray-400 border-gray-700 hover:bg-gray-700/90'
          }`}
          title="Toggle TF visualization"
        >
          🔗 TF
        </button>
      </div>

      {/* Loading/Error Status */}
      {(urlLoader.loading || urlLoader.error || modelLoading) && (
        <URDFLoadStatus
          loading={urlLoader.loading || modelLoading}
          error={urlLoader.error}
          progress={urlLoader.loadProgress || undefined}
          onClose={() => {
            urlLoader.reset();
            setModelLoading(false);
          }}
        />
      )}

      {/* 3D Scene */}
      {!urdfString ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {currentMode === 'topic' ? (
              <>
                <Loader2 className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Waiting for {currentTopic} topic...
                </p>
              </>
            ) : (
              <>
                <Download className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Enter a URDF URL and click Load
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <Scene3D>
          <URDFModel 
            urdfString={urdfString}
            meshBaseUrl={currentMeshBaseUrl || undefined}
            packageMapping={currentPackageMapping}
            jointStates={jointStatesData}
            onLoadStart={handleModelLoadStart}
            onLoadComplete={handleModelLoadComplete}
            onLoadError={handleModelLoadError}
            onLoadProgress={handleModelLoadProgress}
            onBaseLinkTransform={handleBaseLinkTransform}
          />
          
          {/* Render point clouds from configured topics */}
          {currentPointCloudTopics.map((topic) => (
            <PointCloudRenderer 
              key={topic}
              client={client}
              topic={topic}
            />
          ))}
          
          {/* TF Visualization */}
          {showTF && baseLinkTransform && (
            <TFVisualizer
              tfTree={tfTree}
              showAxes={tfSettings.showAxes}
              showConnections={tfSettings.showConnections}
              showLabels={tfSettings.showLabels}
              axisLength={tfSettings.axisLength}
              baseFrame="base_link"
              baseLinkPosition={baseLinkTransform.position}
              baseLinkQuaternion={baseLinkTransform.quaternion}
            />
          )}
        </Scene3D>
      )}
    </div>
  );
}
