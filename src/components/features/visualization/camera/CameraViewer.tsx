'use client';

import { useEffect, useState, useCallback } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import { Loader2, Camera } from 'lucide-react';
import { parseImageMessage } from '@/lib/parsers/image-parser';
import type { sensor_msgs } from '@/types/ros-messages';
import { visualizationStyles } from '@/styles';

interface CameraViewerProps {
  client: ROSBridge | null;
  topic?: string;
}

const CAMERA_TOPICS = [
  { value: '/camera/color/image_raw', label: 'Color Image' },
  { value: '/pacen_decon_vision/detection_image', label: 'Detection Image' },
  { value: '/camera/depth/image_raw', label: 'Depth Image' },
  { value: '/camera/ir/image_raw', label: 'IR Image' },
];

export default function CameraViewer({ client, topic: initialTopic }: CameraViewerProps) {
  const [selectedTopic, setSelectedTopic] = useState(initialTopic || CAMERA_TOPICS[0].value);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: imageData, lastUpdate } = useTopic<sensor_msgs.Image>(
    client,
    selectedTopic,
    'sensor_msgs/Image'
  );

  useEffect(() => {
    if (!imageData) return;

    // console.log('Received image data:', {
    //   width: imageData.width,
    //   height: imageData.height,
    //   encoding: imageData.encoding,
    //   dataLength: imageData.data?.length,
    //   dataType: typeof imageData.data,
    //   isArray: Array.isArray(imageData.data)
    // });

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
        // console.log('Image URL created successfully');
      } catch (error) {
        // console.error('Error parsing image:', error);
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
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      // Clean up current image URL before switching topics
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setSelectedTopic(event.target.value);
    },
    [imageUrl]
  );

  return (
    <div className={visualizationStyles.viewer.container}>
      {/* Header with title and topic selector */}
      <div className={visualizationStyles.camera.headerBar}>
        <div className={visualizationStyles.camera.title}>
          <Camera className={visualizationStyles.camera.titleIcon} />
          Camera Viewer
        </div>

        <select
          value={selectedTopic}
          onChange={handleTopicChange}
          disabled={!client}
          className={visualizationStyles.camera.select}
        >
          {CAMERA_TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
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
    </div>
  );
}
