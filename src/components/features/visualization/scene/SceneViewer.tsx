'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import * as THREE from 'three';
import WidgetSettingsPortal from '../../layout/WidgetSettingsPortal';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import { useTF } from '@/hooks/useTF';
import { lookupTransform } from '@/lib/scene/transforms';
import { autoFixedFrame, normalizeSceneConfig } from '@/lib/scene/scene-config';
import type { PublishType, SceneConfig, ViewSettings } from '@/types/scene-config';
import { visualizationStyles } from '@/styles';
import SceneCanvas, { type RenderStats } from './SceneCanvas';
import PublishTool, { type PublishTarget } from './PublishTool';
import SceneSettings from './SceneSettings';
import SceneLayers, {
  useLayerReports,
  useTFFrames,
  useTopicRows,
  visibleProblems,
} from './SceneLayers';

const IDENTITY = new THREE.Matrix4();

const PUBLISH_TOOLS: Record<PublishType, { label: string; icon: typeof MapPin; hint: string }> = {
  point: { label: 'Publish point', icon: MapPin, hint: 'Click to publish a point' },
  pose: {
    label: 'Publish pose',
    icon: Navigation,
    hint: 'Drag toward the heading to publish a pose',
  },
  pose_estimate: {
    label: 'Publish pose estimate',
    icon: LocateFixed,
    hint: 'Drag toward the heading to publish a pose estimate',
  },
};

function stamp() {
  const ms = Date.now();
  return { sec: Math.floor(ms / 1000), nanosec: (ms % 1000) * 1e6 };
}

