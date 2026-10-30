'use client';
import { MITI_CYAN } from '@/lib/theme';
import { useMemo } from 'react';
import * as THREE from 'three';
import { parseHex } from '@/lib/scene/colors';
import FatLine from './FatLine';
import type { PoseDisplayType } from '@/types/scene';

export interface PoseStyle {
  type: PoseDisplayType;
  axisScale: number;
  color: string;
  opacity: number;
  shaftLength: number;
  shaftWidth: number;
  headLength: number;
  headWidth: number;
  lineWidth: number;
  gradient: [string, string];
}

/** RViz's arrow defaults, which Foxglove also uses. */
export const DEFAULT_ARROW = { shaftLength: 1, shaftWidth: 0.05, headLength: 0.3, headWidth: 0.1 };
export const DEFAULT_PATH_GRADIENT: [string, string] = ['#38bdf8', MITI_CYAN];
export const DEFAULT_COVARIANCE_COLOR = `${MITI_CYAN}66`;

const AXIS_COLORS = ['#ef4444', '#22c55e', '#3b82f6'];
/** Rotations that turn a +Y cylinder onto +X, +Y and +Z. */
const AXIS_ROTATIONS: [number, number, number][] = [
  [0, 0, -Math.PI / 2],
  [0, 0, 0],
  [Math.PI / 2, 0, 0],
];

/** Red, green and blue axes of length `scale`, like Foxglove's axis pose display. */
export function PoseAxes({ scale, opacity = 1 }: { scale: number; opacity?: number }) {
  const radius = scale * 0.04;
  return (
    <>
      {AXIS_ROTATIONS.map((rotation, i) => (
        <mesh
          key={i}
          rotation={rotation}
          position={[i === 0 ? scale / 2 : 0, i === 1 ? scale / 2 : 0, i === 2 ? scale / 2 : 0]}
        >
          <cylinderGeometry args={[radius, radius, scale, 10]} />
          <meshBasicMaterial
            color={AXIS_COLORS[i]}
            transparent={opacity < 1}
            opacity={opacity}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/** An arrow along +X with RViz's shaft and head dimensions. */
export function PoseArrowShape({ style }: { style: PoseStyle }) {
  const [, , , alpha] = parseHex(style.color);
  const opacity = alpha * style.opacity;
  const material = (
    <meshBasicMaterial
      color={style.color.slice(0, 7)}
      transparent={opacity < 1}
      opacity={opacity}
      toneMapped={false}
    />
  );
  return (
    <>
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[style.shaftLength / 2, 0, 0]}>
        <cylinderGeometry
          args={[style.shaftWidth / 2, style.shaftWidth / 2, style.shaftLength, 12]}
        />
        {material}
      </mesh>
      <mesh
        rotation={[0, 0, -Math.PI / 2]}
        position={[style.shaftLength + style.headLength / 2, 0, 0]}
      >
        <coneGeometry args={[style.headWidth / 2, style.headLength, 16]} />
        {material}
      </mesh>
    </>
  );
}

/**
 * Poses given as matrices in the parent's frame, drawn as axes, arrows, or a line through their
 * positions colored along a gradient.
 */
export function PoseList({ matrices, style }: { matrices: THREE.Matrix4[]; style: PoseStyle }) {
  const line = useMemo(() => {
    if (style.type !== 'line' || matrices.length < 2) return null;
    const points = matrices.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
    const start = parseHex(style.gradient[0]),
      end = parseHex(style.gradient[1]);
    const colors = points.map((_, i) => {
      const t = i / (points.length - 1);
      const [r, g, b, a] = start.map((v, k) => v + (end[k] - v) * t);
      // drei's line material expects linear colors; the settings hold sRGB.
      const c = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
      return [c.r, c.g, c.b, a * style.opacity] as [number, number, number, number];
    });
    return { points, colors };
  }, [matrices, style.type, style.gradient, style.opacity]);
  if (style.type === 'line')
    return line ? (
      <FatLine
        points={line.points}
        vertexColors={line.colors}
        lineWidth={style.lineWidth}
        worldUnits
        transparent
      />
    ) : null;
  return (
    <>
      {matrices.map((matrix, i) => (
        <group key={i} matrix={matrix} matrixAutoUpdate={false}>
          {style.type === 'axis' ? (
            <PoseAxes scale={style.axisScale} opacity={style.opacity} />
          ) : (
            <PoseArrowShape style={style} />
          )}
        </group>
      ))}
    </>
  );
}

/**
 * The 1-sigma position covariance ellipsoid of a pose, centered on its position. The covariance
 * is expressed in the message frame, so the pose's orientation does not rotate it.
 */
export function CovarianceEllipsoid({
  position,
  covariance,
  color,
}: {
  position: THREE.Vector3;
  /** Row-major 6×6 covariance of x, y, z, roll, pitch, yaw. */
  covariance: ArrayLike<number>;
  color: string;
}) {
  const shape = useMemo(() => covarianceShape(covariance), [covariance]);
  if (!shape) return null;
  const [, , , alpha] = parseHex(color);
  return (
    <mesh position={position} rotation={[0, 0, shape.yaw]} scale={shape.radii}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial
        color={color.slice(0, 7)}
        transparent
        opacity={alpha}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Radii (standard deviations) and heading of the x–y covariance ellipse, with z's deviation. */
export function covarianceShape(
  covariance: ArrayLike<number>
): { radii: [number, number, number]; yaw: number } | null {
  if (!covariance || covariance.length < 36) return null;
  const xx = covariance[0],
    xy = covariance[1],
    yy = covariance[7],
    zz = covariance[14];
  if (![xx, xy, yy, zz].every(Number.isFinite)) return null;
  // Eigenvalues of the symmetric 2×2 block.
  const mean = (xx + yy) / 2;
  const spread = Math.hypot((xx - yy) / 2, xy);
  const yaw = 0.5 * Math.atan2(2 * xy, xx - yy);
  const sigma = (v: number) => Math.sqrt(Math.max(v, 0)) || 1e-3;
  return { radii: [sigma(mean + spread), sigma(mean - spread), sigma(zz)], yaw };
}
