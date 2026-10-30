import { distort, parseDistortion, rectifiedToRaw, undistort } from '../rectify';
import { IDENTITY3 } from '../projection';

const plumb = parseDistortion('plumb_bob', [-0.3, 0.1, 0.001, -0.002, 0.01])!;
const rational = parseDistortion(
  'rational_polynomial',
  [0.2, -0.1, 0.001, 0.002, 0.01, 0.3, -0.05, 0.02]
)!;

test('no distortion and unknown models', () => {
  expect(parseDistortion('plumb_bob', [0, 0, 0, 0, 0])).toBeNull();
  expect(parseDistortion('', [])).toBeNull();
  expect(() => parseDistortion('equidistant', [0.1, 0, 0, 0])).toThrow(/equidistant/);
  // plumb_bob uses five coefficients even when D is padded.
  expect(parseDistortion('plumb_bob', [0.1, 0, 0, 0, 0, 9, 9, 9])!.coefficients).toEqual([
    0.1, 0, 0, 0, 0, 0, 0, 0,
  ]);
});

test('radial distortion matches the plumb_bob formula', () => {
  const k1 = parseDistortion('plumb_bob', [-0.2, 0, 0, 0, 0])!;
  const [x, y] = distort(0.3, 0.4, k1); // r² = 0.25
  expect(x).toBeCloseTo(0.3 * (1 - 0.2 * 0.25), 12);
  expect(y).toBeCloseTo(0.4 * (1 - 0.2 * 0.25), 12);
});

test('tangential and rational terms follow OpenCV', () => {
  const [x, y] = distort(0.1, -0.2, rational);
  const r2 = 0.05;
  const radial =
    (1 + 0.2 * r2 - 0.1 * r2 ** 2 + 0.01 * r2 ** 3) /
    (1 + 0.3 * r2 - 0.05 * r2 ** 2 + 0.02 * r2 ** 3);
  expect(x).toBeCloseTo(0.1 * radial + 2 * 0.001 * 0.1 * -0.2 + 0.002 * (r2 + 2 * 0.01), 12);
  expect(y).toBeCloseTo(-0.2 * radial + 0.001 * (r2 + 2 * 0.04) + 2 * 0.002 * 0.1 * -0.2, 12);
});

test('undistort inverts distort', () => {
  for (const d of [plumb, rational])
    for (const [x, y] of [
      [0.1, 0.05],
      [-0.3, 0.2],
      [0.25, -0.25],
    ]) {
      const [xd, yd] = distort(x, y, d);
      const [ux, uy] = undistort(xd, yd, d);
      expect(ux).toBeCloseTo(x, 8);
      expect(uy).toBeCloseTo(y, 8);
    }
});

test('a rectified pixel samples the raw pixel where the same ray lands', () => {
  const raw = { fx: 500, fy: 500, cx: 320, cy: 240 };
  const rectified = { fx: 400, fy: 400, cx: 300, cy: 200 };
  // Principal point to principal point.
  expect(rectifiedToRaw([300, 200], rectified, IDENTITY3, raw, plumb)).toEqual([
    320 + 500 * 0, // no tangential shift at the center
    240,
  ]);
  const [u, v] = rectifiedToRaw([380, 160], rectified, IDENTITY3, raw, plumb)!;
  const [xd, yd] = distort(0.2, -0.1, plumb);
  expect(u).toBeCloseTo(500 * xd + 320, 9);
  expect(v).toBeCloseTo(500 * yd + 240, 9);
  // R rotates rays out of the rectified frame: 90° about z maps (x, y) → (−y, x) and Rᵀ undoes it.
  const r = [0, -1, 0, 1, 0, 0, 0, 0, 1];
  const [ru, rv] = rectifiedToRaw([380, 200], rectified, r, raw, null)!;
  expect(ru).toBeCloseTo(320, 9);
  expect(rv).toBeCloseTo(240 - 500 * 0.2, 9);
});
