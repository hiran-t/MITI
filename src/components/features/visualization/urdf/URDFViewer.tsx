'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import WidgetSettingsPortal, { SettingsSection } from '../../layout/WidgetSettingsPortal';
import type { URDFWidgetProps } from '@/types/widget';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import { useTF } from '@/hooks/useTF';
import Scene3D from './Scene3D';
import URDFSourceSelector from './URDFSourceSelector';
import URDFSettings from './URDFSettings';
import URDFLoadStatus from './URDFLoadStatus';
import SceneLayer from '../scene/SceneLayer';
import LayerSettings from '../scene/LayerSettings';
import { lookupTransform } from '@/lib/scene/transforms';
import type { SceneLayerConfig, LayerStatus } from '@/types/scene';
import type { TopicInfo } from '@/lib/rosbridge/types';
import TFVisualizer from '../tf/TFVisualizer';
import URDFModel from './URDFModel';
import { useUrdfUrlLoader } from '../hooks/useUrdfUrlLoader';
import { sensor_msgs } from '@/types/ros-messages';
import * as THREE from 'three';
import { visualizationStyles } from '@/styles';
import { TF_TOPICS } from '@/constants/ros-topics';

const DEFAULT_TF_TOPICS = [TF_TOPICS.DYNAMIC, TF_TOPICS.STATIC];
const EMPTY_POINT_CLOUD_TOPICS: string[] = [];

interface URDFViewerProps {
  client: ROSBridge | null;
  config: URDFWidgetProps;
  topics?: TopicInfo[];
  onConfigChange: (config: Partial<URDFWidgetProps>) => void;
}

