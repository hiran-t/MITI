'use client';

import { useEffect, useRef, useState } from 'react';
import WidgetSettingsPortal, { SettingsSection } from '../../layout/WidgetSettingsPortal';
import { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import { findTopicType, topicTypeMismatch } from '@/lib/bridge/topics';
import { useTopic } from '@/hooks/useTopic';
import { Camera } from 'lucide-react';
import { drawImageMessage } from '@/lib/parsers/image-parser';
import { stampSeconds } from '@/lib/scene/transforms';
import type { sensor_msgs } from '@/types/ros-messages';
import { visualizationStyles } from '@/styles';
import { commonStyles } from '@/styles';
import { CAMERA_TOPICS as CAMERA_TOPIC_VALUES } from '@/constants/ros-topics';
import TopicInput from '../../topic-viewer/TopicInput';

interface CameraViewerProps {
  client: BridgeClient | null;
  topic?: string;
  topics?: TopicInfo[];
  onTopicChange: (topic: string) => void;
  /** Frames per second requested from the bridge; 0 receives every frame. */
  maxFps?: number;
  onMaxFpsChange: (maxFps: number) => void;
}

type ImageMessage = sensor_msgs.Image | sensor_msgs.CompressedImage;

const IMAGE_TYPE = 'sensor_msgs/msg/Image';
const COMPRESSED_IMAGE_TYPE = 'sensor_msgs/msg/CompressedImage';
const IMAGE_TYPES = [IMAGE_TYPE, COMPRESSED_IMAGE_TYPE];
// Raw frames are megabytes each; drawing at most ~10 fps (the newest frame wins) keeps the
// browser responsive with several cameras open.
const RENDER_THROTTLE_MS = 100;
const MAX_MEANINGFUL_LAG_S = 30;
/** Every frame, as Foxglove shows them; a cap only saves decoding and drawing. */
export const DEFAULT_CAMERA_MAX_FPS = 0;
const MAX_FPS_CHOICES = [1, 2, 5, 10, 15, 30, 0];

const CAMERA_PRESETS = [
  { value: CAMERA_TOPIC_VALUES.COLOR, label: 'Color Image' },
  { value: CAMERA_TOPIC_VALUES.DETECTION, label: 'Detection Image' },
  { value: CAMERA_TOPIC_VALUES.DEPTH, label: 'Depth Image' },
  { value: CAMERA_TOPIC_VALUES.IR, label: 'IR Image' },
];

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

// ─── Settings Panel ─────────────────────────────────────────────────────────

function CameraSettingsPanel({
  topic,
  topics,
  onTopicChange,
  maxFps,
  onMaxFpsChange,
}: {
  topic: string;
  topics: TopicInfo[];
  onTopicChange: (t: string) => void;
  maxFps: number;
  onMaxFpsChange: (maxFps: number) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className={commonStyles.input.label}>Image Topic</label>
          <TopicInput
            aria-label="Image Topic"
            value={topic}
            onCommit={onTopicChange}
            topics={topics}
            messageType={IMAGE_TYPES}
            className={commonStyles.input.base}
            placeholder="/camera/color/image_raw"
          />
          <p className={commonStyles.input.hint}>
            sensor_msgs/Image, or CompressedImage on topics ending in /compressed
          </p>
        </div>

        <div>
          <label className={commonStyles.input.label} htmlFor="camera-max-fps">
            Max FPS
          </label>
          <select
            id="camera-max-fps"
            aria-label="Max FPS"
            value={maxFps}
            onChange={(e) => onMaxFpsChange(Number(e.target.value))}
            className={commonStyles.input.base}
          >
            {MAX_FPS_CHOICES.map((fps) => (
              <option key={fps} value={fps}>
                {fps ? `${fps} fps` : 'Every frame'}
              </option>
            ))}
          </select>
          <p className={commonStyles.input.hint}>
            Limits how often this panel decodes and draws frames, to save CPU. The robot still sends
            every frame.
          </p>
        </div>

        <div>
          <label className={commonStyles.input.label}>Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {CAMERA_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => onTopicChange(preset.value)}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  topic === preset.value
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CameraViewer({
  client,
  topic: selectedTopic = CAMERA_PRESETS[0].value,
  topics = [],
  onTopicChange,
  maxFps = DEFAULT_CAMERA_MAX_FPS,
  onMaxFpsChange,
}: CameraViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestFrame = useRef<ImageMessage | null>(null);
  const drawing = useRef(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** How far the shown frame trails the robot's clock, in seconds. */
  const [lag, setLag] = useState<number | null>(null);

  const { data: imageData, lastUpdate } = useTopic<ImageMessage>(
    client,
    selectedTopic,
    isCompressedTopic(selectedTopic, topics) ? COMPRESSED_IMAGE_TYPE : IMAGE_TYPE,
    { throttleRate: RENDER_THROTTLE_MS, maxRate: maxFps || undefined }
  );
  const fps = useReceivedFps(lastUpdate);
  // Shown next to the rate: on a slow link, frame size explains a low frame rate.
  const frameBytes = imageData?.data?.length ?? 0;
  const actualType = topicTypeMismatch(topics, selectedTopic, IMAGE_TYPES);

  useEffect(() => {
    latestFrame.current = null;
    setSize(null);
    setError(null);
  }, [selectedTopic]);

  // Draw one frame at a time onto the same canvas. Frames that arrive while one is decoding
  // replace each other, so only the newest is drawn and the previous image stays until then.
  useEffect(() => {
    latestFrame.current = imageData;
    if (!imageData || drawing.current) return;
    drawing.current = true;
    (async () => {
      while (latestFrame.current && canvasRef.current) {
        const frame = latestFrame.current;
        latestFrame.current = null;
        try {
          setSize(await drawImageMessage(canvasRef.current, frame));
          setError(null);
          const robotNow = client?.getServerTime();
          const age =
            robotNow != null && frame.header ? robotNow - stampSeconds(frame.header.stamp) : null;
          // Stamps from another clock (e.g. wall time on a sim-time robot) say nothing about lag.
          setLag(age !== null && age > -1 && age < MAX_MEANINGFUL_LAG_S ? age : null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to decode image');
        }
      }
      drawing.current = false;
    })();
  }, [imageData, client]);

  const problem = actualType ? `${selectedTopic} publishes ${actualType}, not an image` : error;
  const showImage = client && size && !problem;

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

      {/* Status bar */}
      {showImage && (
        <div className={visualizationStyles.viewer.statusBarLower} style={{ top: '3.5rem' }}>
          <span>
            {size.width} × {size.height}
          </span>
          {fps !== null && <span>{fps.toFixed(fps < 10 ? 1 : 0)} fps</span>}
          {frameBytes > 0 && <span>{formatBytes(frameBytes)}/frame</span>}
          {lag !== null && lag > 0.3 && (
            <span className="text-amber-300" title="Age of the frame on the robot's clock">
              {lag.toFixed(1)} s behind
            </span>
          )}
          {lastUpdate && (
            <span className={visualizationStyles.camera.statusTime}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Image display area */}
      <div className={visualizationStyles.viewer.contentCenter}>
        <canvas
          ref={canvasRef}
          aria-label="Camera feed"
          hidden={!showImage}
          className={visualizationStyles.camera.image}
          style={{ imageRendering: selectedTopic.includes('depth') ? 'pixelated' : 'auto' }}
        />
        {!client ? (
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
          !size && (
            <div className={visualizationStyles.camera.emptyState}>
              <Camera className={visualizationStyles.camera.emptyIcon} />
              <p className={visualizationStyles.camera.emptyText}>Waiting for image data...</p>
              <p className={visualizationStyles.camera.emptySubtext}>{selectedTopic}</p>
            </div>
          )
        )}
      </div>

      {/* Settings overlay */}
      <WidgetSettingsPortal>
        <SettingsSection
          title="General"
          keywords="image topic camera presets color detection depth IR compressed"
        >
          <CameraSettingsPanel
            topic={selectedTopic}
            topics={topics}
            onTopicChange={onTopicChange}
            maxFps={maxFps}
            onMaxFpsChange={onMaxFpsChange}
          />
        </SettingsSection>
      </WidgetSettingsPortal>
    </div>
  );
}
