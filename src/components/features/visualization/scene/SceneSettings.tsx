'use client';
import type { CSSProperties } from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import {
  ColorField,
  NumberField,
  SelectField,
  TextField,
  ToggleField,
  TreeField,
  TreeSection,
  Vec3Field,
} from '../../layout/SettingsTree';
import TopicInput from '../../topic-viewer/TopicInput';
import type { TopicInfo } from '@/lib/bridge/types';
import type { LayerStatus } from '@/types/scene';
import {
  DEFAULT_URDF_OPTIONS,
  DEFAULT_VIEW,
  newGridLayer,
  newUrdfLayer,
  type CustomLayerConfig,
  type FollowMode,
  type GridLayerConfig,
  type PublishType,
  type SceneConfig,
  type TopicLayerType,
  type TopicSettings,
  type UrdfDisplayMode,
  type UrdfLayerConfig,
  type UrdfOptions,
  type UrdfSource,
} from '@/types/scene-config';
import type { TFTree } from '@/types/tf-messages';

export interface TopicRow {
  topic: string;
  type: TopicLayerType;
  messageType: string;
  settings: TopicSettings;
  visible: boolean;
  published: boolean;
}

const FOLLOW_MODES: { value: FollowMode; label: string }[] = [
  { value: 'pose', label: 'Pose (position + attitude)' },
  { value: 'position', label: 'Position' },
  { value: 'fixed', label: 'Fixed' },
];
const DISPLAY_MODES: { value: UrdfDisplayMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'visual', label: 'Visual' },
  { value: 'collision', label: 'Collision' },
];
const URDF_SOURCES: { value: UrdfSource; label: string }[] = [
  { value: 'url', label: 'URL' },
  { value: 'filePath', label: 'File path' },
  { value: 'parameter', label: 'Parameter' },
  { value: 'topic', label: 'Topic' },
];
const PUBLISH_TYPES: { value: PublishType; label: string }[] = [
  { value: 'point', label: 'Point (geometry_msgs/PointStamped)' },
  { value: 'pose', label: 'Pose (geometry_msgs/PoseStamped)' },
  {
    value: 'pose_estimate',
    label: 'Pose estimate (geometry_msgs/PoseWithCovarianceStamped)',
  },
];
const IMAGE_TYPES = ['sensor_msgs/msg/Image', 'sensor_msgs/msg/CompressedImage'];

export const defaultLayerSize = (type: TopicLayerType) =>
  type === 'camera' ? 1 : ['pose', 'poses', 'odometry'].includes(type) ? 0.5 : 0.04;

const splitTopics = (value: string) =>
  value
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean);

export function StatusLine({ status, depth = 1 }: { status?: LayerStatus; depth?: number }) {
  if (!status || status.level === 'off') return null;
  const Icon =
    status.level === 'error' ? AlertCircle : status.level === 'ok' ? CheckCircle2 : Clock;
  const tone =
    status.level === 'error'
      ? 'text-red-300'
      : status.level === 'ok'
        ? 'text-emerald-300'
        : 'text-gray-400';
  return (
    <div
      role="status"
      className={`tree-status ${tone}`}
      style={{ '--tree-depth': depth } as CSSProperties}
    >
      <Icon size={13} className="mt-px shrink-0" />
      <span>{status.message}</span>
    </div>
  );
}

function UrdfFields({
  options,
  onChange,
  topics,
}: {
  options: UrdfOptions;
  onChange: (patch: Partial<UrdfOptions>) => void;
  topics: TopicInfo[];
}) {
  return (
    <>
      <TreeField label="Joint states topic">
        <TopicInput
          aria-label="Joint states topic"
          value={options.jointStatesTopic}
          onCommit={(jointStatesTopic) => onChange({ jointStatesTopic })}
          topics={topics}
          messageType="sensor_msgs/msg/JointState"
          placeholder="/joint_states"
        />
      </TreeField>
      <SelectField
        label="Display mode"
        value={options.displayMode}
        options={DISPLAY_MODES}
        onChange={(displayMode) => onChange({ displayMode })}
      />
      <TextField
        label="Frame prefix"
        value={options.framePrefix}
        placeholder="none"
        onCommit={(framePrefix) => onChange({ framePrefix })}
      />
      <ColorField
        label="Color"
        value={options.color}
        emptyLabel="URDF materials"
        onChange={(color) => onChange({ color })}
      />
      <TextField
        label="Mesh server URL"
        value={options.meshBaseUrl}
        placeholder="MITI server (package://)"
        onCommit={(meshBaseUrl) => onChange({ meshBaseUrl })}
      />
    </>
  );
}

