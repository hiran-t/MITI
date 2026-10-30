'use client';
import {
  ColorField,
  NumberField,
  OptionalNumberField,
  SelectField,
  ToggleField,
  TreeField,
  TreeSection,
} from '../../layout/SettingsTree';
import TopicInput from '../../topic-viewer/TopicInput';
import type { TopicInfo } from '@/lib/bridge/types';
import { normalizeMessageType } from '@/lib/bridge/topics';
import type { LayerStatus } from '@/types/scene';
import type { TopicSettings } from '@/types/scene-config';
import type { TFTree } from '@/types/tf-messages';
import type { ColorMapName } from '@/lib/scene/colors';
import type { ImageColorMode } from '@/lib/camera/image-colors';
import type { ImageRotation } from '@/lib/camera/projection';
import {
  defaultCalibrationTopic,
  ROTATIONS,
  type ImagePanelConfig,
} from '@/lib/camera/image-config';
import type { LayerInfo } from '../scene/SceneLayer';
import { TopicsSection, TransformsSection, type TopicRow } from '../scene/SceneSettings';

const IMAGE_TYPES = ['sensor_msgs/msg/Image', 'sensor_msgs/msg/CompressedImage'];
const CAMERA_INFO = 'sensor_msgs/CameraInfo';
const MAX_FPS_CHOICES = [1, 2, 5, 10, 15, 30, 0];
const AUTO = '__auto__';
const COLOR_MODES: { value: ImageColorMode; label: string }[] = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'colormap', label: 'Color map' },
];
const COLOR_MAPS: { value: ColorMapName; label: string }[] = [
  { value: 'turbo', label: 'Turbo' },
  { value: 'rainbow', label: 'Rainbow' },
];

