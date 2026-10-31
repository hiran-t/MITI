'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import WidgetSettingsPortal, { PanelStatusPortal } from '../../layout/WidgetSettingsPortal';
import { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import { findTopicType, topicTypeMismatch } from '@/lib/bridge/topics';
import { useTopic } from '@/hooks/useTopic';
import { useTF } from '@/hooks/useTF';
import { Camera } from 'lucide-react';
import { frameName, lookupTransform, stampSeconds } from '@/lib/scene/transforms';
import {
  cameraModel,
  displayIntrinsics,
  imageTransform,
  overlayMatrix,
  type CameraInfo,
} from '@/lib/camera/projection';
import { colorLut, valueRange } from '@/lib/camera/image-colors';
import {
  calibrationTopicOf,
  normalizeImageConfig,
  type ImagePanelConfig,
} from '@/lib/camera/image-config';
import type { TopicLayerType } from '@/types/scene-config';
import type { TFTree } from '@/types/tf-messages';
import { UI_TOKENS } from '@/lib/theme';
import { visualizationStyles } from '@/styles';
import { CAMERA_TOPICS as CAMERA_TOPIC_VALUES } from '@/constants/ros-topics';
import { publishedCameraTopic } from '@/lib/camera/default-topic';
import SceneLayers, {
  useLayerReports,
  useTFFrames,
  useTopicRows,
  visibleProblems,
} from '../scene/SceneLayers';
import ImageView from './ImageView';
import ImageSettings from './ImageSettings';
import { useImageSource, type ImageMessage } from './useImageSource';

interface CameraViewerProps {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  /** Stored widget props; MITI ≤ 3.0 props are migrated on read. */
  props: unknown;
  onPropsChange: (config: ImagePanelConfig) => void;
}

const IMAGE_TYPE = 'sensor_msgs/msg/Image';
const COMPRESSED_IMAGE_TYPE = 'sensor_msgs/msg/CompressedImage';
const CAMERA_INFO_TYPE = 'sensor_msgs/msg/CameraInfo';
const IMAGE_TYPES = [IMAGE_TYPE, COMPRESSED_IMAGE_TYPE];
// Raw frames are megabytes each; drawing at most ~10 fps (the newest frame wins) keeps the
// browser responsive with several cameras open.
const RENDER_THROTTLE_MS = 100;
// Calibration rarely changes; one CameraInfo a second is plenty.
const CAMERA_INFO_OPTIONS = { throttleRate: 1000 };
const MAX_MEANINGFUL_LAG_S = 30;
const BACKGROUND = UI_TOKENS['bg-viewport'];
/** Images and calibrations are the panel itself, not overlays. */
const NOT_OVERLAYS: TopicLayerType[] = ['camera'];
/** Overlays are opt-in, as in Foxglove's Image panel. */
const hiddenByDefault = () => false;

/** image_transport publishes JPEG/PNG frames on `<topic>/compressed`. */
function isCompressedTopic(topic: string, topics: TopicInfo[]): boolean {
  const type = findTopicType(topics, topic);
  return type ? type.endsWith('CompressedImage') : topic.endsWith('/compressed');
}

const formatBytes = (bytes: number) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

/** Frames actually received per second, over the last few seconds. */
function useReceivedFps(lastUpdate: Date | null): number | null {
  const arrivals = useRef<number[]>([]);
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    if (!lastUpdate) {
      arrivals.current = [];
      setFps(null);
      return;
    }
    const now = lastUpdate.getTime();
    arrivals.current = [...arrivals.current.filter((t) => now - t < 5000), now];
    const span = (now - arrivals.current[0]) / 1000;
    setFps(span > 0 ? (arrivals.current.length - 1) / span : null);
  }, [lastUpdate]);
  return fps;
}

/** The root of the TF tree `frame` belongs to; overlays are accumulated there. */
function rootFrame(tree: TFTree, frame: string): string {
  let name = frame;
  const seen = new Set<string>();
  while (!seen.has(name)) {
    seen.add(name);
    const parent = tree.frames.get(name)?.parent;
    if (!parent) break;
    name = frameName(parent);
  }
  return name;
}

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * The Image panel, after Foxglove's: a camera image with 3D topics drawn over it through the
 * camera's calibration and TF, Color mode for depth and mono images, flips, rotation and Rectify.
 */