export default function URDFViewer({
  client,
  config,
  onConfigChange,
  topics = [],
}: URDFViewerProps) {
  const {
    mode: currentMode,
    topic: currentTopic,
    urdfUrl: currentUrdfUrl,
    meshBaseUrl: currentMeshBaseUrl,
    packageMapping: currentPackageMapping,
    pointCloudTopics: currentPointCloudTopics = EMPTY_POINT_CLOUD_TOPICS,
    jointStatesTopic = '/robot_inbound/joint_states',
    tfTopics = DEFAULT_TF_TOPICS,
    showTF = true,
    fixedFrame = 'base_link',
    robotFrame = 'base_link',
    syncTransforms = true,
  } = config;
  const [modelLoading, setModelLoading] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, LayerStatus>>({});
  const [modelError, setModelError] = useState('');
  const layers = useMemo<SceneLayerConfig[]>(
    () =>
      config.layers ??
      currentPointCloudTopics.map((topic, index) => ({
        id: `legacy-cloud-${index}`,
        type: 'pointcloud',
        topic,
        enabled: true,
      })),
    [config.layers, currentPointCloudTopics]
  );
  const reportStatus = useCallback(
    (id: string, status: LayerStatus) =>
      setStatuses((previous) =>
        previous[id]?.level === status.level && previous[id]?.message === status.message
          ? previous
          : { ...previous, [id]: status }
      ),
    []
  );
  const urlLoader = useUrdfUrlLoader();
  // Extract stable functions to use in dependency arrays
  const { loadFromUrl, reset, setLoadProgress } = urlLoader;

  // Subscribe to TF topics
  const { tfTree } = useTF({
    rosbridgeClient: client,
    enabled: true,
    tfTopics,
    staticTopics: config.staticTfTopics,
  });

  // Use topic subscription for topic mode
  const { data: urdfData } = useTopic<{ data: string }>(
    currentMode === 'topic' ? client : null,
    currentTopic,
    'std_msgs/msg/String'
  );

  // Get URDF string based on current mode
  const urdfString = currentMode === 'topic' ? urdfData?.data : urlLoader.urdfContent;

  // Subscribe to joint_states topic for robot motion (only when URDF is loaded)
  const { data: jointStatesData } = useTopic<sensor_msgs.JointState>(
    urdfString ? client : null,
    jointStatesTopic,
    'sensor_msgs/msg/JointState'
  );

  useEffect(() => {
    if (currentMode !== 'url') return;
    reset();
    if (!currentUrdfUrl.trim()) return;
    const timer = setTimeout(
      () =>
        loadFromUrl({
          urdfUrl: currentUrdfUrl,
          meshBaseUrl: currentMeshBaseUrl,
          packageMapping: currentPackageMapping,
        }),
      500
    );
    return () => clearTimeout(timer);
  }, [currentMode, currentUrdfUrl, currentMeshBaseUrl, currentPackageMapping, loadFromUrl, reset]);

  // Handle mode change
  const handleModeChange = (mode: 'topic' | 'url') => {
    reset();
    onConfigChange({ mode });
  };

  // Handle URL loading
  const handleLoadFromUrl = useCallback(() => {
    loadFromUrl({
      urdfUrl: currentUrdfUrl,
      meshBaseUrl: currentMeshBaseUrl,
      packageMapping: currentPackageMapping,
    });
  }, [currentUrdfUrl, currentMeshBaseUrl, currentPackageMapping, loadFromUrl]);

  const handleLoadPreset = (preset: {
    urdfUrl: string;
    meshBaseUrl: string;
    packageMapping: Record<string, string>;
  }) => {
    reset();
    onConfigChange({ ...preset, mode: 'url' });
  };

  // Memoize callbacks to prevent unnecessary URDFModel reloads
  const handleModelLoadStart = useCallback(() => {
    setModelLoading(true);
    setModelError('');
  }, []);

  const handleModelLoadComplete = useCallback(() => {
    setModelLoading(false);
  }, []);

  const handleModelLoadError = useCallback((error: Error) => {
    setModelLoading(false);
    setModelError(error.message);
  }, []);

  const handleModelLoadProgress = useCallback(
    (loaded: number, total: number) => {
      setLoadProgress({ loaded, total });
    },
    [setLoadProgress]
  );

  const robotTransform = useMemo(() => {
    try {
      return { matrix: lookupTransform(tfTree, fixedFrame, robotFrame), error: '' };
    } catch (error) {
      return {
        matrix: null,
        error: error instanceof Error ? error.message : 'Missing robot transform',
      };
    }
  }, [tfTree, fixedFrame, robotFrame]);
  const frames = Array.from(
    new Set([
      fixedFrame,
      ...Array.from(tfTree.frames.keys()),
      ...Array.from(tfTree.frames.values()).flatMap((frame) =>
        frame.parent ? [frame.parent] : []
      ),
    ])
  ).sort();
  const layerProblems = layers.filter(
    (layer) => layer.enabled && statuses[layer.id]?.level === 'error'
  );

  return (
    <div className={visualizationStyles.urdfViewer.container}>
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

      <Scene3D>
        {urdfString && robotTransform.matrix && (
          <group matrix={robotTransform.matrix} matrixAutoUpdate={false}>
            <URDFModel
              urdfString={urdfString}
              meshBaseUrl={currentMeshBaseUrl || undefined}
              packageMapping={currentPackageMapping}
              jointStates={jointStatesData}
              onLoadStart={handleModelLoadStart}
              onLoadComplete={handleModelLoadComplete}
              onLoadError={handleModelLoadError}
              onLoadProgress={handleModelLoadProgress}
            />
          </group>
        )}
        {layers.map((layer) => (
          <SceneLayer
            key={layer.id}
            layer={layer}
            client={client}
            tree={tfTree}
            fixedFrame={fixedFrame}
            sync={syncTransforms}
            onStatus={reportStatus}
            meshBaseUrl={currentMeshBaseUrl}
            packages={currentPackageMapping}
          />
        ))}
        {showTF && <TFVisualizer tfTree={tfTree} fixedFrame={fixedFrame} />}
      </Scene3D>
      <div className="scene-status-overlay" role="status">
        <span>
          {client ? 'ROS connected' : 'Disconnected'} · Fixed frame: {fixedFrame || 'Not set'}
        </span>
        {!urdfString && (
          <span>
            Robot: {currentMode === 'url' ? 'Choose a URDF URL' : 'waiting for robot description'} ·
            Other layers remain available
          </span>
        )}
        {urdfString && robotTransform.error && (
          <span className="text-amber-300">{robotTransform.error}</span>
        )}
        {modelError && <span className="text-red-300">Robot: {modelError}</span>}
        {layerProblems.length > 0 && (
          <span className="text-amber-300">
            {layerProblems.length} layer error(s) · Open Panel settings for details
          </span>
        )}
      </div>

      <WidgetSettingsPortal>
        <SettingsSection title="Robot source" keywords="ROS topic name URDF URL mesh base mode">
          <URDFSourceSelector
            mode={currentMode}
            onModeChange={handleModeChange}
            topic={currentTopic}
            onTopicChange={(topic) => onConfigChange({ topic })}
            urdfUrl={currentUrdfUrl}
            onUrdfUrlChange={(urdfUrl) => onConfigChange({ urdfUrl })}
            meshBaseUrl={currentMeshBaseUrl}
            onMeshBaseUrlChange={(meshBaseUrl) => onConfigChange({ meshBaseUrl })}
            onLoadUrl={handleLoadFromUrl}
            isLoadingUrl={urlLoader.loading}
          />
        </SettingsSection>
        <SettingsSection title="Frame" keywords="fixed robot root sync transforms TF">
          <label className="scene-field">
            Fixed frame
            <input
              list="scene-frames"
              value={fixedFrame}
              onChange={(e) => onConfigChange({ fixedFrame: e.target.value })}
            />
          </label>
          <datalist id="scene-frames">
            {frames.map((frame) => (
              <option key={frame} value={frame} />
            ))}
          </datalist>
          <label className="scene-field">
            Robot root frame
            <input
              value={robotFrame}
              onChange={(e) => onConfigChange({ robotFrame: e.target.value })}
            />
          </label>
          <label className="scene-field">
            Static TF topics
            <input
              value={(
                config.staticTfTopics ?? tfTopics.filter((topic) => topic.includes('static'))
              ).join(',')}
              onChange={(e) =>
                onConfigChange({
                  staticTfTopics: e.target.value.split(',').map((topic) => topic.trim()),
                })
              }
            />
          </label>
          <p className="text-xs text-gray-400">
            Comma-separated static transform topics; these do not expire.
          </p>
          <label className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              checked={syncTransforms}
              onChange={(e) => onConfigChange({ syncTransforms: e.target.checked })}
            />
            Use message timestamps for TF
          </label>
          <p className="text-xs text-gray-400">
            Disable timestamp matching only when your source does not provide synchronized
            timestamps.
          </p>
        </SettingsSection>
        <SettingsSection title="Scene" keywords="show TF frames">
          <label className="flex items-center gap-2 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={showTF}
              onChange={(event) => onConfigChange({ showTF: event.target.checked })}
            />
            Show TF frames
          </label>
        </SettingsSection>
        <URDFSettings
          onLoadPreset={handleLoadPreset}
          jointStatesTopic={jointStatesTopic}
          onJointStatesTopicChange={(jointStatesTopic) => onConfigChange({ jointStatesTopic })}
          tfTopics={tfTopics}
          onTfTopicsChange={(tfTopics) => onConfigChange({ tfTopics })}
        />
        <LayerSettings
          layers={layers}
          topics={topics}
          statuses={statuses}
          onChange={(layers) => onConfigChange({ layers })}
        />
      </WidgetSettingsPortal>
    </div>
  );
}
