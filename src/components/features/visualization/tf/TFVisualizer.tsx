'use client';
import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { Vector3 } from 'three';
import type { TFTree } from '@/types/tf-messages';
import { lookupTransform } from '@/lib/scene/transforms';
export default function TFVisualizer({
  tfTree,
  fixedFrame,
  showLabels = true,
  axisLength = 0.15,
}: {
  tfTree: TFTree;
  fixedFrame: string;
  showLabels?: boolean;
  axisLength?: number;
}) {
  const frames = useMemo(
    () =>
      Array.from(tfTree.frames.values()).flatMap((frame) => {
        try {
          const matrix = lookupTransform(tfTree, fixedFrame, frame.name);
          const parent = frame.parent
            ? new Vector3().setFromMatrixPosition(lookupTransform(tfTree, fixedFrame, frame.parent))
            : null;
          return [
            {
              name: frame.name,
              matrix,
              parent,
              position: new Vector3().setFromMatrixPosition(matrix),
            },
          ];
        } catch {
          return [];
        }
      }),
    [tfTree, fixedFrame]
  );
  return (
    <>
      {frames.map((frame) => (
        <group key={frame.name}>
          <group matrix={frame.matrix} matrixAutoUpdate={false}>
            <axesHelper args={[axisLength]} />
            {showLabels && (
              <Html
                position={[0, 0, axisLength]}
                style={{
                  pointerEvents: 'none',
                  fontSize: 10,
                  color: '#e8eaf0',
                  whiteSpace: 'nowrap',
                }}
              >
                {frame.name}
              </Html>
            )}
          </group>
          {frame.parent && (
            <Line points={[frame.position, frame.parent]} color="#a78bfa" lineWidth={1} />
          )}
        </group>
      ))}
    </>
  );
}
