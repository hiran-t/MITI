/**
 * Lens undistortion for the Image panel's Rectify setting: the plumb_bob and rational_polynomial
 * models of ROS image_geometry (OpenCV). The CPU functions mirror RECTIFY_GLSL, which runs per
 * pixel on the GPU; tests check the math through the CPU versions.
 */
import type { Intrinsics, Mat3 } from './projection';

export type DistortionModel = 'plumb_bob' | 'rational_polynomial';

export interface Distortion {
  model: DistortionModel;
  /** k1, k2, p1, p2, k3, k4, k5, k6 (missing ones are 0). */
  coefficients: number[];
}

/** The lens distortion to undo, or null when there is none. Unsupported models throw. */
export function parseDistortion(
  model: string | undefined,
  d: ArrayLike<number> | undefined
): Distortion | null {
  const values = Array.from(d ?? []).map((value) => (Number.isFinite(value) ? value : 0));
  if (!values.some((value) => value !== 0)) return null;
  const name = (model ?? '').trim().toLowerCase();
  if (name && name !== 'plumb_bob' && name !== 'rational_polynomial')
    throw new Error(`Rectify does not support the ${model} distortion model`);
  const rational = name === 'rational_polynomial' || (!name && values.length > 5);
  // plumb_bob has five coefficients; drivers that pad D with zeros stay plumb_bob.
  const coefficients = Array.from({ length: 8 }, (_, i) =>
    rational || i < 5 ? (values[i] ?? 0) : 0
  );
  return { model: rational ? 'rational_polynomial' : 'plumb_bob', coefficients };
}

/** Distort normalized image coordinates (x/z, y/z), as OpenCV's projectPoints does. */
export function distort(x: number, y: number, { coefficients }: Distortion): [number, number] {
  const [k1, k2, p1, p2, k3, k4, k5, k6] = coefficients;
  const r2 = x * x + y * y;
  const r4 = r2 * r2;
  const r6 = r4 * r2;
  const radial = (1 + k1 * r2 + k2 * r4 + k3 * r6) / (1 + k4 * r2 + k5 * r4 + k6 * r6);
  return [
    x * radial + 2 * p1 * x * y + p2 * (r2 + 2 * x * x),
    y * radial + p1 * (r2 + 2 * y * y) + 2 * p2 * x * y,
  ];
}

/** Invert `distort` by fixed-point iteration, as OpenCV's undistortPoints does. */
export function undistort(
  xd: number,
  yd: number,
  distortion: Distortion,
  iterations = 20
): [number, number] {
  let x = xd;
  let y = yd;
  for (let i = 0; i < iterations; i++) {
    const [dx, dy] = distort(x, y, distortion);
    x += xd - dx;
    y += yd - dy;
  }
  return [x, y];
}

/**
 * The source pixel a rectified pixel samples: back-project with the rectified intrinsics, rotate
 * back out of the rectified frame (Rᵀ), distort, and project with the raw intrinsics. Returns null
 * for rays behind the camera.
 */
export function rectifiedToRaw(
  [u, v]: [number, number],
  rectified: Intrinsics,
  rotation: Mat3,
  raw: Intrinsics,
  distortion: Distortion | null
): [number, number] | null {
  const x = (u - rectified.cx) / rectified.fx;
  const y = (v - rectified.cy) / rectified.fy;
  // Rᵀ · (x, y, 1)
  const rx = rotation[0] * x + rotation[3] * y + rotation[6];
  const ry = rotation[1] * x + rotation[4] * y + rotation[7];
  const rz = rotation[2] * x + rotation[5] * y + rotation[8];
  if (rz <= 0) return null;
  const [xd, yd] = distortion ? distort(rx / rz, ry / rz, distortion) : [rx / rz, ry / rz];
  return [raw.fx * xd + raw.cx, raw.fy * yd + raw.cy];
}

/** GLSL twin of `rectifiedToRaw`; uniforms are set by the Image panel's background shader. */
export const RECTIFY_GLSL = /* glsl */ `
uniform vec4 rectifiedIntrinsics; // fx, fy, cx, cy
uniform mat3 unrectify;           // Rᵀ
uniform vec4 rawIntrinsics;
uniform float k[8];               // k1, k2, p1, p2, k3, k4, k5, k6
bool rectifiedToRaw(inout vec2 p) {
  vec3 ray = unrectify * vec3(
    (p.x - rectifiedIntrinsics.z) / rectifiedIntrinsics.x,
    (p.y - rectifiedIntrinsics.w) / rectifiedIntrinsics.y,
    1.0
  );
  if (ray.z <= 0.0) return false;
  vec2 xy = ray.xy / ray.z;
  float r2 = dot(xy, xy);
  float r4 = r2 * r2;
  float r6 = r4 * r2;
  float radial = (1.0 + k[0] * r2 + k[1] * r4 + k[4] * r6) / (1.0 + k[5] * r2 + k[6] * r4 + k[7] * r6);
  vec2 d = vec2(
    xy.x * radial + 2.0 * k[2] * xy.x * xy.y + k[3] * (r2 + 2.0 * xy.x * xy.x),
    xy.y * radial + k[2] * (r2 + 2.0 * xy.y * xy.y) + 2.0 * k[3] * xy.x * xy.y
  );
  p = rawIntrinsics.xy * d + rawIntrinsics.zw;
  return true;
}
`;
