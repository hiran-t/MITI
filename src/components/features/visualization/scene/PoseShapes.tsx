'use client';
import { MITI_CYAN } from '@/lib/theme';
import { useLayoutEffect, useMemo, useRef } from 'react';
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

export const AXIS_COLORS = ['#ef4444', '#22c55e', '#3b82f6'];
/** Axis radius as a fraction of its length. */
const AXIS_RADIUS = 0.04;
/** A unit cylinder along +Y from the origin, shared by every set of axes. */
const AXIS_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
/** Rotations that turn the +Y cylinder onto +X, +Y and +Z. */
const AXIS_ROTATIONS = [
  new THREE.Matrix4().makeRotationZ(-Math.PI / 2),
  new THREE.Matrix4(),
  new THREE.Matrix4().makeRotationX(Math.PI / 2),
];
const axisColors = AXIS_COLORS.map((hex) => new THREE.Color(hex));
const axisLocal = new THREE.Matrix4();
const axisWorld = new THREE.Matrix4();

/** Instances held for `count`, rounded up so a changing count rarely rebuilds the mesh. */
export const axesCapacity = (count: number) => 2 ** Math.ceil(Math.log2(Math.max(count, 1) * 3));

/**
 * Writes red, green and blue axes of length `scale` at each pose into `mesh`, three instances per
 * pose in X, Y, Z order. `thickness` multiplies their default radius.
 */
export function writeAxes(
  mesh: THREE.InstancedMesh,
  matrices: THREE.Matrix4[],
  scale: number,
  thickness = 1
) {
  const radius = scale * AXIS_RADIUS * thickness;
  matrices.forEach((matrix, i) => {
    AXIS_ROTATIONS.forEach((rotation, axis) => {
      axisLocal.makeScale(radius, scale, radius).premultiply(rotation);
      mesh.setMatrixAt(i * 3 + axis, axisWorld.multiplyMatrices(matrix, axisLocal));
      mesh.setColorAt(i * 3 + axis, axisColors[axis]);
    });
  });
  mesh.count = matrices.length * 3;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/**
 * Red, green and blue axes of length `scale` at each pose, like Foxglove's axis pose display. All
 * poses share one instanced mesh, so a robot's dozens of TF frames cost a single draw call.
 */
export function AxesInstances({
  matrices,
  scale,
  opacity = 1,
  thickness = 1,
}: {
  matrices: THREE.Matrix4[];
  scale: number;
  opacity?: number;
  thickness?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const capacity = axesCapacity(matrices.length);
  // Before the next frame, so a new mesh never draws its identity instances.
  useLayoutEffect(() => {
    if (ref.current) writeAxes(ref.current, matrices, scale, thickness);
  }, [matrices, scale, thickness, capacity]);
  return (
    <instancedMesh key={capacity} ref={ref} args={[AXIS_GEOMETRY, undefined, capacity]}>
      {/* A new material when it turns translucent: three.js compiles an opaque material's shader
          with alpha fixed at 1, and does not recompile it when `transparent` changes. */}
      <meshBasicMaterial
        key={opacity < 1 ? 'translucent' : 'opaque'}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
        toneMapped={false}
      />
    </instancedMesh>
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
  if (style.type === 'axis')
    return <AxesInstances matrices={matrices} scale={style.axisScale} opacity={style.opacity} />;
  return (
    <>
      {matrices.map((matrix, i) => (
        <group key={i} matrix={matrix} matrixAutoUpdate={false}>
          <PoseArrowShape style={style} />
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
