import { colorAt, colorLut, decodeScalarImage, valueRange } from '../image-colors';
import type { sensor_msgs } from '@/types/ros-messages';

const image = (encoding: string, data: number[], width: number, step: number, bigEndian = false) =>
  ({
    header: { frame_id: 'cam', stamp: { sec: 0, nanosec: 0 } },
    height: data.length / step,
    width,
    encoding,
    is_bigendian: bigEndian ? 1 : 0,
    step,
    data: new Uint8Array(data),
  }) as unknown as sensor_msgs.Image;

test('16UC1 depth: zero is no reading and stays out of the auto range; padding is skipped', () => {
  // 2×2, little-endian, rows padded to 6 bytes.
  const decoded = decodeScalarImage(
    image('16UC1', [0, 0, 0xe8, 0x03, 9, 9, 0xd0, 0x07, 0xb8, 0x0b, 9, 9], 2, 6)
  );
  expect(Array.from(decoded.values)).toEqual([0, 1000, 2000, 3000]);
  expect([decoded.min, decoded.max]).toEqual([1000, 3000]);
  expect(decoded.zeroInvalid).toBe(true);
});

test('mono16 big-endian and mono8 values', () => {
  expect(Array.from(decodeScalarImage(image('mono16', [1, 0, 0, 2], 2, 4, true)).values)).toEqual([
    256, 2,
  ]);
  const mono = decodeScalarImage(image('mono8', [0, 128, 255, 7], 4, 4));
  expect([mono.min, mono.max, mono.zeroInvalid]).toEqual([0, 255, false]);
});

test('32FC1 NaN is invalid', () => {
  const bytes = new Uint8Array(new Float32Array([NaN, 1.5]).buffer);
  const decoded = decodeScalarImage(image('32FC1', Array.from(bytes), 2, 8));
  expect([decoded.min, decoded.max]).toEqual([1.5, 1.5]);
});

test('value range: fixed bounds win, auto takes the image range', () => {
  expect(valueRange({ min: 2, max: 8 }, {})).toEqual([2, 8]);
  expect(valueRange({ min: 2, max: 8 }, { valueMin: 0 })).toEqual([0, 8]);
  expect(valueRange({ min: 2, max: 8 }, { valueMin: 0, valueMax: 10 })).toEqual([0, 10]);
  expect(valueRange({ min: 5, max: 5 }, {})).toEqual([5, 6]);
});

test('gradient maps min to the first color and max to the second', () => {
  const lut = colorLut({
    colorMode: 'gradient',
    colorMap: 'turbo',
    gradient: ['#000000', '#ffffff'],
  });
  expect(colorAt(0, [0, 10], lut, false)).toEqual([0, 0, 0, 255]);
  expect(colorAt(10, [0, 10], lut, false)).toEqual([255, 255, 255, 255]);
  expect(colorAt(5, [0, 10], lut, false)![0]).toBeCloseTo(128, -1);
  // Out of range clamps; zero is a reading in mono images but not in depth images.
  expect(colorAt(-4, [0, 10], lut, false)).toEqual([0, 0, 0, 255]);
  expect(colorAt(0, [0, 10], lut, true)).toBeNull();
  expect(colorAt(NaN, [0, 10], lut, false)).toBeNull();
});

test('color maps: turbo runs blue → red, rainbow (RViz) red → magenta', () => {
  const turbo = colorLut({ colorMode: 'colormap', colorMap: 'turbo', gradient: ['#000', '#fff'] });
  const [r0, , b0] = colorAt(0.15, [0, 1], turbo, false)!;
  const [r1, , b1] = colorAt(0.9, [0, 1], turbo, false)!;
  expect(b0).toBeGreaterThan(r0);
  expect(r1).toBeGreaterThan(b1);
  const rainbow = colorLut({
    colorMode: 'colormap',
    colorMap: 'rainbow',
    gradient: ['#000', '#fff'],
  });
  expect(colorAt(0, [0, 1], rainbow, false)).toEqual([255, 0, 0, 255]);
  expect(colorAt(1, [0, 1], rainbow, false)).toEqual([255, 0, 255, 255]);
});