/** Image panel settings, laid out like Foxglove's Image panel. */
export default function ImageSettings({
  config,
  onChange,
  topics,
  topicRows,
  statuses,
  layerInfo,
  frames,
  tree,
  calibrationError,
  onReloadRobots,
}: {
  config: ImagePanelConfig;
  onChange: (config: ImagePanelConfig) => void;
  topics: TopicInfo[];
  topicRows: TopicRow[];
  statuses: Record<string, LayerStatus>;
  layerInfo: Record<string, LayerInfo>;
  frames: string[];
  tree: TFTree;
  /** Why overlays or Rectify cannot use the calibration. */
  calibrationError?: string;
  onReloadRobots: () => void;
}) {
  const set = (patch: Partial<ImagePanelConfig>) => onChange({ ...config, ...patch });
  const setTopic = (row: TopicRow, patch: TopicSettings) =>
    set({
      topics: {
        ...config.topics,
        [row.topic]: { ...config.topics[row.topic], type: row.type, ...patch },
      },
    });
  const setAllTopics = (visible: boolean) =>
    set({
      topics: Object.fromEntries([
        ...Object.entries(config.topics),
        ...topicRows.map((row) => [row.topic, { ...row.settings, type: row.type, visible }]),
      ]),
    });

  const autoCalibration = defaultCalibrationTopic(config.topic);
  const cameraInfoTopics = topics
    .filter((info) => normalizeMessageType(info.type) === CAMERA_INFO)
    .map((info) => info.topic);
  const calibration = config.calibrationTopic ?? AUTO;
  const calibrationOptions = [
    { value: AUTO, label: autoCalibration ? `Auto (${autoCalibration})` : 'Auto' },
    { value: '', label: 'None' },
    ...Array.from(
      new Set([...cameraInfoTopics, ...(config.calibrationTopic ? [config.calibrationTopic] : [])])
    )
      .sort()
      .map((topic) => ({ value: topic, label: topic })),
  ];
  const [gradientStart, gradientEnd] = config.gradient;

  return (
    <div className="scene-settings">
      <TreeSection
        title="General"
        keywords="image topic calibration camera_info rectify sync flip rotation color mode gradient value fps"
      >
        <TreeField label="Topic">
          <TopicInput
            aria-label="Image Topic"
            value={config.topic}
            onCommit={(topic) => set({ topic })}
            topics={topics}
            messageType={IMAGE_TYPES}
            placeholder="/camera/color/image_raw"
          />
        </TreeField>
        <SelectField
          label="Calibration"
          value={calibration}
          options={calibrationOptions}
          onChange={(value) => set({ calibrationTopic: value === AUTO ? undefined : value })}
          error={calibrationError}
        />
        <ToggleField
          label="Rectify"
          value={config.rectify}
          onChange={(rectify) => set({ rectify })}
        />
        <ToggleField
          label="Sync timestamps"
          value={config.syncTimestamps}
          onChange={(syncTimestamps) => set({ syncTimestamps })}
        />
        <ToggleField
          label="Flip horizontal"
          value={config.flipHorizontal}
          onChange={(flipHorizontal) => set({ flipHorizontal })}
        />
        <ToggleField
          label="Flip vertical"
          value={config.flipVertical}
          onChange={(flipVertical) => set({ flipVertical })}
        />
        <SelectField
          label="Rotation"
          value={String(config.rotation)}
          options={ROTATIONS.map((rotation) => ({
            value: String(rotation),
            label: `${rotation}°`,
          }))}
          onChange={(rotation) => set({ rotation: Number(rotation) as ImageRotation })}
        />
        <SelectField
          label="Color mode"
          value={config.colorMode}
          options={COLOR_MODES}
          onChange={(colorMode) => set({ colorMode })}
        />
        {config.colorMode === 'colormap' ? (
          <SelectField
            label="Color map"
            value={config.colorMap}
            options={COLOR_MAPS}
            onChange={(colorMap) => set({ colorMap })}
          />
        ) : (
          <>
            <ColorField
              label="Gradient start"
              value={gradientStart}
              onChange={(start) => set({ gradient: [start, gradientEnd] })}
            />
            <ColorField
              label="Gradient end"
              value={gradientEnd}
              onChange={(end) => set({ gradient: [gradientStart, end] })}
            />
          </>
        )}
        <OptionalNumberField
          label="Value min"
          value={config.valueMin}
          onCommit={(valueMin) => set({ valueMin })}
        />
        <OptionalNumberField
          label="Value max"
          value={config.valueMax}
          onCommit={(valueMax) => set({ valueMax })}
        />
        <SelectField
          label="Max FPS"
          value={String(config.maxFps)}
          options={MAX_FPS_CHOICES.map((fps) => ({
            value: String(fps),
            label: fps ? `${fps} fps` : 'Every frame',
          }))}
          onChange={(maxFps) => set({ maxFps: Number(maxFps) })}
        />
        <p className="px-4 py-2 text-xs text-gray-400">
          Color mode applies to depth and mono images. Max FPS limits how often this panel decodes
          and draws frames; the robot still sends every frame.
        </p>
      </TreeSection>

      <TreeSection title="Scene" keywords="label scale collada mesh up axis" defaultOpen={false}>
        <NumberField
          label="Label scale"
          value={config.scene.labelScale}
          min={0.1}
          max={10}
          step={0.1}
          onCommit={(labelScale) => set({ scene: { ...config.scene, labelScale } })}
        />
        <ToggleField
          label="Ignore COLLADA <up_axis>"
          value={config.scene.ignoreColladaUpAxis}
          onChange={(ignoreColladaUpAxis) =>
            set({ scene: { ...config.scene, ignoreColladaUpAxis } })
          }
        />
        <SelectField
          label="Mesh up axis"
          value={config.scene.meshUpAxis}
          options={[
            { value: 'z_up', label: 'Z-up' },
            { value: 'y_up', label: 'Y-up' },
          ]}
          onChange={(meshUpAxis) => set({ scene: { ...config.scene, meshUpAxis } })}
        />
      </TreeSection>

      <TransformsSection
        transforms={config.transforms}
        frames={frames}
        tree={tree}
        onChange={(patch) => set({ transforms: { ...config.transforms, ...patch } })}
      />

      <TopicsSection
        topicRows={topicRows}
        topics={topics}
        statuses={statuses}
        layerInfo={layerInfo}
        onTopicChange={setTopic}
        onSetAll={setAllTopics}
        onReloadRobots={onReloadRobots}
        emptyText="No topics can be drawn on the image. Connect to ROS, or refresh the topic list."
      />
    </div>
  );
}