export default function CameraViewer({
  client,
  topics = [],
  props,
  onPropsChange,
}: CameraViewerProps) {
  const config = useMemo(() => normalizeImageConfig(props, CAMERA_TOPIC_VALUES.COLOR), [props]);
  const selectedTopic = config.topic;

  // A default topic the robot does not publish: show the robot's own camera topic instead.
  useEffect(() => {
    const published = publishedCameraTopic(config.topic, topics);
    if (published) onPropsChange({ ...config, topic: published });
  }, [config, topics, onPropsChange]);
  /** How far the shown frame trails the robot's clock, in seconds. */
  const [lag, setLag] = useState<number | null>(null);
  const [meshEpoch, setMeshEpoch] = useState(0);

  const { data: imageData, lastUpdate } = useTopic<ImageMessage>(
    client,
    selectedTopic,
    isCompressedTopic(selectedTopic, topics) ? COMPRESSED_IMAGE_TYPE : IMAGE_TYPE,
    { throttleRate: RENDER_THROTTLE_MS, maxRate: config.maxFps || undefined }
  );
  const fps = useReceivedFps(lastUpdate);
  // Shown next to the rate: on a slow link, frame size explains a low frame rate.
  const frameBytes = imageData?.data?.length ?? 0;
  const actualType = topicTypeMismatch(topics, selectedTopic, IMAGE_TYPES);
  const { source, error } = useImageSource(imageData, selectedTopic);

  useEffect(() => {
    if (!source) return setLag(null);
    const robotNow = client?.getServerTime();
    const age = robotNow != null ? robotNow - stampSeconds(source.header.stamp) : null;
    // Stamps from another clock (e.g. wall time on a sim-time robot) say nothing about lag.
    setLag(age !== null && age > -1 && age < MAX_MEANINGFUL_LAG_S ? age : null);
  }, [source, client]);

  // ── Calibration ──
  const calibrationTopic = calibrationTopicOf(config);
  const { data: cameraInfo } = useTopic<CameraInfo>(
    client,
    calibrationTopic,
    CAMERA_INFO_TYPE,
    CAMERA_INFO_OPTIONS
  );
  const width = source?.width ?? 0;
  const height = source?.height ?? 0;
  const calibration = useMemo(() => {
    if (!cameraInfo || !width || !height) return { model: null, error: '' };
    try {
      return { model: cameraModel(cameraInfo, { width, height }, config.rectify), error: '' };
    } catch (err) {
      return { model: null, error: err instanceof Error ? err.message : 'Invalid CameraInfo' };
    }
  }, [cameraInfo, width, height, config.rectify]);
  const model = calibration.model;
  const { rotation, flipHorizontal, flipVertical } = config;
  const transform = useMemo(
    () =>
      width && height
        ? imageTransform(width, height, rotation, flipHorizontal, flipVertical)
        : null,
    [width, height, rotation, flipHorizontal, flipVertical]
  );
  const intrinsics = useMemo(
    () =>
      transform &&
      displayIntrinsics(
        // Without calibration nothing is projected; any camera will do for the image alone.
        model?.intrinsics ?? { fx: width, fy: width, cx: width / 2, cy: height / 2 },
        transform
      ),
    [model, transform, width, height]
  );

  // ── Overlays ──
  const { statuses, reportStatus, layerInfo, reportInfo } = useLayerReports();
  const topicRows = useTopicRows(topics, config.topics, {
    defaultVisible: hiddenByDefault,
    exclude: NOT_OVERLAYS,
  });
  const overlaysWanted = topicRows.some((row) => row.visible) || config.transforms.visible;
  // TF only matters once something is drawn over the image.
  const { tfTree } = useTF({
    client,
    enabled: overlaysWanted,
    tfTopics: config.transforms.tfTopics,
    staticTopics: config.transforms.staticTfTopics,
  });
  const { frames } = useTFFrames(tfTree);
  const cameraFrame = frameName(source?.header.frame_id || cameraInfo?.header.frame_id || '');
  const fixedFrame = useMemo(() => rootFrame(tfTree, cameraFrame), [tfTree, cameraFrame]);
  const imageStamp = source ? stampSeconds(source.header.stamp) : 0;
  const placement = useMemo(() => {
    if (!overlaysWanted || !model || !transform || !cameraFrame)
      return { overlay: null, problem: '' };
    if (fixedFrame === cameraFrame && tfTree.frames.size > 0 && !tfTree.frames.has(cameraFrame))
      return {
        overlay: overlayMatrix(lookupTransform(tfTree, cameraFrame, cameraFrame), model, transform),
        problem: `Frame ${cameraFrame} is not in TF; only topics in that frame line up`,
      };
    try {
      const time = config.syncTimestamps ? imageStamp : 0;
      return {
        overlay: overlayMatrix(
          lookupTransform(tfTree, cameraFrame, fixedFrame, time),
          model,
          transform
        ),
        problem: '',
      };
    } catch (err) {
      if (!config.syncTimestamps) return { overlay: null, problem: (err as Error).message };
      // A clock mismatch or a gap in TF history: fall back to the latest transform.
      try {
        return {
          overlay: overlayMatrix(
            lookupTransform(tfTree, cameraFrame, fixedFrame),
            model,
            transform
          ),
          problem: `No TF at the image time (${(err as Error).message}); using the latest`,
        };
      } catch (latest) {
        return { overlay: null, problem: (latest as Error).message };
      }
    }
  }, [
    overlaysWanted,
    model,
    transform,
    cameraFrame,
    fixedFrame,
    tfTree,
    imageStamp,
    config.syncTimestamps,
  ]);

  // ── Color mode ──
  const { colorMode, colorMap } = config;
  const [gradientStart, gradientEnd] = config.gradient;
  const lut = useMemo(
    () => colorLut({ colorMode, colorMap, gradient: [gradientStart, gradientEnd] }),
    [colorMode, colorMap, gradientStart, gradientEnd]
  );
  const [rangeMin, rangeMax] = source?.scalar ? valueRange(source.scalar, config) : [0, 1];
  const range = useMemo<[number, number]>(() => [rangeMin, rangeMax], [rangeMin, rangeMax]);

  // ── Problems ──
  const wantsCalibration = overlaysWanted || config.rectify;
  const calibrationPublished = !topics.length || topics.some((t) => t.topic === calibrationTopic);
  const calibrationError = !wantsCalibration
    ? undefined
    : !calibrationTopic
      ? 'Choose a calibration topic to draw topics on the image or rectify it'
      : calibration.error ||
        (!cameraInfo
          ? calibrationPublished
            ? `Waiting for CameraInfo on ${calibrationTopic}`
            : `${calibrationTopic} is not published`
          : undefined);
  const overlayProblems = [
    ...(calibrationError ? [`${calibrationError} · showing the image only`] : []),
    ...(placement.problem ? [placement.problem] : []),
    ...visibleProblems(statuses, topicRows).map(
      ([id, status]) => `${id.replace(/^topic:/, '')}: ${status.message}`
    ),
  ];

  const problem = actualType ? `${selectedTopic} publishes ${actualType}, not an image` : error;
  const showImage = client && source && transform && intrinsics && !problem;

  return (
    <div className={visualizationStyles.viewer.container}>
      {/* Header with title and settings button */}
      <div className={visualizationStyles.camera.headerBar}>
        <Camera className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-gray-400"
          title={selectedTopic}
        >
          {selectedTopic}
        </span>
      </div>

      {/* Live stats sit in the panel's tab bar, off the image */}
      {showImage && (
        <PanelStatusPortal>
          <span className="status-mid">
            {source.width} × {source.height}
          </span>
          {fps !== null && <span>{fps.toFixed(fps < 10 ? 1 : 0)} fps</span>}
          {frameBytes > 0 && <span className="status-low">{formatBytes(frameBytes)}/frame</span>}
          {lag !== null && lag > 0.3 && (
            <span className="text-warn" title="Age of the frame on the robot's clock">
              {lag.toFixed(1)} s behind
            </span>
          )}
          {lastUpdate && (
            <span className={`status-low ${visualizationStyles.camera.statusTime}`}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </PanelStatusPortal>
      )}

      {/* Image display area */}
      <div className={visualizationStyles.viewer.contentCenter}>
        {showImage ? (
          <ImageView
            source={source}
            transform={transform}
            model={model}
            intrinsics={intrinsics}
            rectify={config.rectify}
            lut={lut}
            range={range}
            background={BACKGROUND}
            overlay={placement.overlay}
            version={[source.version, tfTree, statuses]}
          >
            <SceneLayers
              client={client}
              topics={topics}
              topicRows={topicRows}
              tfTree={tfTree}
              fixedFrame={fixedFrame}
              sync={config.syncTimestamps}
              transforms={config.transforms}
              scene={config.scene}
              meshEpoch={meshEpoch}
              onStatus={reportStatus}
              onInfo={reportInfo}
            />
          </ImageView>
        ) : !client ? (
          <div className={visualizationStyles.camera.emptyState}>
            <Camera className={visualizationStyles.camera.emptyIcon} />
            <p className={visualizationStyles.camera.emptyText}>Not connected to ROS</p>
          </div>
        ) : problem ? (
          <div className={visualizationStyles.camera.errorState}>
            <Camera className={visualizationStyles.camera.emptyIcon} />
            <p className={visualizationStyles.camera.emptyText}>Error: {problem}</p>
            <p className={visualizationStyles.camera.emptySubtext}>{selectedTopic}</p>
          </div>
        ) : (
          <div className={visualizationStyles.camera.emptyState}>
            <Camera className={visualizationStyles.camera.emptyIcon} />
            <p className={visualizationStyles.camera.emptyText}>Waiting for image data...</p>
            <p className={visualizationStyles.camera.emptySubtext}>{selectedTopic}</p>
          </div>
        )}
      </div>

      {showImage && overlayProblems.length > 0 && (
        <div className="scene-status-overlay" role="status">
          {overlayProblems.map((message) => (
            <span key={message} className="text-warn">
              {message}
            </span>
          ))}
        </div>
      )}

      <WidgetSettingsPortal>
        <ImageSettings
          config={config}
          onChange={onPropsChange}
          topics={topics}
          topicRows={topicRows}
          statuses={statuses}
          layerInfo={layerInfo}
          frames={frames}
          tree={tfTree}
          calibrationError={calibrationError}
          onReloadRobots={async () => {
            await client?.clearAssetCache();
            setMeshEpoch((epoch) => epoch + 1);
          }}
        />
      </WidgetSettingsPortal>
    </div>
  );
}