function TopicFields({
  row,
  topics,
  onChange,
}: {
  row: TopicRow;
  topics: TopicInfo[];
  onChange: (patch: TopicSettings) => void;
}) {
  const { type, settings } = row;
  if (type === 'urdf')
    return (
      <UrdfFields
        options={{ ...DEFAULT_URDF_OPTIONS, ...settings }}
        onChange={onChange}
        topics={topics}
      />
    );
  const hasColor = !['map', 'marker', 'markers'].includes(type);
  const hasSize = !['map', 'marker', 'markers'].includes(type);
  const hasPoints = !['map', 'camera'].includes(type);
  return (
    <>
      {type === 'camera' && (
        <TreeField label="Image topic">
          <TopicInput
            aria-label={`Image topic for ${row.topic}`}
            value={settings.imageTopic ?? ''}
            onCommit={(imageTopic) => onChange({ imageTopic })}
            topics={topics}
            messageType={IMAGE_TYPES}
            placeholder="/camera/image_rect"
          />
        </TreeField>
      )}
      {hasColor && (
        <ColorField
          label="Color"
          value={settings.color ?? '#a78bfa'}
          onChange={(color) => onChange({ color })}
        />
      )}
      <NumberField
        label="Opacity"
        value={settings.opacity ?? 1}
        min={0}
        max={1}
        step={0.05}
        onCommit={(opacity) => onChange({ opacity })}
      />
      {hasSize && (
        <NumberField
          label={
            type === 'camera'
              ? 'Image distance (m)'
              : type === 'pointcloud' || type === 'scan'
                ? 'Point size (m)'
                : 'Arrow size (m)'
          }
          value={settings.size ?? defaultLayerSize(type)}
          min={0.001}
          step={0.01}
          onCommit={(size) => onChange({ size })}
        />
      )}
      {hasPoints && (
        <NumberField
          label="Point limit"
          value={settings.maxPoints ?? 100000}
          min={1}
          max={1000000}
          step={1000}
          onCommit={(maxPoints) => onChange({ maxPoints: Math.round(maxPoints) })}
        />
      )}
      {!['marker', 'markers'].includes(type) && (
        <NumberField
          label="Max rate (Hz)"
          value={settings.maxRate ?? 0}
          min={0}
          max={100}
          step={1}
          onCommit={(maxRate) => onChange({ maxRate })}
        />
      )}
      {!['map', 'marker', 'markers'].includes(type) && (
        <NumberField
          label="Stale after (s)"
          value={settings.staleAfter ?? 5}
          min={0.5}
          step={0.5}
          onCommit={(staleAfter) => onChange({ staleAfter })}
        />
      )}
    </>
  );
}

function GridFields({
  layer,
  frames,
  displayFrame,
  onChange,
}: {
  layer: GridLayerConfig;
  frames: string[];
  displayFrame: string;
  onChange: (patch: Partial<GridLayerConfig>) => void;
}) {
  return (
    <>
      <TextField label="Label" value={layer.label} onCommit={(label) => onChange({ label })} />
      <SelectField
        label="Frame"
        value={layer.frameId}
        options={[
          { value: '', label: `Display frame (${displayFrame})` },
          ...frames.map((frame) => ({ value: frame, label: frame })),
        ]}
        onChange={(frameId) => onChange({ frameId })}
      />
      <NumberField
        label="Size (m)"
        value={layer.size}
        min={0.1}
        onCommit={(size) => onChange({ size })}
      />
      <NumberField
        label="Divisions"
        value={layer.divisions}
        min={1}
        max={1000}
        onCommit={(divisions) => onChange({ divisions: Math.round(divisions) })}
      />
      <NumberField
        label="Line width"
        value={layer.lineWidth}
        min={0.1}
        step={0.1}
        onCommit={(lineWidth) => onChange({ lineWidth })}
      />
      <ColorField label="Color" value={layer.color} onChange={(color) => onChange({ color })} />
      <Vec3Field
        label="Position"
        value={layer.position}
        onCommit={(position) => onChange({ position })}
      />
      <Vec3Field
        label="Rotation (°)"
        value={layer.rotation}
        step={1}
        onCommit={(rotation) => onChange({ rotation })}
      />
    </>
  );
}

