'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Pose } from '@/types/scene';
import { poseMatrix } from '@/lib/scene/geometry';
export function Cloud({
  positions,
  colors,
  size,
  color,
  opacity,
}: {
  positions: number[];
  colors?: number[];
  size: number;
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={size}
        color={colors ? 'white' : color}
        vertexColors={!!colors}
        transparent
        opacity={opacity}
        sizeAttenuation
      />
    </points>
  );
}
export function PoseArrow({
  pose,
  size,
  color,
  opacity = 1,
}: {
  pose: Pose;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <group matrix={poseMatrix(pose)} matrixAutoUpdate={false}>
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[size * 0.35, 0, 0]}>
        <cylinderGeometry args={[size * 0.035, size * 0.035, size * 0.7, 8]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[size * 0.85, 0, 0]}>
        <coneGeometry args={[size * 0.1, size * 0.3, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}
export function MapPlane({
  pixels,
  width,
  height,
  resolution,
  matrix,
  opacity,
}: {
  pixels: Uint8Array;
  width: number;
  height: number;
  resolution: number;
  matrix: THREE.Matrix4;
  opacity: number;
}) {
  const texture = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(pixels), width, height, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }, [pixels, width, height]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <mesh position={[(width * resolution) / 2, (height * resolution) / 2, 0]}>
        <planeGeometry args={[width * resolution, height * resolution]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
