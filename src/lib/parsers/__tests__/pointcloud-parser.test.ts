import { parsePointCloud2 } from '../pointcloud-parser';
import type { sensor_msgs } from '@/types/ros-messages';
function message(bigEndian = false): sensor_msgs.PointCloud2 {
  const bytes = new Uint8Array(40),
    view = new DataView(bytes.buffer);
  [0, 20].forEach((offset, i) => {
    view.setFloat32(offset, i + 1, !bigEndian);
    view.setFloat32(offset + 4, 2, !bigEndian);
    view.setFloat32(offset + 8, 3, !bigEndian);
    view.setUint32(offset + 12, 0xff8000, !bigEndian);
  });
  return {
    header: { frame_id: 'camera', stamp: { sec: 0, nsec: 0 } },
    height: 2,
    width: 1,
    fields: ['x', 'y', 'z', 'rgb'].map((name, i) => ({
      name,
      offset: i * 4,
      datatype: 7,
      count: 1,
    })),
    is_bigendian: bigEndian,
    point_step: 16,
    row_step: 20,
    data: Array.from(bytes),
    is_dense: true,
  };
}
test.each([false, true])('reads padded rows and packed FLOAT32 RGB with endian=%s', (big) => {
  const points = parsePointCloud2(message(big));
  expect(points.map((p) => p.x)).toEqual([1, 2]);
  expect(points[0].r).toBe(1);
  expect(points[0].g).toBeCloseTo(128 / 255);
  expect(points[0].b).toBe(0);
});
test('decodes base64, bounds sample count, and rejects malformed data', () => {
  const msg = message();
  msg.data = btoa(String.fromCharCode(...(msg.data as number[])));
  expect(parsePointCloud2(msg, 1)).toHaveLength(1);
  expect(() => parsePointCloud2({ ...message(), data: [1] })).toThrow('truncated');
  expect(() => parsePointCloud2({ ...message(), fields: [] })).toThrow('Missing x');
});
