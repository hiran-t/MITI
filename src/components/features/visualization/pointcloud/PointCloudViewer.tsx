'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import Scene3D from '../urdf/Scene3D';
import { Loader2 } from 'lucide-react';
import * as THREE from 'three';
import { parsePointCloud2, type ParsedPoint } from '@/lib/parsers/pointcloud-parser';
import type { sensor_msgs } from '@/types/ros-messages';
import { visualizationStyles } from '@/styles';

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
    <div className={visualizationStyles.viewer.container}>
      <div className={visualizationStyles.viewer.header}>
        Point Cloud Viewer
      </div>

      <div className={visualizationStyles.viewer.statusBar}>
        {pointCount > 0 ? `${pointCount.toLocaleString()} points` : 'No data'}
        {lastUpdate && (
          <span className={visualizationStyles.pointcloud.pointsInfo}>
            {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {!pointCloudData ? (
        <div className={visualizationStyles.pointcloud.centerContent}>
          <div className={visualizationStyles.pointcloud.loadingContainer}>
            <Loader2 className={visualizationStyles.pointcloud.loadingSpinner} />
            <p className={visualizationStyles.pointcloud.loadingText}>
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
        <div className={visualizationStyles.pointcloud.parsingBadge}>
          Parsing...
        </div>
      )}
    </div>
  );
}
