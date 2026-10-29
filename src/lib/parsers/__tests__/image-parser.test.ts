import { decodeImagePixels } from '../image-parser';
import type { sensor_msgs } from '@/types/ros-messages';

const image = (fields: Partial<sensor_msgs.Image>): sensor_msgs.Image => ({
  header: { stamp: { sec: 0, nsec: 0 }, frame_id: 'camera' },
  width: 2,
  height: 2,
  encoding: 'rgb8',
  is_bigendian: 0,
  step: 6,
  data: [],
  ...fields,
});

const base64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

test('rows are read with their padded step', () => {
  // 2×2 rgb8 rows are 6 bytes, padded to 8.
  const pixels = decodeImagePixels(
    image({
      step: 8,
      data: base64([1, 2, 3, 4, 5, 6, 0, 0, 7, 8, 9, 10, 11, 12, 0, 0]),
    })
  );
  expect(Array.from(pixels)).toEqual([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
});

test('bgr8 swaps red and blue', () => {
  const pixels = decodeImagePixels(
    image({ width: 1, height: 1, step: 3, encoding: 'bgr8', data: [1, 2, 3] })
  );
  expect(Array.from(pixels)).toEqual([3, 2, 1, 255]);
});

test('mono8 is contrast-stretched and 16UC1 honours big-endian data', () => {
  const mono = decodeImagePixels(image({ height: 1, step: 2, encoding: 'mono8', data: [10, 20] }));
  expect(Array.from(mono)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  const depth = decodeImagePixels(
    image({ height: 1, step: 4, encoding: '16UC1', is_bigendian: 1, data: [0, 0, 0x01, 0x00] })
  );
  // Zero depth is invalid (black); the only valid depth maps to the near end (blue).
  expect(Array.from(depth)).toEqual([0, 0, 0, 255, 0, 0, 255, 255]);
});

test('short buffers and unknown encodings are rejected', () => {
  expect(() => decodeImagePixels(image({ data: [1, 2, 3] }))).toThrow('too short');
  expect(() => decodeImagePixels(image({ encoding: 'yuv422', data: [1] }))).toThrow(
    'Unsupported image encoding'
  );
});
