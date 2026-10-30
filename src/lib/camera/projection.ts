/**
 * Camera geometry for the Image panel: intrinsics from sensor_msgs/CameraInfo, the flips and
 * rotations Foxglove's Image panel offers, and a three.js camera that projects like the real one.
 *
 * Pixel coordinates here put the image's top-left corner at (0, 0) and pixel centers at +0.5, so
 * flipping and rotating are exact. ROS (OpenCV) puts pixel centers on integers, so principal
 * points from CameraInfo are shifted by half a pixel on the way in.
 */
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import type { Header } from '@/types/scene';
import { parseDistortion, type Distortion } from './rectify';

/** sensor_msgs/CameraInfo, as decoded from the bridge (arrays may be typed arrays). */
export interface CameraInfo {
  header: Header;
  width: number;
  height: number;
  distortion_model?: string;
  d: number[];
  k: number[];
  r?: number[];
  p: number[];
  binning_x?: number;
  binning_y?: number;
  roi?: { x_offset: number; y_offset: number; width: number; height: number };
}

/** 3×3 matrix, row-major. */
export type Mat3 = number[];
export type ImageRotation = 0 | 90 | 180 | 270;

export interface Intrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

export const IDENTITY3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return out;
}
export const transpose3 = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const apply3 = (m: Mat3, [x, y, z]: number[]): [number, number, number] => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];
/** A 3×3 rotation as the upper-left block of a 4×4 transform. */
export const mat3To4 = (m: Mat3) =>
  new Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);

/** How the image is drawn and the 3D overlays are projected for one CameraInfo. */
export interface CameraModel {
  /** Intrinsics of the drawn image, at the image's own size. */
  intrinsics: Intrinsics;
  width: number;
  height: number;
  /** Rotation from the optical frame into the frame `intrinsics` project from (CameraInfo R). */
  rotation: Mat3;
  /** Intrinsics of the image as the camera sent it; rectifying samples it through these. */
  raw: Intrinsics;
  /** Lens distortion to undo; null when not rectifying or the lens has none. */
  distortion: Distortion | null;
}

const finite = (values: ArrayLike<number> | undefined, length: number) =>
  !!values && values.length >= length && Array.from(values).slice(0, length).every(Number.isFinite);

/**
 * Intrinsics for an image of `image` size: K, or P (and R) when rectifying, as in Foxglove.
 * Images scaled from the calibrated resolution (binning, resized streams) scale the intrinsics.
 */
export function cameraModel(
  info: CameraInfo,
  image: { width: number; height: number },
  rectify: boolean
): CameraModel {
  const { k, p } = info;
  if (!finite(k, 9) || !(k[0] > 0) || !(k[4] > 0))
    throw new Error('CameraInfo is uncalibrated (K is zero)');
  const sx = info.width > 0 ? image.width / info.width : 1;
  const sy = info.height > 0 ? image.height / info.height : 1;
  const edge = (fx: number, fy: number, cx: number, cy: number): Intrinsics => ({
    fx: fx * sx,
    fy: fy * sy,
    cx: (cx + 0.5) * sx,
    cy: (cy + 0.5) * sy,
  });
  const raw = edge(k[0], k[4], k[2], k[5]);
  const base = { width: image.width, height: image.height, raw };
  if (!rectify) return { ...base, intrinsics: raw, rotation: IDENTITY3, distortion: null };
  const hasP = finite(p, 12) && p[0] > 0 && p[5] > 0;
  const r = info.r;
  const hasR = finite(r, 9) && Array.from(r!).some((value) => value !== 0);
  return {
    ...base,
    intrinsics: hasP ? edge(p[0], p[5], p[2], p[6]) : raw,
    rotation: hasR ? Array.from(r!).slice(0, 9) : IDENTITY3,
    distortion: parseDistortion(info.distortion_model, info.d),
  };
}

/** Flips and rotation, as source pixels → displayed pixels and as the same change in 3D. */
export interface ImageTransform {
  /** Source pixel → displayed pixel (homogeneous, row-major). */
  pixel: Mat3;
  /** The same change applied to optical-frame points, so overlays move with the image. */
  optical: Mat3;
  /** Displayed size: width and height swap at 90° and 270°. */
  width: number;
  height: number;
}

