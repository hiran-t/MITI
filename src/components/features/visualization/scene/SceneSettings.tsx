'use client';
import type { CSSProperties } from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import {
  ColorField,
  NumberField,
  OptionalNumberField,
  SelectField,
  SliderField,
  TextField,
  ToggleField,
  TreeField,
  TreeSection,
  Vec3Field,
} from '../../layout/SettingsTree';
import TopicInput from '../../topic-viewer/TopicInput';
import type { TopicInfo } from '@/lib/bridge/types';
import type { LayerStatus, PoseDisplayType } from '@/types/scene';
import {
  autoPointColors,
  DEFAULT_GRADIENT,
  DEFAULT_MAP_COLORS,
  type ColorMapName,
  type MapColorMode,
  type PointColorMode,
} from '@/lib/scene/colors';
import { defaultPoseType, type LayerInfo } from './SceneLayer';
import { DEFAULT_ARROW, DEFAULT_COVARIANCE_COLOR, DEFAULT_PATH_GRADIENT } from './PoseShapes';
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
  type UrdfControlMode,
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
const CONTROL_MODES: { value: UrdfControlMode; label: string }[] = [
  { value: 'jointStates', label: 'Joint states' },
  { value: 'manual', label: 'Manual' },
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
const POINT_COLOR_MODES: { value: PointColorMode; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'colormap', label: 'Color map' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'rgb', label: 'RGB' },
  { value: 'rgba', label: 'RGBA' },
];
const COLOR_MAPS: { value: ColorMapName; label: string }[] = [
  { value: 'turbo', label: 'Turbo' },
  { value: 'rainbow', label: 'Rainbow' },
];
const POSE_TYPES: TopicLayerType[] = ['path', 'pose', 'posecov', 'poses', 'odometry'];
const POSE_DISPLAY_TYPES: { value: PoseDisplayType; label: string }[] = [
  { value: 'axis', label: 'Axis' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'line', label: 'Line' },
];
const MAP_COLOR_MODES: { value: MapColorMode; label: string }[] = [
  { value: 'custom', label: 'Custom' },
  { value: 'map', label: 'Map' },
  { value: 'costmap', label: 'Costmap' },
  { value: 'raw', label: 'Raw' },
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
  info,
}: {
  options: UrdfOptions;
  onChange: (patch: Partial<UrdfOptions>) => void;
  topics: TopicInfo[];
  /** Joints and links of the loaded model. */
  info?: LayerInfo;
}) {
  const manual = options.controlMode === 'manual';
  const joints = info?.joints ?? [];
  const links = info?.links ?? [];
  const hidden = options.hiddenLinks ?? [];
  return (
    <>
      <SelectField
        label="Control mode"
        value={options.controlMode ?? 'jointStates'}
        options={CONTROL_MODES}
        onChange={(controlMode) => onChange({ controlMode })}
      />
      {!manual && (
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
      )}
      <SelectField
        label="Display mode"
        value={options.displayMode}
        options={DISPLAY_MODES}
        onChange={(displayMode) => onChange({ displayMode })}
      />
      <ColorField
        label="Color"
        value={options.color}
        emptyLabel="URDF materials"
        onChange={(color) => onChange({ color })}
      />
      <NumberField
        label="Opacity"
        value={options.opacity ?? 1}
        min={0}
        max={1}
        step={0.05}
        onCommit={(opacity) => onChange({ opacity })}
      />
      <ToggleField
        label="Show outlines"
        value={!!options.showOutlines}
        onChange={(showOutlines) => onChange({ showOutlines })}
      />
      <ToggleField
        label="Show axis"
        value={!!options.showAxis}
        onChange={(showAxis) => onChange({ showAxis })}
      />
      {options.showAxis && (
        <NumberField
          label="Axis scale"
          value={options.axisScale ?? 1}
          min={0.01}
          step={0.1}
          onCommit={(axisScale) => onChange({ axisScale })}
        />
      )}
      <TextField
        label="Frame prefix"
        value={options.framePrefix}
        placeholder="none"
        onCommit={(framePrefix) => onChange({ framePrefix })}
      />
      <TextField
        label="Mesh server URL"
        value={options.meshBaseUrl}
        placeholder="MITI server (package://)"
        onCommit={(meshBaseUrl) => onChange({ meshBaseUrl })}
      />
      {joints.length > 0 && (
        <TreeSection
          title={`Joint states (${joints.length})`}
          keywords={joints.map((joint) => joint.name).join(' ')}
          depth={2}
          defaultOpen={false}
          actions={
            manual
              ? [{ label: 'Reset all to 0', onSelect: () => onChange({ manualJoints: {} }) }]
              : undefined
          }
        >
          {!manual && (
            <p className="px-4 py-1 text-[11px] text-gray-400">
              Positions from {options.jointStatesTopic || 'joint states'}. Switch Control mode to
              Manual to set them here.
            </p>
          )}
          {joints.map((joint) => (
            <SliderField
              key={joint.name}
              label={joint.name}
              value={manual ? (options.manualJoints?.[joint.name] ?? 0) : joint.value}
              min={joint.lower}
              max={joint.upper}
              step={joint.type === 'prismatic' ? 0.001 : 0.01}
              disabled={!manual}
              onChange={(value) =>
                onChange({ manualJoints: { ...options.manualJoints, [joint.name]: value } })
              }
            />
          ))}
        </TreeSection>
      )}
      {links.length > 0 && (
        <TreeSection
          title={`Links (${links.length})`}
          keywords={links.join(' ')}
          depth={2}
          defaultOpen={false}
          actions={[
            { label: 'Show all', onSelect: () => onChange({ hiddenLinks: [] }) },
            { label: 'Hide all', onSelect: () => onChange({ hiddenLinks: links }) },
          ]}
        >
          {links.map((link) => (
            <TreeSection
              key={link}
              title={link}
              depth={3}
              visible={!hidden.includes(link)}
              onVisibleChange={(visible) =>
                onChange({
                  hiddenLinks: visible ? hidden.filter((name) => name !== link) : [...hidden, link],
                })
              }
            />
          ))}
        </TreeSection>
      )}
    </>
  );
}

