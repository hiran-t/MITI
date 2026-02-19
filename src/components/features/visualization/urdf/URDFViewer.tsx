'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import { useTF } from '@/hooks/useTF';
import Scene3D from './Scene3D';
import { Loader2, Download } from 'lucide-react';
import URDFSourceSelector from './URDFSourceSelector';
import URDFSettings from './URDFSettings';
import URDFLoadStatus from './URDFLoadStatus';
import PointCloudRenderer from '../pointcloud/PointCloudRenderer';
import TFVisualizer from '../tf/TFVisualizer';
import URDFModel from './URDFModel';
import { useUrdfUrlLoader } from '../hooks/useUrdfUrlLoader';
import { sensor_msgs } from '@/types/ros-messages';
import * as THREE from 'three';
import { visualizationStyles } from '@/styles';

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
  const [currentPointCloudTopics, setCurrentPointCloudTopics] =
    useState<string[]>(initialPointCloudTopics);
  const [modelLoading, setModelLoading] = useState(false);
  // Dynamic joint_states topic
  const [jointStatesTopic, setJointStatesTopic] = useState('/robot_inbound/joint_states');
  // Dynamic tf topics
  const [tfTopics, setTfTopics] = useState<string[]>(['/tf', '/tf_static']);
  const [showTF, setShowTF] = useState(true); // Toggle TF visualization
  const [baseLinkTransform, setBaseLinkTransform] = useState<{
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  } | null>(null);
  const [tfSettings, setTfSettings] = useState({
    showAxes: true,
    showConnections: true,
    showLabels: false,
    axisLength: 0.15, // size of coordinate axes
  });

  const urlLoader = useUrdfUrlLoader();
  // Extract stable functions to use in dependency arrays
  const { loadFromUrl, reset, setLoadProgress } = urlLoader;

  // Subscribe to TF topics
  const { tfTree } = useTF({
    rosbridgeClient: client,
    enabled: showTF,
    tfTopics,
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
    jointStatesTopic,
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

  // Auto-load URDF from URL when mode is 'url' and urdfUrl is set and client is connected
  useEffect(() => {
    if (
      currentMode === 'url' &&
      currentUrdfUrl &&
      client?.isConnected &&
      !urlLoader.urdfContent &&
      !urlLoader.loading
    ) {
      loadFromUrl({
        urdfUrl: currentUrdfUrl,
        meshBaseUrl: currentMeshBaseUrl,
        packageMapping: currentPackageMapping,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMode, currentUrdfUrl, client?.isConnected]);

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
    <div className={visualizationStyles.urdfViewer.container}>
      {/* Header */}
      <div className={visualizationStyles.urdfViewer.headerBar}>
        <div className={visualizationStyles.urdfViewer.headerLeft}>
          <div className={visualizationStyles.urdfViewer.badge}>
            URDF Viewer
            {currentMode === 'topic' && urdfData && (
              <span className={visualizationStyles.urdfViewer.badgeConnected}>• Connected</span>
            )}
            {currentMode === 'url' && urlLoader.urdfContent && (
              <span className={visualizationStyles.urdfViewer.badgeLoaded}>• Loaded</span>
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

          {/* moved joint_states and tf topic config to settings */}
        </div>

        <URDFSettings
          onLoadPreset={handleLoadPreset}
          pointCloudTopics={currentPointCloudTopics}
          onPointCloudTopicsChange={(topics) => {
            setCurrentPointCloudTopics(topics);
            if (onPointCloudTopicsChange) onPointCloudTopicsChange(topics);
          }}
          jointStatesTopic={jointStatesTopic}
          onJointStatesTopicChange={setJointStatesTopic}
          tfTopics={tfTopics}
          onTfTopicsChange={setTfTopics}
        />

        {/* TF Visualization Toggle */}
        <button
          onClick={() => setShowTF(!showTF)}
          className={`${visualizationStyles.urdfViewer.tfToggleButton} ${
            showTF
              ? visualizationStyles.urdfViewer.tfToggleActive
              : visualizationStyles.urdfViewer.tfToggleInactive
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
        <div className={visualizationStyles.urdfViewer.emptyState}>
          <div className={visualizationStyles.urdfViewer.emptyContent}>
            {currentMode === 'topic' ? (
              <>
                <Loader2 className={visualizationStyles.urdfViewer.emptyIconSpin} />
                <p className={visualizationStyles.urdfViewer.emptyText}>
                  Waiting for {currentTopic} topic...
                </p>
              </>
            ) : (
              <>
                <Download className={visualizationStyles.urdfViewer.emptyIcon} />
                <p className={visualizationStyles.urdfViewer.emptyText}>
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
            <PointCloudRenderer key={topic} client={client} topic={topic} />
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
