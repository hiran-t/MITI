'use client';

import { useEffect, useState, useCallback } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/app/hooks/useTopic';
import { Loader2, Camera } from 'lucide-react';
import { parseImageMessage } from '../../../lib/utils/image-parser';
import type { sensor_msgs } from '@/types/ros-messages';

interface CameraViewerProps {
  client: ROSBridge | null;
  topic?: string;
}

const CAMERA_TOPICS = [
  { value: '/camera/color/image_raw', label: 'Color Image' },
  { value: '/camera/depth/image_raw', label: 'Depth Image' },
  { value: '/camera/ir/image_raw', label: 'IR Image' },
];

export default function CameraViewer({ client, topic: initialTopic }: CameraViewerProps) {
  const [selectedTopic, setSelectedTopic] = useState(
    initialTopic || CAMERA_TOPICS[0].value
  );
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

    console.log('Received image data:', {
      width: imageData.width,
      height: imageData.height,
      encoding: imageData.encoding,
      dataLength: imageData.data?.length,
      dataType: typeof imageData.data,
      isArray: Array.isArray(imageData.data)
    });

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
        console.log('Image URL created successfully');
      } catch (error) {
        console.error('Error parsing image:', error);
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

  const handleTopicChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    // Clean up current image URL before switching topics
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
    setSelectedTopic(event.target.value);
  }, [imageUrl]);

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
      {/* Header with title and topic selector */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800">
          <Camera className="w-4 h-4" />
          Camera Viewer
        </div>

        <select
          value={selectedTopic}
          onChange={handleTopicChange}
          disabled={!client}
          className="px-3 py-1.5 bg-gray-900/90 rounded text-xs text-gray-300 border border-gray-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {CAMERA_TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status bar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 rounded text-xs text-gray-400 border border-gray-800" style={{ top: '3.5rem' }}>
        {processing && (
          <Loader2 className="w-3 h-3 animate-spin" />
        )}
        {imageData && (
          <span>
            {imageData.width} × {imageData.height}
          </span>
        )}
        {lastUpdate && (
          <span className="text-gray-500">
            {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Image display area */}
      <div className="w-full h-full flex items-center justify-center">
        {!client ? (
          <div className="text-center text-gray-500">
            <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Not connected to ROS</p>
          </div>
        ) : error ? (
          <div className="text-center text-red-500">
            <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Error: {error}</p>
            <p className="text-xs mt-1 text-gray-600">{selectedTopic}</p>
          </div>
        ) : !imageUrl ? (
          <div className="text-center text-gray-500">
            <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Waiting for image data...</p>
            <p className="text-xs mt-1 text-gray-600">{selectedTopic}</p>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="Camera feed"
            className="max-w-full max-h-full object-contain"
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
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
