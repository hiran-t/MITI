'use client';
import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { Vector3 } from 'three';
import type { TFTree } from '@/types/tf-messages';
import type { TransformSettings } from '@/types/scene-config';
import { lookupTransform } from '@/lib/scene/transforms';

const AXIS_LENGTH = 0.15;

export default function TFVisualizer({
  tfTree,
  fixedFrame,
  settings,
  labelScale = 1,
}: {
  tfTree: TFTree;
  fixedFrame: string;
  settings: TransformSettings;
  labelScale?: number;
}) {
  const frames = useMemo(() => {
    const names = new Set<string>();
    tfTree.frames.forEach((frame) => {
      names.add(frame.name);
      if (frame.parent) names.add(frame.parent);
    });
    return Array.from(names).flatMap((name) => {
      if (settings.frames[name]?.visible === false) return [];
      try {
        const matrix = lookupTransform(tfTree, fixedFrame, name);
        const parentName = tfTree.frames.get(name)?.parent;
        let parent: Vector3 | null = null;
        try {
          parent = parentName
            ? new Vector3().setFromMatrixPosition(lookupTransform(tfTree, fixedFrame, parentName))
            : null;
        } catch {
          parent = null;
        }
        return [{ name, matrix, parent, position: new Vector3().setFromMatrixPosition(matrix) }];
      } catch {
        return [];
      }
    });
  }, [tfTree, fixedFrame, settings.frames]);
  const axisLength = AXIS_LENGTH * settings.axisScale;
  return (
    <>
      {frames.map((frame) => (
        <group key={frame.name}>
          <group matrix={frame.matrix} matrixAutoUpdate={false}>
            <axesHelper args={[axisLength]} />
            {settings.showLabels && (
              <Html
                position={[0, 0, axisLength]}
                style={{
                  pointerEvents: 'none',
                  fontSize: settings.labelSize * labelScale,
                  color: '#e8eaf0',
                  whiteSpace: 'nowrap',
                }}
              >
                {frame.name}
              </Html>
            )}
          </group>
          {frame.parent && (
            <Line
              points={[frame.position, frame.parent]}
              color={settings.lineColor}
              lineWidth={settings.lineWidth}
            />
          )}
        </group>
      ))}
    </>
  );
}