function UrdfLayerFields({
  layer,
  topics,
  onChange,
}: {
  layer: UrdfLayerConfig;
  topics: TopicInfo[];
  onChange: (patch: Partial<UrdfLayerConfig>) => void;
}) {
  return (
    <>
      <TextField label="Label" value={layer.label} onCommit={(label) => onChange({ label })} />
      <SelectField
        label="Source"
        value={layer.source}
        options={URDF_SOURCES}
        onChange={(source) => onChange({ source })}
      />
      {layer.source === 'url' && (
        <TextField
          label="URL"
          value={layer.url}
          placeholder="http://robot:8000/robot.urdf"
          onCommit={(url) => onChange({ url })}
        />
      )}
      {layer.source === 'filePath' && (
        <TextField
          label="File path"
          value={layer.filePath}
          placeholder="package://my_robot/urdf/robot.urdf"
          onCommit={(filePath) => onChange({ filePath })}
        />
      )}
      {layer.source === 'parameter' && (
        <TextField
          label="Parameter"
          value={layer.parameter}
          placeholder="/robot_state_publisher.robot_description"
          onCommit={(parameter) => onChange({ parameter })}
        />
      )}
      {layer.source === 'topic' && (
        <TreeField label="Topic">
          <TopicInput
            aria-label={`Topic for ${layer.label}`}
            value={layer.topic}
            onCommit={(topic) => onChange({ topic })}
            topics={topics}
            messageType="std_msgs/msg/String"
            placeholder="/robot_description"
          />
        </TreeField>
      )}
      <UrdfFields options={layer} onChange={onChange} topics={topics} />
    </>
  );
}

