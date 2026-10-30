'use client';
import { MITI_CYAN } from '@/lib/theme';
import { useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PublishType } from '@/types/scene-config';
import { PoseArrow } from './Primitives';

export interface PublishTarget {
  x: number;
  y: number;
  /** Heading in radians; undefined for points. */
  yaw?: number;
}

const ARROW_COLOR: Record<PublishType, string> = {
  point: MITI_CYAN,
  pose: '#22c55e',
  pose_estimate: '#38bdf8',
};

/**
 * Click-to-publish on the fixed frame's ground plane: click for a point; press, drag toward
 * the heading and release for a pose. Rendered inside the fixed-frame group.
 */
export default function PublishTool({
  type,
  onPublish,
}: {
  type: PublishType;
  onPublish: (target: PublishTarget) => void;
}) {
  const [start, setStart] = useState<THREE.Vector3 | null>(null);
  const [yaw, setYaw] = useState(0);
  // e.point is in world coordinates; the plane's parent is the fixed frame.
  const local = (e: ThreeEvent<PointerEvent>) =>
    e.eventObject.parent!.worldToLocal(e.point.clone());
  return (
    <>
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setStart(local(e));
          setYaw(0);
        }}
        onPointerMove={(e) => {
          if (!start || type === 'point') return;
          e.stopPropagation();
          const point = local(e);
          if (point.distanceTo(start) > 0.01)
            setYaw(Math.atan2(point.y - start.y, point.x - start.x));
        }}
        onPointerUp={(e) => {
          if (!start) return;
          e.stopPropagation();
          onPublish(
            type === 'point' ? { x: start.x, y: start.y } : { x: start.x, y: start.y, yaw }
          );
          setStart(null);
        }}
      >
        <planeGeometry args={[1e4, 1e4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {start && type !== 'point' && (
        <PoseArrow
          pose={{
            position: { x: start.x, y: start.y, z: 0 },
            orientation: { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) },
          }}
          size={1}
          color={ARROW_COLOR[type]}
        />
      )}
    </>
  );
}
