'use client';
import { useMemo } from 'react';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { GridLayerConfig } from '@/types/scene-config';

const DEG = Math.PI / 180;

/** A finite grid on the XY plane of `frame` (positioned by the caller), like Foxglove's grid layer. */
export default function GridLayer({
  layer,
  frame,
}: {
  layer: GridLayerConfig;
  /** Transform from the grid's frame into the fixed frame. */
  frame: THREE.Matrix4;
}) {
  const matrix = useMemo(() => {
    const [roll, pitch, yaw] = layer.rotation;
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...layer.position),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(roll * DEG, pitch * DEG, yaw * DEG, 'ZYX')
      ),
      new THREE.Vector3(1, 1, 1)
    );
    return frame.clone().multiply(local);
  }, [frame, layer.position, layer.rotation]);
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <Grid
        args={[layer.size, layer.size]}
        cellSize={layer.size / Math.max(1, layer.divisions)}
        cellThickness={layer.lineWidth}
        cellColor={layer.color}
        sectionSize={layer.size}
        sectionThickness={layer.lineWidth}
        sectionColor={layer.color}
        fadeDistance={1e6}
        side={THREE.DoubleSide}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  );
}