/** Point size, shape, decay and coloring, as in Foxglove's point cloud and laser scan settings. */
function PointFields({
  type,
  settings,
  info,
  onChange,
}: {
  type: 'pointcloud' | 'scan';
  settings: TopicSettings;
  /** Fields of the latest message; undefined until one arrives. */
  info?: LayerInfo;
  onChange: (patch: TopicSettings) => void;
}) {
  const auto = autoPointColors(info?.fields ?? [], info?.hasColors ?? false);
  const colorMode = settings.colorMode ?? auto.colorMode;
  const colorField = settings.colorField ?? auto.colorField;
  const byField = colorMode === 'colormap' || colorMode === 'gradient';
  const fields = info?.fields ?? [];
  const fieldError =
    info && byField && !fields.includes(colorField)
      ? `${colorField} is not a field of this topic`
      : undefined;
  const colorError =
    info && (colorMode === 'rgb' || colorMode === 'rgba') && !info.hasColors
      ? 'This topic has no rgb, rgba or r/g/b fields'
      : undefined;
  const modes = POINT_COLOR_MODES.filter(
    (mode) => type === 'pointcloud' || !['rgb', 'rgba'].includes(mode.value)
  );
  const gradient = settings.gradient ?? DEFAULT_GRADIENT;
  return (
    <>
      <NumberField
        label="Point size"
        value={settings.pointSize ?? 2}
        min={1}
        max={50}
        step={1}
        onCommit={(pointSize) => onChange({ pointSize })}
      />
      <SelectField
        label="Point shape"
        value={settings.pointShape ?? 'circle'}
        options={[
          { value: 'circle', label: 'Circle' },
          { value: 'square', label: 'Square' },
        ]}
        onChange={(pointShape) => onChange({ pointShape })}
      />
      <NumberField
        label="Decay time (s)"
        value={settings.decayTime ?? 0}
        min={0}
        max={60}
        step={0.5}
        onCommit={(decayTime) => onChange({ decayTime })}
      />
      <SelectField
        label="Color mode"
        value={colorMode}
        options={modes}
        onChange={(mode) => onChange({ colorMode: mode })}
        error={colorError}
      />
      {colorMode === 'flat' && (
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
      {byField && (
        <>
          <SelectField
            label="Color field"
            value={colorField}
            options={(fields.includes(colorField) ? fields : [colorField, ...fields]).map(
              (field) => ({ value: field, label: field })
            )}
            onChange={(field) => onChange({ colorField: field })}
            error={fieldError}
          />
          {colorMode === 'colormap' ? (
            <SelectField
              label="Color map"
              value={settings.colorMap ?? 'turbo'}
              options={COLOR_MAPS}
              onChange={(colorMap) => onChange({ colorMap })}
            />
          ) : (
            <>
              <ColorField
                label="Gradient start"
                value={gradient[0]}
                onChange={(start) => onChange({ gradient: [start, gradient[1]] })}
              />
              <ColorField
                label="Gradient end"
                value={gradient[1]}
                onChange={(end) => onChange({ gradient: [gradient[0], end] })}
              />
            </>
          )}
          <OptionalNumberField
            label="Value min"
            value={settings.valueMin}
            onCommit={(valueMin) => onChange({ valueMin })}
          />
          <OptionalNumberField
            label="Value max"
            value={settings.valueMax}
            onCommit={(valueMax) => onChange({ valueMax })}
          />
        </>
      )}
      <ToggleField
        label="Stixel view"
        value={!!settings.stixels}
        onChange={(stixels) => onChange({ stixels })}
      />
    </>
  );
}

/** Axes, arrows or a line, and covariance, as in Foxglove's pose, pose array and path settings. */
function PoseFields({
  type,
  settings,
  onChange,
}: {
  type: TopicLayerType;
  settings: TopicSettings;
  onChange: (patch: TopicSettings) => void;
}) {
  const poseType = settings.poseType ?? defaultPoseType(type);
  const lists = type === 'path' || type === 'poses';
  const gradient = settings.gradient ?? DEFAULT_PATH_GRADIENT;
  return (
    <>
      <SelectField
        label="Type"
        value={poseType}
        options={POSE_DISPLAY_TYPES.filter((option) => lists || option.value !== 'line')}
        onChange={(value) => onChange({ poseType: value })}
      />
      {poseType === 'axis' && (
        <NumberField
          label="Scale"
          value={settings.axisScale ?? 1}
          min={0.01}
          step={0.1}
          onCommit={(axisScale) => onChange({ axisScale })}
        />
      )}
      {poseType === 'arrow' && (
        <>
          <ColorField
            label="Color"
            value={settings.color ?? '#a78bfa'}
            onChange={(color) => onChange({ color })}
          />
          {(
            [
              ['shaftLength', 'Shaft length'],
              ['shaftWidth', 'Shaft width'],
              ['headLength', 'Head length'],
              ['headWidth', 'Head width'],
            ] as const
          ).map(([key, label]) => (
            <NumberField
              key={key}
              label={label}
              value={settings[key] ?? DEFAULT_ARROW[key]}
              min={0.001}
              step={0.01}
              onCommit={(value) => onChange({ [key]: value })}
            />
          ))}
        </>
      )}
      {poseType === 'line' && (
        <>
          <NumberField
            label="Line width"
            value={settings.lineWidth ?? 0.05}
            min={0.001}
            step={0.01}
            onCommit={(lineWidth) => onChange({ lineWidth })}
          />
          <ColorField
            label="Gradient start"
            value={gradient[0]}
            onChange={(start) => onChange({ gradient: [start, gradient[1]] })}
          />
          <ColorField
            label="Gradient end"
            value={gradient[1]}
            onChange={(end) => onChange({ gradient: [gradient[0], end] })}
          />
        </>
      )}
      <NumberField
        label="Opacity"
        value={settings.opacity ?? 1}
        min={0}
        max={1}
        step={0.05}
        onCommit={(opacity) => onChange({ opacity })}
      />
      {(type === 'posecov' || type === 'odometry') && (
        <>
          <ToggleField
            label="Covariance"
            value={settings.showCovariance ?? true}
            onChange={(showCovariance) => onChange({ showCovariance })}
          />
          {(settings.showCovariance ?? true) && (
            <ColorField
              label="Covariance color"
              value={settings.covarianceColor ?? DEFAULT_COVARIANCE_COLOR}
              onChange={(covarianceColor) => onChange({ covarianceColor })}
            />
          )}
        </>
      )}
    </>
  );
}

/** Marker namespaces with visibility toggles, as in Foxglove's marker settings. */
function NamespaceFields({
  namespaces,
  hidden,
  onChange,
}: {
  namespaces: string[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  if (!namespaces.length) return null;
  return (
    <TreeSection
      title={`Namespaces (${namespaces.length})`}
      keywords={namespaces.join(' ')}
      depth={2}
      actions={[
        { label: 'Show all', onSelect: () => onChange([]) },
        { label: 'Hide all', onSelect: () => onChange(namespaces) },
      ]}
    >
      {namespaces.map((ns) => (
        <TreeSection
          key={ns}
          title={ns || '(no namespace)'}
          depth={3}
          visible={!hidden.includes(ns)}
          onVisibleChange={(visible) =>
            onChange(visible ? hidden.filter((name) => name !== ns) : [...hidden, ns])
          }
        />
      ))}
    </TreeSection>
  );
}

/** Occupancy grid palette and placement, as in Foxglove's occupancy grid settings. */
function MapFields({
  settings,
  onChange,
}: {
  settings: TopicSettings;
  onChange: (patch: TopicSettings) => void;
}) {
  const mode = settings.mapColorMode ?? 'custom';
  return (
    <>
      <SelectField
        label="Color mode"
        value={mode}
        options={MAP_COLOR_MODES}
        onChange={(mapColorMode) => onChange({ mapColorMode })}
      />
      {mode === 'custom' &&
        (
          [
            ['minColor', 'Min color'],
            ['maxColor', 'Max color'],
            ['unknownColor', 'Unknown color'],
            ['invalidColor', 'Invalid color'],
          ] as const
        ).map(([key, label]) => (
          <ColorField
            key={key}
            label={label}
            value={settings[key] ?? DEFAULT_MAP_COLORS[key]}
            onChange={(color) => onChange({ [key]: color })}
          />
        ))}
      <NumberField
        label="Opacity"
        value={settings.opacity ?? 1}
        min={0}
        max={1}
        step={0.05}
        onCommit={(opacity) => onChange({ opacity })}
      />
      <ToggleField
        label="Frame lock"
        value={!!settings.frameLocked}
        onChange={(frameLocked) => onChange({ frameLocked })}
      />
      <ToggleField
        label="Draw behind"
        value={!!settings.drawBehind}
        onChange={(drawBehind) => onChange({ drawBehind })}
      />
    </>
  );
}

function TopicFields({
  row,
  topics,
  info,
  onChange,
}: {
  row: TopicRow;
  topics: TopicInfo[];
  info?: LayerInfo;
  onChange: (patch: TopicSettings) => void;
}) {
  const { type, settings } = row;
  if (type === 'urdf')
    return (
      <UrdfFields
        options={{ ...DEFAULT_URDF_OPTIONS, ...settings }}
        onChange={onChange}
        topics={topics}
        info={info}
      />
    );
  const points = type === 'pointcloud' || type === 'scan';
  const poses = POSE_TYPES.includes(type);
  const styled = points || poses || type === 'map';
  const hasColor = type === 'camera';
  const hasSize = type === 'camera';
  // Point limit bounds points, markers and pose lists; single poses have nothing to limit.
  const hasPoints = !['map', 'camera', 'pose', 'posecov', 'odometry'].includes(type);
  return (
    <>
      {points && <PointFields type={type} settings={settings} info={info} onChange={onChange} />}
      {type === 'map' && <MapFields settings={settings} onChange={onChange} />}
      {poses && <PoseFields type={type} settings={settings} onChange={onChange} />}
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
      {!styled && (
        <NumberField
          label="Opacity"
          value={settings.opacity ?? 1}
          min={0}
          max={1}
          step={0.05}
          onCommit={(opacity) => onChange({ opacity })}
        />
      )}
      {hasSize && (
        <NumberField
          label="Image distance (m)"
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
      {(type === 'marker' || type === 'markers') && (
        <NamespaceFields
          namespaces={info?.namespaces ?? []}
          hidden={settings.hiddenNamespaces ?? []}
          onChange={(hiddenNamespaces) => onChange({ hiddenNamespaces })}
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
  info,
  onChange,
}: {
  layer: UrdfLayerConfig;
  topics: TopicInfo[];
  info?: LayerInfo;
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
      <UrdfFields options={layer} onChange={onChange} topics={topics} info={info} />
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
  layerInfo = {},
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
  /** What each layer's latest messages hold (fields, namespaces, joints), by layer id. */
  layerInfo?: Record<string, LayerInfo>;
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
                info={layerInfo[`topic:${row.topic}`]}
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
                  info={layerInfo[`layer:${layer.id}`]}
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
