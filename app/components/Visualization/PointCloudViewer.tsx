'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/app/hooks/useTopic';
import Scene3D from './Scene3D';
import { Loader2 } from 'lucide-react';
import * as THREE from 'three';
import { parsePointCloud2, type ParsedPoint } from '@/lib/utils/pointcloud-parser';
import type { sensor_msgs } from '@/types/ros-messages';

interface PointCloudViewerProps {
  client: ROSBridge | null;
  topic?: string;
}

function PointCloud({ points }: { points: ParsedPoint[] }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);

    points.forEach((point, i) => {
      const idx = i * 3;
      positions[idx] = point.x;
      positions[idx + 1] = point.y;
      positions[idx + 2] = point.z;

      // Use RGB if available, otherwise color by depth (z-value)
      if (point.r !== undefined && point.g !== undefined && point.b !== undefined) {
        colors[idx] = point.r;
        colors[idx + 1] = point.g;
        colors[idx + 2] = point.b;
      } else {
        // Color by depth (z-coordinate)
        const depth = Math.abs(point.z);
        const normalized = Math.min(depth / 5, 1); // Normalize to 0-5 meters
        colors[idx] = 1 - normalized; // Red decreases with depth
        colors[idx + 1] = 0.5;
        colors[idx + 2] = normalized; // Blue increases with depth
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geo;
  }, [points]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.02}
        vertexColors={true}
        sizeAttenuation={true}
      />
    </points>
  );
}

export default function PointCloudViewer({ client, topic = '/camera/depth/points' }: PointCloudViewerProps) {
  const { data: pointCloudData, lastUpdate } = useTopic<sensor_msgs.PointCloud2>(
    client,
    topic,
    'sensor_msgs/PointCloud2'
  );

  const [points, setPoints] = useState<ParsedPoint[]>([]);
  const [parsing, setParsing] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  useEffect(() => {
    if (!pointCloudData) return;

    setParsing(true);
    // Parse point cloud in a non-blocking way
    setTimeout(() => {
      try {
        const parsed = parsePointCloud2(pointCloudData);
        setPoints(parsed);
        setPointCount(parsed.length);
      } catch (error) {
        console.error('Error parsing point cloud:', error);
      } finally {
        setParsing(false);
      }
    }, 0);
  }, [pointCloudData]);

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800">
        Point Cloud Viewer
      </div>

      <div className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-gray-900/90 rounded text-xs text-gray-400 border border-gray-800">
        {pointCount > 0 ? `${pointCount.toLocaleString()} points` : 'No data'}
        {lastUpdate && (
          <span className="ml-2 text-gray-500">
            {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {!pointCloudData ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              Waiting for {topic} topic...
            </p>
          </div>
        </div>
      ) : (
        <Scene3D>
          {points.length > 0 && <PointCloud points={points} />}
        </Scene3D>
      )}

      {parsing && (
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-yellow-500/20 rounded text-xs text-yellow-400 border border-yellow-500/30">
          Parsing...
        </div>
      )}
    </div>
  );
}
