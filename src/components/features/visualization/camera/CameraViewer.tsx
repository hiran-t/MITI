'use client';

import { useEffect, useState, useCallback } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import { Loader2, Camera, Settings, X } from 'lucide-react';
import { parseImageMessage } from '@/lib/parsers/image-parser';
import type { sensor_msgs } from '@/types/ros-messages';
import { visualizationStyles } from '@/styles';
import { commonStyles } from '@/styles';
import { CAMERA_TOPICS as CAMERA_TOPIC_VALUES } from '@/constants/ros-topics';

interface CameraViewerProps {
  client: ROSBridge | null;
  topic?: string;
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
  onClose,
}: {
  topic: string;
  onTopicChange: (t: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(topic);

  const handleApply = () => {
    onTopicChange(draft);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-lg bg-gray-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-800 px-4 py-3">
        <Settings className="h-3.5 w-3.5 text-gray-500" />
        <span className="flex-1 text-sm font-semibold text-gray-200">Camera Settings</span>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-800/50 hover:text-gray-300"
          aria-label="Close settings"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className={commonStyles.input.label}>Image Topic</label>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
                onClick={() => setDraft(preset.value)}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  draft === preset.value
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

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-800 px-4 py-3">
        <button onClick={handleApply} className={`w-full ${commonStyles.button.primary} text-sm`}>
          Apply
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CameraViewer({ client, topic: initialTopic }: CameraViewerProps) {
  const [selectedTopic, setSelectedTopic] = useState(initialTopic || CAMERA_PRESETS[0].value);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { data: imageData, lastUpdate } = useTopic<sensor_msgs.Image>(
    client,
    selectedTopic,
    'sensor_msgs/Image'
  );

  useEffect(() => {
    if (!imageData) return;

    setProcessing(true);
    setError(null);

    // Process image in a non-blocking way
    setTimeout(() => {
      try {
        const url = parseImageMessage(imageData);

        // Revoke previous object URL to prevent memory leaks
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
        }

        setImageUrl(url);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to parse image');
      } finally {
        setProcessing(false);
      }
    }, 0);

    // Cleanup function to revoke object URL
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageData]);

  const handleTopicChange = useCallback(
    (newTopic: string) => {
      // Clean up current image URL before switching topics
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setError(null);
      setSelectedTopic(newTopic);
    },
    [imageUrl]
  );

  // Find label for current topic if it matches a preset
  const currentPreset = CAMERA_PRESETS.find((p) => p.value === selectedTopic);
  const topicDisplayName = currentPreset ? currentPreset.label : selectedTopic.split('/').pop();

  return (
    <div className={visualizationStyles.viewer.container}>
      {/* Header with title and settings button */}
      <div className={visualizationStyles.camera.headerBar}>
        <div className={visualizationStyles.camera.title}>
          <Camera className={visualizationStyles.camera.titleIcon} />
          Camera Viewer
        </div>

        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-gray-400" title={selectedTopic}>
            {topicDisplayName}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-800/50 hover:text-gray-300"
            aria-label="Camera settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Status bar */}
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
      {showSettings && (
        <CameraSettingsPanel
          topic={selectedTopic}
          onTopicChange={handleTopicChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