/** Flip the source image first, then rotate it clockwise, as Foxglove's Image panel does. */
export function imageTransform(
  width: number,
  height: number,
  rotation: ImageRotation,
  flipHorizontal: boolean,
  flipVertical: boolean
): ImageTransform {
  let pixel = IDENTITY3;
  let optical = IDENTITY3;
  if (flipHorizontal) {
    pixel = mul3([-1, 0, width, 0, 1, 0, 0, 0, 1], pixel);
    optical = mul3([-1, 0, 0, 0, 1, 0, 0, 0, 1], optical);
  }
  if (flipVertical) {
    pixel = mul3([1, 0, 0, 0, -1, height, 0, 0, 1], pixel);
    optical = mul3([1, 0, 0, 0, -1, 0, 0, 0, 1], optical);
  }
  const [rotatePixel, rotateOptical]: [Mat3, Mat3] =
    rotation === 90
      ? [
          [0, -1, height, 1, 0, 0, 0, 0, 1],
          [0, -1, 0, 1, 0, 0, 0, 0, 1],
        ]
      : rotation === 180
        ? [
            [-1, 0, width, 0, -1, height, 0, 0, 1],
            [-1, 0, 0, 0, -1, 0, 0, 0, 1],
          ]
        : rotation === 270
          ? [
              [0, 1, 0, -1, 0, width, 0, 0, 1],
              [0, 1, 0, -1, 0, 0, 0, 0, 1],
            ]
          : [IDENTITY3, IDENTITY3];
  const turned = rotation === 90 || rotation === 270;
  return {
    pixel: mul3(rotatePixel, pixel),
    optical: mul3(rotateOptical, optical),
    width: turned ? height : width,
    height: turned ? width : height,
  };
}

/**
 * Intrinsics of the displayed image. With `pixel · K = K' · optical`, projecting the turned
 * points with K' lands exactly where the source projection lands after turning the image.
 */
export function displayIntrinsics(intrinsics: Intrinsics, transform: ImageTransform): Intrinsics {
  const { fx, fy, cx, cy } = intrinsics;
  const k = mul3(
    mul3(transform.pixel, [fx, 0, cx, 0, fy, cy, 0, 0, 1]),
    transpose3(transform.optical)
  );
  return { fx: k[0], fy: k[4], cx: k[2], cy: k[5] };
}

/**
 * Projection for a three.js camera (looking down -z, y up) that has the pinhole intrinsics of
 * an image `width` × `height`.
 */
export function intrinsicProjection(
  { fx, fy, cx, cy }: Intrinsics,
  width: number,
  height: number,
  near: number,
  far: number
): Matrix4 {
  return new Matrix4().set(
    (2 * fx) / width,
    0,
    1 - (2 * cx) / width,
    0,
    0,
    (2 * fy) / height,
    (2 * cy) / height - 1,
    0,
    0,
    0,
    -(far + near) / (far - near),
    (-2 * far * near) / (far - near),
    0,
    0,
    -1,
    0
  );
}

/**
 * A perspective camera whose projection comes from intrinsics instead of a field of view. It sits
 * at the origin of the optical frame (x right, y down, z forward), so scene content placed in
 * that frame projects onto the image.
 */
export class IntrinsicCamera extends PerspectiveCamera {
  intrinsicMatrix: Matrix4 | null = null;
  constructor() {
    super();
    // three.js cameras look down -z with y up: half a turn about x gives z forward, y down.
    this.rotation.set(Math.PI, 0, 0);
    this.updateMatrixWorld(true);
  }
  setIntrinsics(intrinsics: Intrinsics, width: number, height: number) {
    this.intrinsicMatrix = intrinsicProjection(intrinsics, width, height, this.near, this.far);
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    if (!this.intrinsicMatrix) return super.updateProjectionMatrix();
    this.projectionMatrix.copy(this.intrinsicMatrix);
    this.projectionMatrixInverse.copy(this.intrinsicMatrix).invert();
  }
}

/**
 * Where scene content in the fixed frame goes, in the camera's optical frame: TF to the camera,
 * then the rectification rotation, then the display flips and rotation.
 */
export function overlayMatrix(
  cameraFromFixed: Matrix4,
  model: CameraModel,
  transform: ImageTransform
) {
  return mat3To4(transform.optical).multiply(mat3To4(model.rotation)).multiply(cameraFromFixed);
}

/** Displayed pixel (top-left origin) a fixed-frame point lands on, through `camera`. */
export function projectToPixel(
  camera: IntrinsicCamera,
  overlay: Matrix4,
  point: [number, number, number],
  width: number,
  height: number
): [number, number] | null {
  const local = new Vector3(...point).applyMatrix4(overlay);
  if (local.z <= 0) return null;
  const ndc = local.project(camera);
  return [((ndc.x + 1) / 2) * width, ((1 - ndc.y) / 2) * height];
}
