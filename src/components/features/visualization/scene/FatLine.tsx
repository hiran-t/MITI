'use client';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from 'three-stdlib';

export type LinePoint = THREE.Vector3 | readonly [number, number, number];
export type LineColor =
  | readonly [number, number, number]
  | readonly [number, number, number, number];

/**
 * Segment endpoints, x y z each: consecutive points of a polyline, or with `segments` the points
 * taken in pairs.
 */
export function segmentPositions(points: readonly LinePoint[], segments = false): Float32Array {
  const pairs = segments ? Math.floor(points.length / 2) : Math.max(0, points.length - 1);
  const out = new Float32Array(pairs * 6);
  const write = (point: LinePoint, at: number) => {
    if (point instanceof THREE.Vector3) {
      out[at] = point.x;
      out[at + 1] = point.y;
      out[at + 2] = point.z;
    } else out.set(point, at);
  };
  for (let i = 0; i < pairs; i++) {
    const a = segments ? 2 * i : i;
    write(points[a], i * 6);
    write(points[a + 1], i * 6 + 3);
  }
  return out;
}

/** Per-endpoint colors laid out like `segmentPositions`, with `itemSize` channels each. */
export function segmentColors(
  colors: readonly LineColor[],
  itemSize: 3 | 4,
  segments = false
): Float32Array {
  const pairs = segments ? Math.floor(colors.length / 2) : Math.max(0, colors.length - 1);
  const out = new Float32Array(pairs * 2 * itemSize);
  for (let i = 0; i < pairs; i++) {
    const a = segments ? 2 * i : i;
    for (let end = 0; end < 2; end++)
      for (let c = 0; c < itemSize; c++)
        out[(2 * i + end) * itemSize + c] = colors[a + end][c] ?? 1;
  }
  return out;
}

/** Copy into the geometry's buffer when it has the same size; false when it must be rebuilt. */
function updateInPlace(geometry: LineSegmentsGeometry, name: string, values: Float32Array) {
  const attribute = geometry.getAttribute(name) as THREE.InterleavedBufferAttribute | undefined;
  if (!attribute || attribute.data.array.length !== values.length) return false;
  (attribute.data.array as Float32Array).set(values);
  attribute.data.needsUpdate = true;
  return true;
}

/**
 * A screen-space (or world-unit) wide line, like drei's `<Line>`, for data that changes often.
 * drei's `<Line>` disposes its material whenever its points change, so the line shader is compiled
 * again on the next frame; here the material lives as long as the component and the geometry is
 * updated in place while the number of segments stays the same.
 */
export default function FatLine({
  points,
  color = '#ffffff',
  vertexColors,
  lineWidth = 1,
  worldUnits = false,
  segments = false,
  transparent = false,
  opacity = 1,
}: {
  points: readonly LinePoint[];
  color?: THREE.ColorRepresentation;
  /** One color per point; colors with alpha make the line translucent. */
  vertexColors?: readonly LineColor[];
  lineWidth?: number;
  worldUnits?: boolean;
  /** Draw points pairwise as separate segments instead of one connected line. */
  segments?: boolean;
  transparent?: boolean;
  opacity?: number;
}) {
  const size = useThree((state) => state.size);
  const line = useMemo(() => new LineSegments2(new LineSegmentsGeometry(), new LineMaterial()), []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line]
  );

  const itemSize = vertexColors?.[0]?.length === 4 ? 4 : 3;
  useLayoutEffect(() => {
    const positions = segmentPositions(points, segments);
    const colors = vertexColors ? segmentColors(vertexColors, itemSize, segments) : null;
    let geometry = line.geometry;
    const hasColors = !!geometry.getAttribute('instanceColorStart');
    const reused =
      hasColors === !!colors &&
      updateInPlace(geometry, 'instanceStart', positions) &&
      (!colors || updateInPlace(geometry, 'instanceColorStart', colors));
    if (reused) {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return;
    }
    geometry.dispose();
    geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    if (colors) geometry.setColors(colors, itemSize);
    line.geometry = geometry;
  }, [line, points, vertexColors, itemSize, segments]);

  const material = line.material;
  const translucent = transparent || (!!vertexColors && itemSize === 4) || opacity < 1;
  // These select shader variants: recompile only when one of them actually changes.
  if (
    material.worldUnits !== worldUnits ||
    material.transparent !== translucent ||
    material.vertexColors !== !!vertexColors
  ) {
    material.worldUnits = worldUnits;
    material.transparent = translucent;
    material.vertexColors = !!vertexColors;
    material.needsUpdate = true;
  }
  material.color.set(vertexColors ? 0xffffff : color);
  material.linewidth = lineWidth;
  material.opacity = opacity;
  material.resolution.set(size.width, size.height);

  return <primitive object={line} />;
}
