import { lookupTransform } from '@/lib/scene/transforms';
import type { TFFrame, TFTree } from '@/types/tf-messages';
import {
  apply3,
  cameraModel,
  displayIntrinsics,
  imageTransform,
  IntrinsicCamera,
  overlayMatrix,
  projectToPixel,
  type CameraInfo,
  type ImageRotation,
} from '../projection';

// 640×480, f = 500 px, principal point at the center pixel (OpenCV convention).
const info: CameraInfo = {
  header: { frame_id: 'camera_optical' },
  width: 640,
  height: 480,
  distortion_model: 'plumb_bob',
  d: [0, 0, 0, 0, 0],
  k: [500, 0, 319.5, 0, 500, 239.5, 0, 0, 1],
  r: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  p: [400, 0, 300, 0, 0, 400, 200, 0, 0, 0, 1, 0],
};

const frame = (
  name: string,
  parent: string,
  translation: number[],
  rotation: number[]
): TFFrame => ({
  name,
  parent,
  transform: {
    translation: { x: translation[0], y: translation[1], z: translation[2] },
    rotation: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] },
  },
  timestamp: 0,
  children: [],
  isStatic: true,
});
// base_link (x forward, y left, z up) → camera 1 m up, optical frame (z forward, x right, y down).
const tree: TFTree = {
  frames: new Map(
    [
      frame('base_link', 'map', [5, 0, 0], [0, 0, 0, 1]),
      frame('camera_optical', 'base_link', [0, 0, 1], [-0.5, 0.5, -0.5, 0.5]),
    ].map((f) => [f.name, f])
  ),
  rootFrame: 'map',
};

/** Pixel in ROS (OpenCV) coordinates: centers on integers. */
function rosPixel(
  point: [number, number, number],
  options: Partial<{
    rotation: ImageRotation;
    flipH: boolean;
    flipV: boolean;
    rectify: boolean;
  }> = {}
) {
  const model = cameraModel(info, info, !!options.rectify);
  const transform = imageTransform(
    640,
    480,
    options.rotation ?? 0,
    !!options.flipH,
    !!options.flipV
  );
  const camera = new IntrinsicCamera();
  camera.setIntrinsics(
    displayIntrinsics(model.intrinsics, transform),
    transform.width,
    transform.height
  );
  camera.updateMatrixWorld(true);
  const overlay = overlayMatrix(lookupTransform(tree, 'camera_optical', 'map'), model, transform);
  const pixel = projectToPixel(camera, overlay, point, transform.width, transform.height);
  return pixel && pixel.map((value) => value - 0.5);
}

const near = (actual: number[] | null, expected: number[]) => {
  expect(actual).not.toBeNull();
  actual!.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6));
};

test('a point straight ahead of the camera lands on the principal point', () => {
  near(rosPixel([7, 0, 1]), [319.5, 239.5]);
});

test('points project with K through TF: right of the camera is +u, below is +v', () => {
  // 2 m ahead, 0.5 m to the right (−y) and 0.5 m down: 500 · 0.5 / 2 = 125 px.
  near(rosPixel([7, -0.5, 1]), [444.5, 239.5]);
  near(rosPixel([7, 0, 0.5]), [319.5, 364.5]);
});

test('points behind the camera are not projected', () => {
  expect(rosPixel([3, 0, 1])).toBeNull();
});

test('rectified mode projects with P', () => {
  near(rosPixel([7, -0.5, 1], { rectify: true }), [300 + 100, 200]);
});

test('flips and rotations move overlays exactly like the image pixels', () => {
  const point: [number, number, number] = [7, -0.4, 0.7];
  const [u, v] = rosPixel(point)!.map((value) => value + 0.5); // edge coordinates
  const cases: [Partial<{ rotation: ImageRotation; flipH: boolean; flipV: boolean }>, number[]][] =
    [
      [{ flipH: true }, [640 - u, v]],
      [{ flipV: true }, [u, 480 - v]],
      [{ rotation: 90 }, [480 - v, u]],
      [{ rotation: 180 }, [640 - u, 480 - v]],
      [{ rotation: 270 }, [v, 640 - u]],
      [{ rotation: 90, flipH: true }, [480 - v, 640 - u]],
    ];
  for (const [options, expected] of cases) {
    const transform = imageTransform(
      640,
      480,
      options.rotation ?? 0,
      !!options.flipH,
      !!options.flipV
    );
    near(apply3(transform.pixel, [u, v, 1]).slice(0, 2), expected);
    near(
      rosPixel(point, options)!.map((value) => value + 0.5),
      expected
    );
  }
});

test('intrinsics scale with images sent at another resolution', () => {
  const model = cameraModel(info, { width: 320, height: 240 }, false);
  expect(model.intrinsics).toEqual({ fx: 250, fy: 250, cx: 160, cy: 120 });
});

test('uncalibrated CameraInfo is reported', () => {
  expect(() => cameraModel({ ...info, k: new Array(9).fill(0) }, info, false)).toThrow(
    /uncalibrated/
  );
});
