'use client';

import { useEffect, useState, useMemo } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import * as THREE from 'three';
import { parsePointCloud2, type ParsedPoint } from '@/lib/parsers/pointcloud-parser';
import type { sensor_msgs } from '@/types/ros-messages';

interface PointCloudProps {
  points: ParsedPoint[];
}

function PointCloud({ points }: PointCloudProps) {
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
      <pointsMaterial size={0.02} vertexColors={true} sizeAttenuation={true} />
    </points>
  );
}

interface PointCloudRendererProps {
  client: ROSBridge | null;
  topic: string;
}

/**
 * Component that subscribes to a single point cloud topic and renders it
 * Designed to be used inside a Scene3D component
 */
export default function PointCloudRenderer({ client, topic }: PointCloudRendererProps) {
  const { data: pointCloudData } = useTopic<sensor_msgs.PointCloud2>(
    client,
    topic,
    'sensor_msgs/PointCloud2'
  );

  const [points, setPoints] = useState<ParsedPoint[]>([]);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (!pointCloudData) return;

    setParsing(true);
    // Parse point cloud in a non-blocking way
    setTimeout(() => {
      try {
        const parsed = parsePointCloud2(pointCloudData);
        setPoints(parsed);
      } catch (error) {
        console.error(`Error parsing point cloud from ${topic}:`, error);
        setPoints([]);
      } finally {
        setParsing(false);
      }
    }, 0);
  }, [pointCloudData, topic]);

  // Only render if we have points
  if (points.length === 0) {
    return null;
  }

  return <PointCloud points={points} />;
}
