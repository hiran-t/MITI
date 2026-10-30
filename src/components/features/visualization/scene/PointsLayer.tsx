'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointData } from '@/lib/parsers/pointcloud-parser';
import { pointColors, type PointColorSettings } from '@/lib/scene/colors';

export interface PointStyle extends PointColorSettings {
  pointSize: number;
  pointShape: 'circle' | 'square';
  opacity: number;
  stixels: boolean;
}

// Sizes are in screen pixels, as in Foxglove; colors are written as given (sRGB), untouched by
// lighting or tone mapping.
const POINT_VERTEX = /* glsl */ `
uniform float size;
uniform float pixelRatio;
attribute vec4 rgba;
varying vec4 vColor;
void main() {
  vColor = rgba;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * pixelRatio;
}`;
const POINT_FRAGMENT = /* glsl */ `
uniform bool circle;
varying vec4 vColor;
void main() {
  if (vColor.a <= 0.0 || (circle && length(gl_PointCoord - 0.5) > 0.5)) discard;
  gl_FragColor = vColor;
}`;
const LINE_VERTEX = /* glsl */ `
attribute vec4 rgba;
varying vec4 vColor;
void main() {
  vColor = rgba;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const LINE_FRAGMENT = /* glsl */ `
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}`;

/** Messages kept for decay, whatever the decay time. */
const MAX_TRAIL = 300;

function Points({ points, style }: { points: PointData; style: PointStyle }) {
  const dpr = useThree((state) => state.viewport.dpr);
  const { colorMode, color, colorField, colorMap, valueMin, valueMax, opacity } = style;
  const [gradientStart, gradientEnd] = style.gradient;
  const colors = useMemo(
    () =>
      pointColors(
        points,
        {
          colorMode,
          color,
          colorField,
          colorMap,
          gradient: [gradientStart, gradientEnd],
          valueMin,
          valueMax,
        },
        opacity
      ).colors,
    [
      points,
      colorMode,
      color,
      colorField,
      colorMap,
      gradientStart,
      gradientEnd,
      valueMin,
      valueMax,
      opacity,
    ]
  );
  const translucent = useMemo(() => {
    for (let i = 3; i < colors.length; i += 4) if (colors[i] < 1) return true;
    return false;
  }, [colors]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(points.positions, 3));
    g.setAttribute('rgba', new THREE.BufferAttribute(colors, 4));
    return g;
  }, [points, colors]);
  const stixels = useMemo(() => {
    if (!style.stixels) return null;
    const { count, positions } = points;
    const lines = new Float32Array(count * 6);
    const lineColors = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      lines.set(positions.subarray(i * 3, i * 3 + 3), i * 6);
      lines.set([positions[i * 3], positions[i * 3 + 1], 0], i * 6 + 3);
      const c = colors.subarray(i * 4, i * 4 + 4);
      lineColors.set(c, i * 8);
      lineColors.set(c, i * 8 + 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(lines, 3));
    g.setAttribute('rgba', new THREE.BufferAttribute(lineColors, 4));
    return g;
  }, [points, colors, style.stixels]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => stixels?.dispose(), [stixels]);

  const pointMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        uniforms: { size: { value: 2 }, pixelRatio: { value: 1 }, circle: { value: true } },
      }),
    []
  );
  const lineMaterial = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: LINE_VERTEX, fragmentShader: LINE_FRAGMENT }),
    []
  );
  useEffect(
    () => () => {
      pointMaterial.dispose();
      lineMaterial.dispose();
    },
    [pointMaterial, lineMaterial]
  );
  pointMaterial.uniforms.size.value = style.pointSize;
  pointMaterial.uniforms.pixelRatio.value = dpr;
  pointMaterial.uniforms.circle.value = style.pointShape === 'circle';
  for (const material of [pointMaterial, lineMaterial]) {
    material.transparent = translucent;
    material.depthWrite = !translucent;
  }

  return (
    <>
      <points geometry={geometry} material={pointMaterial} frustumCulled={false} />
      {stixels && <lineSegments geometry={stixels} material={lineMaterial} frustumCulled={false} />}
    </>
  );
}

interface TrailEntry {
  id: number;
  points: PointData;
  matrix: THREE.Matrix4;
  at: number;
}

/**
 * Draws the latest message at its current transform and, with a decay time, earlier messages
 * where they were when superseded (Foxglove's decay), so a moving sensor leaves a trail.
 */
export default function PointsLayer({
  points,
  matrix,
  decayTime,
  style,
}: {
  points: PointData;
  /** Message frame to fixed frame. */
  matrix: THREE.Matrix4;
  /** Seconds. */
  decayTime: number;
  style: PointStyle;
}) {
  const current = useRef<TrailEntry | null>(null);
  const nextId = useRef(0);
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const decayMs = Math.max(0, decayTime) * 1000;

  useEffect(() => {
    const previous = current.current;
    const same = previous?.points === points;
    current.current = {
      id: same ? previous.id : nextId.current++,
      points,
      matrix,
      at: same ? previous.at : Date.now(),
    };
    if (previous && !same && decayMs > 0) {
      const since = Date.now() - decayMs;
      setTrail((entries) =>
        [...entries, previous].filter((entry) => entry.at > since).slice(-MAX_TRAIL)
      );
    }
  }, [points, matrix, decayMs]);

  // Drop each message once it is older than the decay time.
  useEffect(() => {
    if (!decayMs) {
      if (trail.length) setTrail([]);
      return;
    }
    if (!trail.length) return;
    const wait = trail[0].at + decayMs - Date.now();
    const timer = setTimeout(
      () => setTrail((entries) => entries.filter((entry) => entry.at > Date.now() - decayMs)),
      Math.max(0, wait) + 5
    );
    return () => clearTimeout(timer);
  }, [trail, decayMs]);

  return (
    <>
      {trail.map((entry) => (
        <group key={entry.id} matrix={entry.matrix} matrixAutoUpdate={false}>
          <Points points={entry.points} style={style} />
        </group>
      ))}
      <group matrix={matrix} matrixAutoUpdate={false}>
        <Points points={points} style={style} />
      </group>
    </>
  );
}