/** The 3D Scene panel: a Foxglove-style scene with its settings in the sidebar. */
export default function SceneViewer({
  client,
  topics = [],
  props,
  onPropsChange,
}: {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  /** Stored widget props; older layouts are migrated on read. */
  props: unknown;
  onPropsChange: (config: SceneConfig) => void;
}) {
  const config = useMemo(() => normalizeSceneConfig(props), [props]);
  const { frame, scene, transforms, publish } = config;
  const { statuses, reportStatus, layerInfo, reportInfo, seenFrames, reportFrame } =
    useLayerReports();
  const [publishing, setPublishing] = useState(false);
  const [stats, setStats] = useState<RenderStats | null>(null);
  const [meshEpoch, setMeshEpoch] = useState(0);
  const reloadRobots = async () => {
    await client?.clearAssetCache();
    setMeshEpoch((epoch) => epoch + 1);
  };

  const { tfTree } = useTF({
    client,
    tfTopics: transforms.tfTopics,
    staticTopics: transforms.staticTfTopics,
  });

  const { frames, roots } = useTFFrames(tfTree);
  const fixedFrame = frame.fixedFrame || autoFixedFrame(roots, frames, seenFrames) || 'base_link';
  const displayFrame = frame.displayFrame || fixedFrame;

  const follow = useMemo(() => {
    if (frame.followMode === 'fixed' || displayFrame === fixedFrame) return IDENTITY;
    try {
      const pose = lookupTransform(tfTree, fixedFrame, displayFrame);
      return frame.followMode === 'position'
        ? new THREE.Matrix4().makeTranslation(
            new THREE.Vector3().setFromMatrixPosition(pose).negate()
          )
        : pose.clone().invert();
    } catch {
      return IDENTITY;
    }
  }, [tfTree, fixedFrame, displayFrame, frame.followMode]);

  const topicRows = useTopicRows(topics, config.topics);

  // ── Publishing ──
  const advertised = useRef(new Set<string>());
  useEffect(() => {
    advertised.current = new Set();
  }, [client]);
  const send = (topic: string, type: string, message: unknown) => {
    if (!client) return;
    if (!advertised.current.has(`${topic}|${type}`)) {
      client.advertise(topic, type);
      advertised.current.add(`${topic}|${type}`);
    }
    client.publish(topic, message);
  };
  const handlePublish = ({ x, y, yaw = 0 }: PublishTarget) => {
    const header = { frame_id: fixedFrame, stamp: stamp() };
    const pose = {
      position: { x, y, z: 0 },
      orientation: { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) },
    };
    if (publish.type === 'point')
      send(publish.pointTopic, 'geometry_msgs/msg/PointStamped', {
        header,
        point: { x, y, z: 0 },
      });
    else if (publish.type === 'pose')
      send(publish.poseTopic, 'geometry_msgs/msg/PoseStamped', { header, pose });
    else {
      const covariance = new Array(36).fill(0);
      covariance[0] = publish.poseEstimateXDeviation ** 2;
      covariance[7] = publish.poseEstimateYDeviation ** 2;
      covariance[35] = publish.poseEstimateThetaDeviation ** 2;
      send(publish.poseEstimateTopic, 'geometry_msgs/msg/PoseWithCovarianceStamped', {
        header,
        pose: { pose, covariance },
      });
    }
    setPublishing(false);
  };
  useEffect(() => {
    if (!publishing) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setPublishing(false);
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, [publishing]);

  const onViewChange = useCallback(
    (view: ViewSettings) => onPropsChange({ ...config, view }),
    [config, onPropsChange]
  );

  const problems = visibleProblems(statuses, topicRows, config.layers);
  const tool = PUBLISH_TOOLS[publish.type];
  const ToolIcon = tool.icon;

  return (
    <div className={visualizationStyles.urdfViewer.container}>
      <SceneCanvas
        background={scene.background}
        view={config.view}
        onViewChange={onViewChange}
        follow={follow}
        controlsEnabled={!publishing}
        onStats={scene.renderStats ? setStats : undefined}
      >
        <SceneLayers
          client={client}
          topics={topics}
          topicRows={topicRows}
          layers={config.layers}
          tfTree={tfTree}
          fixedFrame={fixedFrame}
          displayFrame={displayFrame}
          sync={frame.syncTimestamps}
          transforms={transforms}
          scene={scene}
          meshEpoch={meshEpoch}
          onStatus={reportStatus}
          onInfo={reportInfo}
          onFrame={reportFrame}
        />
        {publishing && <PublishTool type={publish.type} onPublish={handlePublish} />}
      </SceneCanvas>

      <div className="scene-toolbar">
        <button
          type="button"
          className={`scene-tool ${publishing ? 'active' : ''}`}
          aria-label={tool.label}
          aria-pressed={publishing}
          title={client ? tool.label : 'Connect to ROS to publish'}
          disabled={!client}
          onClick={() => setPublishing(!publishing)}
        >
          <ToolIcon size={15} />
        </button>
      </div>
      {publishing && <div className="scene-tool-hint">{tool.hint} · Esc to cancel</div>}

      {scene.renderStats && stats && (
        <div className="scene-stats">
          {stats.fps} fps · {stats.calls} draw calls · {stats.triangles.toLocaleString()} tris
        </div>
      )}

      <div className="scene-status-overlay">
        <span>
          {client ? 'ROS connected' : 'ROS disconnected'} · Fixed frame: {fixedFrame}
          {displayFrame !== fixedFrame && ` · Display: ${displayFrame}`}
        </span>
        {problems.map(([id, status]) => (
          <span key={id} className="text-danger">
            {id.replace(/^(topic|layer):/, '')}: {status.message}
          </span>
        ))}
      </div>

      <WidgetSettingsPortal>
        <SceneSettings
          config={config}
          onChange={onPropsChange}
          topics={topics}
          topicRows={topicRows}
          frames={frames}
          tree={tfTree}
          fixedFrame={fixedFrame}
          displayFrame={displayFrame}
          statuses={statuses}
          layerInfo={layerInfo}
          onReloadRobots={reloadRobots}
        />
      </WidgetSettingsPortal>
    </div>
  );
}
