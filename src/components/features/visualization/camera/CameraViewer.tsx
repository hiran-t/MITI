'use client';

import { useEffect, useState } from 'react';
import WidgetSettingsPortal, { SettingsSection } from '../../layout/WidgetSettingsPortal';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import { Loader2, Camera, X } from 'lucide-react';
import { parseImageMessage } from '@/lib/parsers/image-parser';
import type { sensor_msgs } from '@/types/ros-messages';
import { visualizationStyles } from '@/styles';
import { commonStyles } from '@/styles';
import { CAMERA_TOPICS as CAMERA_TOPIC_VALUES } from '@/constants/ros-topics';

interface CameraViewerProps {
  client: ROSBridge | null;
  topic?: string;
  onTopicChange: (topic: string) => void;
}

const CAMERA_PRESETS = [
  { value: CAMERA_TOPIC_VALUES.COLOR, label: 'Color Image' },
  { value: CAMERA_TOPIC_VALUES.DETECTION, label: 'Detection Image' },
  { value: CAMERA_TOPIC_VALUES.DEPTH, label: 'Depth Image' },
  { value: CAMERA_TOPIC_VALUES.IR, label: 'IR Image' },
];

// ─── Settings Panel ─────────────────────────────────────────────────────────

function CameraSettingsPanel({
  topic,
  onTopicChange,
}: {
  topic: string;
  onTopicChange: (t: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className={commonStyles.input.label}>Image Topic</label>
          <input
            type="text"
            aria-label="Image Topic"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            className={commonStyles.input.base}
            placeholder="/camera/color/image_raw"
          />
          <p className={commonStyles.input.hint}>ROS topic publishing sensor_msgs/Image</p>
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
  onTopicChange,
}: CameraViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: imageData, lastUpdate } = useTopic<sensor_msgs.Image>(
    client,
    selectedTopic,
    'sensor_msgs/Image'
  );

  useEffect(() => {
    setImageUrl(null);
    setError(null);
    setProcessing(false);
    if (!imageData) return;
    let objectUrl: string | null = null;
    setProcessing(true);
    const timer = setTimeout(() => {
      try {
        objectUrl = parseImageMessage(imageData);
        setImageUrl(objectUrl);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to parse image');
      } finally {
        setProcessing(false);
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageData, selectedTopic]);

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
      {(processing || imageData || lastUpdate) && (
        <div className={visualizationStyles.viewer.statusBarLower} style={{ top: '3.5rem' }}>
          {processing && <Loader2 className={visualizationStyles.camera.statusIcon} />}
          {imageData && (
            <span>
              {imageData.width} × {imageData.height}
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
        {!client ? (
          <div className={visualizationStyles.camera.emptyState}>
            <Camera className={visualizationStyles.camera.emptyIcon} />
            <p className={visualizationStyles.camera.emptyText}>Not connected to ROS</p>
          </div>
        ) : error ? (
          <div className={visualizationStyles.camera.errorState}>
            <Camera className={visualizationStyles.camera.emptyIcon} />
            <p className={visualizationStyles.camera.emptyText}>Error: {error}</p>
            <p className={visualizationStyles.camera.emptySubtext}>{selectedTopic}</p>
          </div>
        ) : !imageUrl ? (
          <div className={visualizationStyles.camera.emptyState}>
            <Camera className={visualizationStyles.camera.emptyIcon} />
            <p className={visualizationStyles.camera.emptyText}>Waiting for image data...</p>
            <p className={visualizationStyles.camera.emptySubtext}>{selectedTopic}</p>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="Camera feed"
            className={visualizationStyles.camera.image}
            style={{ imageRendering: selectedTopic.includes('depth') ? 'pixelated' : 'auto' }}
            onError={(e) => {
              console.error('Image failed to load:', e);
              setError('Failed to load image');
            }}
          />
        )}
      </div>

      {/* Loading overlay */}
      {processing && imageUrl && (
        <div className={visualizationStyles.camera.loadingOverlay}>
          <Loader2 className={visualizationStyles.camera.loadingSpinner} />
        </div>
      )}

      {/* Settings overlay */}
      <WidgetSettingsPortal>
        <SettingsSection
          title="General"
          keywords="image topic camera presets color detection depth IR"
        >
          <CameraSettingsPanel topic={selectedTopic} onTopicChange={onTopicChange} />
        </SettingsSection>
      </WidgetSettingsPortal>
    </div>
  );
}