export default function SceneSettings({
  config,
  onChange,
  topics,
  topicRows,
  frames,
  tree,
  fixedFrame,
  displayFrame,
  statuses,
  onReloadRobots,
}: {
  config: SceneConfig;
  onChange: (config: SceneConfig) => void;
  topics: TopicInfo[];
  topicRows: TopicRow[];
  frames: string[];
  tree: TFTree;
  fixedFrame: string;
  displayFrame: string;
  statuses: Record<string, LayerStatus>;
  /** Clear cached robot meshes and load every robot model again. */
  onReloadRobots: () => void;
}) {
  const update = <K extends keyof SceneConfig>(key: K, patch: Partial<SceneConfig[K]>) =>
    onChange({ ...config, [key]: { ...(config[key] as object), ...patch } });
  const updateTopic = (row: TopicRow, patch: TopicSettings) =>
    onChange({
      ...config,
      topics: {
        ...config.topics,
        [row.topic]: { ...config.topics[row.topic], type: row.type, ...patch },
      },
    });
  const setAllTopics = (visible: boolean) =>
    onChange({
      ...config,
      topics: Object.fromEntries([
        ...Object.entries(config.topics),
        ...topicRows.map((row) => [row.topic, { ...row.settings, type: row.type, visible }]),
      ]),
    });
  const updateLayer = (id: string, patch: Partial<CustomLayerConfig>) =>
    onChange({
      ...config,
      layers: config.layers.map((layer) =>
        layer.id === id ? ({ ...layer, ...patch } as CustomLayerConfig) : layer
      ),
    });
  const addLayer = (layer: CustomLayerConfig) =>
    onChange({ ...config, layers: [...config.layers, layer] });
  const setAllFrames = (visible: boolean) =>
    update('transforms', {
      frames: Object.fromEntries(frames.map((frame) => [frame, { visible }])),
    });

  const frameOptions = (current: string) =>
    Array.from(new Set([...frames, ...(current ? [current] : [])]))
      .sort()
      .map((frame) => ({ value: frame, label: frame }));
  const missing = (frame: string) =>
    frame && frames.length > 0 && !frames.includes(frame)
      ? `Frame ${frame} is not in the TF tree`
      : undefined;
  const { frame, scene, view, transforms, publish } = config;
  const now = Date.now();

  return (
    <div className="scene-settings">
      <TreeSection title="Frame" keywords="fixed display follow sync timestamps tf">
        <SelectField
          label="Fixed frame"
          value={frame.fixedFrame}
          options={[
            { value: '', label: `Auto (${fixedFrame})` },
            ...frameOptions(frame.fixedFrame),
          ]}
          onChange={(fixedFrame) => update('frame', { fixedFrame })}
          error={missing(frame.fixedFrame)}
        />
        <SelectField
          label="Display frame"
          value={frame.displayFrame}
          options={[
            { value: '', label: `Fixed frame (${fixedFrame})` },
            ...frameOptions(frame.displayFrame),
          ]}
          onChange={(displayFrame) => update('frame', { displayFrame })}
          error={missing(frame.displayFrame)}
        />
        <SelectField
          label="Follow mode"
          value={frame.followMode}
          options={FOLLOW_MODES}
          onChange={(followMode) => update('frame', { followMode })}
        />
        <ToggleField
          label="Sync timestamps"
          value={frame.syncTimestamps}
          onChange={(syncTimestamps) => update('frame', { syncTimestamps })}
        />
      </TreeSection>

      <TreeSection
        title="Scene"
        keywords="render stats background label scale collada mesh up axis"
        defaultOpen={false}
      >
        <ToggleField
          label="Render stats"
          value={scene.renderStats}
          onChange={(renderStats) => update('scene', { renderStats })}
        />
        <ColorField
          label="Background"
          value={scene.background}
          onChange={(background) => update('scene', { background })}
        />
        <NumberField
          label="Label scale"
          value={scene.labelScale}
          min={0.1}
          max={10}
          step={0.1}
          onCommit={(labelScale) => update('scene', { labelScale })}
        />
        <ToggleField
          label="Ignore COLLADA <up_axis>"
          value={scene.ignoreColladaUpAxis}
          onChange={(ignoreColladaUpAxis) => update('scene', { ignoreColladaUpAxis })}
        />
        <SelectField
          label="Mesh up axis"
          value={scene.meshUpAxis}
          options={[
            { value: 'z_up', label: 'Z-up' },
            { value: 'y_up', label: 'Y-up' },
          ]}
          onChange={(meshUpAxis) => update('scene', { meshUpAxis })}
        />
      </TreeSection>

      <TreeSection
        title="View"
        keywords="camera distance perspective target theta phi fov near far"
        defaultOpen={false}
        actions={[
          { label: 'Reset view', onSelect: () => onChange({ ...config, view: DEFAULT_VIEW }) },
        ]}
      >
        <NumberField
          label="Distance"
          value={view.distance}
          min={0.01}
          step={0.5}
          onCommit={(distance) => update('view', { distance })}
        />
        <ToggleField
          label="Perspective"
          value={view.perspective}
          onChange={(perspective) => update('view', { perspective })}
        />
        <Vec3Field
          label="Target offset"
          value={view.targetOffset}
          onCommit={(targetOffset) => update('view', { targetOffset })}
        />
        <NumberField
          label="Theta (°)"
          value={view.thetaOffset}
          step={5}
          onCommit={(thetaOffset) => update('view', { thetaOffset })}
        />
        <NumberField
          label="Phi (°)"
          value={view.phi}
          min={0.01}
          max={179.99}
          step={5}
          onCommit={(phi) => update('view', { phi })}
        />
        <NumberField
          label="Y-axis FOV (°)"
          value={view.fovy}
          min={1}
          max={179}
          onCommit={(fovy) => update('view', { fovy })}
        />
        <NumberField
          label="Near"
          value={view.near}
          min={0.0001}
          step={0.01}
          onCommit={(near) => update('view', { near })}
        />
        <NumberField
          label="Far"
          value={view.far}
          min={1}
          step={100}
          onCommit={(far) => update('view', { far })}
        />
      </TreeSection>

      <TreeSection
        title="Transforms"
        keywords={`tf frames labels axis ${frames.join(' ')}`}
        defaultOpen={false}
        visible={transforms.visible}
        onVisibleChange={(visible) => update('transforms', { visible })}
        actions={[
          { label: 'Show all frames', onSelect: () => setAllFrames(true) },
          { label: 'Hide all frames', onSelect: () => setAllFrames(false) },
        ]}
      >
        <ToggleField
          label="Labels"
          value={transforms.showLabels}
          onChange={(showLabels) => update('transforms', { showLabels })}
        />
        <NumberField
          label="Label size (px)"
          value={transforms.labelSize}
          min={4}
          max={48}
          onCommit={(labelSize) => update('transforms', { labelSize })}
        />
        <NumberField
          label="Axis scale"
          value={transforms.axisScale}
          min={0.01}
          step={0.1}
          onCommit={(axisScale) => update('transforms', { axisScale })}
        />
        <NumberField
          label="Line width"
          value={transforms.lineWidth}
          min={0.1}
          step={0.5}
          onCommit={(lineWidth) => update('transforms', { lineWidth })}
        />
        <ColorField
          label="Line color"
          value={transforms.lineColor}
          onChange={(lineColor) => update('transforms', { lineColor })}
        />
        <TextField
          label="TF topics"
          value={transforms.tfTopics.join(', ')}
          onCommit={(value) => update('transforms', { tfTopics: splitTopics(value) })}
        />
        <TextField
          label="Static TF topics"
          value={transforms.staticTfTopics?.join(', ') ?? ''}
          placeholder="topics named *static*"
          onCommit={(value) =>
            update('transforms', {
              staticTfTopics: value.trim() ? splitTopics(value) : undefined,
            })
          }
        />
        {frames.map((name) => {
          const info = tree.frames.get(name);
          return (
            <TreeSection
              key={name}
              title={name}
              depth={1}
              defaultOpen={false}
              visible={transforms.frames[name]?.visible !== false}
              onVisibleChange={(visible) =>
                update('transforms', {
                  frames: { ...transforms.frames, [name]: { visible } },
                })
              }
            >
              <TreeField label="Parent">
                <span className="font-mono text-gray-300">{info?.parent ?? '(root)'}</span>
              </TreeField>
              <TreeField label="Age">
                <span className="text-gray-300">
                  {!info
                    ? '—'
                    : info.isStatic
                      ? 'static'
                      : `${((now - info.timestamp) / 1000).toFixed(1)} s`}
                </span>
              </TreeField>
            </TreeSection>
          );
        })}
      </TreeSection>

      <TreeSection
        title="Topics"
        keywords={topicRows.map((row) => row.topic).join(' ')}
        actions={[
          { label: 'Show all', onSelect: () => setAllTopics(true) },
          { label: 'Hide all', onSelect: () => setAllTopics(false) },
        ]}
      >
        {topicRows.length === 0 && (
          <p className="px-4 py-2 text-xs text-gray-400">
            No topics the 3D scene can show. Connect to ROS, or refresh the topic list.
          </p>
        )}
        {topicRows.map((row) => {
          const status = statuses[`topic:${row.topic}`];
          return (
            <TreeSection
              key={row.topic}
              title={row.topic}
              keywords={row.messageType}
              depth={1}
              defaultOpen={false}
              visible={row.visible}
              onVisibleChange={(visible) => updateTopic(row, { visible })}
              actions={
                row.type === 'urdf'
                  ? [{ label: 'Reload model (clear mesh cache)', onSelect: onReloadRobots }]
                  : undefined
              }
              error={row.visible && status?.level === 'error' ? status.message : undefined}
            >
              <TreeField label="Type">
                <span className="font-mono text-gray-300">
                  {row.messageType}
                  {!row.published && ' · not published'}
                </span>
              </TreeField>
              <TopicFields
                row={row}
                topics={topics}
                onChange={(patch) => updateTopic(row, patch)}
              />
              {row.visible && <StatusLine status={status} />}
            </TreeSection>
          );
        })}
      </TreeSection>

      <TreeSection
        title={`Custom layers (${config.layers.length})`}
        keywords="grid urdf robot model custom layers"
        actions={[
          { label: 'Add Grid', onSelect: () => addLayer(newGridLayer(crypto.randomUUID())) },
          { label: 'Add URDF', onSelect: () => addLayer(newUrdfLayer(crypto.randomUUID())) },
        ]}
      >
        {config.layers.map((layer) => {
          const status = statuses[`layer:${layer.id}`];
          return (
            <TreeSection
              key={layer.id}
              title={layer.label}
              depth={1}
              defaultOpen={layer.type === 'urdf'}
              visible={layer.visible}
              onVisibleChange={(visible) => updateLayer(layer.id, { visible })}
              error={layer.visible && status?.level === 'error' ? status.message : undefined}
              actions={[
                ...(layer.type === 'urdf'
                  ? [{ label: 'Reload model (clear mesh cache)', onSelect: onReloadRobots }]
                  : []),
                {
                  label: 'Delete',
                  danger: true,
                  onSelect: () =>
                    onChange({ ...config, layers: config.layers.filter((l) => l.id !== layer.id) }),
                },
              ]}
            >
              {layer.type === 'grid' ? (
                <GridFields
                  layer={layer}
                  frames={frames}
                  displayFrame={displayFrame}
                  onChange={(patch) => updateLayer(layer.id, patch)}
                />
              ) : (
                <UrdfLayerFields
                  layer={layer}
                  topics={topics}
                  onChange={(patch) => updateLayer(layer.id, patch)}
                />
              )}
              {layer.visible && <StatusLine status={status} />}
            </TreeSection>
          );
        })}
      </TreeSection>

      <TreeSection
        title="Publish"
        keywords="click point pose estimate goal initialpose clicked_point"
        defaultOpen={false}
      >
        <SelectField
          label="Type"
          value={publish.type}
          options={PUBLISH_TYPES}
          onChange={(type) => update('publish', { type })}
        />
        {publish.type === 'point' && (
          <TreeField label="Topic">
            <TopicInput
              aria-label="Point topic"
              value={publish.pointTopic}
              onCommit={(pointTopic) => update('publish', { pointTopic })}
              placeholder="/clicked_point"
            />
          </TreeField>
        )}
        {publish.type === 'pose' && (
          <TreeField label="Topic">
            <TopicInput
              aria-label="Pose topic"
              value={publish.poseTopic}
              onCommit={(poseTopic) => update('publish', { poseTopic })}
              placeholder="/goal_pose"
            />
          </TreeField>
        )}
        {publish.type === 'pose_estimate' && (
          <>
            <TreeField label="Topic">
              <TopicInput
                aria-label="Pose estimate topic"
                value={publish.poseEstimateTopic}
                onCommit={(poseEstimateTopic) => update('publish', { poseEstimateTopic })}
                placeholder="/initialpose"
              />
            </TreeField>
            <NumberField
              label="X deviation (m)"
              value={publish.poseEstimateXDeviation}
              min={0}
              step={0.05}
              onCommit={(poseEstimateXDeviation) => update('publish', { poseEstimateXDeviation })}
            />
            <NumberField
              label="Y deviation (m)"
              value={publish.poseEstimateYDeviation}
              min={0}
              step={0.05}
              onCommit={(poseEstimateYDeviation) => update('publish', { poseEstimateYDeviation })}
            />
            <NumberField
              label="Theta deviation (rad)"
              value={publish.poseEstimateThetaDeviation}
              min={0}
              step={0.01}
              onCommit={(poseEstimateThetaDeviation) =>
                update('publish', { poseEstimateThetaDeviation })
              }
            />
          </>
        )}
        <p className="px-4 py-2 text-xs text-gray-400">
          Press the publish button at the top right of the scene, then click on the ground (point)
          or drag toward the heading (pose).
        </p>
      </TreeSection>
    </div>
  );
}
