import { readPointCloud } from '@/lib/parsers/pointcloud-parser';
import type { sensor_msgs } from '@/types/ros-messages';
import {
  autoPointColors,
  COLOR_MAPS,
  parseHex,
  pointColors,
  type PointColorSettings,
} from '../colors';

/** Three points with x, y, z, intensity and packed rgb. */
function cloud(withRgb = true): sensor_msgs.PointCloud2 {
  const names = withRgb ? ['x', 'y', 'z', 'intensity', 'rgb'] : ['x', 'y', 'z', 'intensity'];
  const step = names.length * 4;
  const bytes = new Uint8Array(step * 3),
    view = new DataView(bytes.buffer);
  [0, 5, 10].forEach((intensity, i) => {
    view.setFloat32(i * step, i, true);
    view.setFloat32(i * step + 4, 0, true);
    view.setFloat32(i * step + 8, i === 1 ? NaN : 0, true);
    view.setFloat32(i * step + 12, intensity, true);
    if (withRgb) view.setUint32(i * step + 16, 0x80ff0000, true);
  });
  return {
    header: { frame_id: 'lidar', stamp: { sec: 0, nsec: 0 } },
    height: 1,
    width: 3,
    fields: names.map((name, i) => ({
      name,
      offset: i * 4,
      datatype: name === 'rgb' ? 6 : 7,
      count: 1,
    })),
    is_bigendian: false,
    point_step: step,
    row_step: step * 3,
    data: bytes,
    is_dense: false,
  };
}

const settings = (patch: Partial<PointColorSettings>): PointColorSettings => ({
  colorMode: 'flat',
  color: '#ff0000',
  colorField: 'intensity',
  colorMap: 'turbo',
  gradient: ['#000000', '#ffffff'],
  ...patch,
});
const rgba = (colors: Float32Array, i: number) => Array.from(colors.slice(i * 4, i * 4 + 4));

test('reads positions, skips invalid points and lists colorable fields', () => {
  const points = readPointCloud(cloud());
  expect(points.count).toBe(2);
  expect(Array.from(points.positions)).toEqual([0, 0, 0, 2, 0, 0]);
  expect(points.fields).toEqual(['x', 'y', 'z', 'intensity']);
  expect(points.hasColors).toBe(true);
  expect(Array.from(points.values('intensity')!)).toEqual([0, 10]);
  expect(points.values('ring')).toBeUndefined();
});

test('picks colors like Foxglove: message colors, else intensity, else flat', () => {
  expect(autoPointColors(['x', 'intensity'], true).colorMode).toBe('rgb');
  expect(autoPointColors(['x', 'intensity'], false)).toEqual({
    colorMode: 'colormap',
    colorField: 'intensity',
  });
  expect(autoPointColors(['x', 'y', 'z'], false).colorMode).toBe('flat');
});

test('colors points flat, by gradient, by color map and from rgb(a)', () => {
  const points = readPointCloud(cloud());
  expect(rgba(pointColors(points, settings({}), 0.5).colors, 0)).toEqual([1, 0, 0, 0.5]);

  const gradient = pointColors(points, settings({ colorMode: 'gradient' }));
  expect(gradient.range).toEqual([0, 10]);
  expect(rgba(gradient.colors, 0)).toEqual([0, 0, 0, 1]);
  expect(rgba(gradient.colors, 1)).toEqual([1, 1, 1, 1]);
  const fixed = pointColors(points, settings({ colorMode: 'gradient', valueMax: 20 }));
  expect(rgba(fixed.colors, 1)[0]).toBeCloseTo(0.5);

  const turbo = (valueMax: number) =>
    rgba(pointColors(points, settings({ colorMode: 'colormap', valueMax })).colors, 1);
  expect(turbo(40)[2]).toBeGreaterThan(turbo(40)[0]); // a quarter of the range is blue
  expect(turbo(10)[0]).toBeGreaterThan(turbo(10)[2]); // the top of the range is red

  expect(rgba(pointColors(points, settings({ colorMode: 'rgb' })).colors, 0)).toEqual([1, 0, 0, 1]);
  const withAlpha = rgba(pointColors(points, settings({ colorMode: 'rgba' })).colors, 0);
  expect(withAlpha[3]).toBeCloseTo(128 / 255);
});

test('falls back to flat and explains settings the message cannot satisfy', () => {
  const points = readPointCloud(cloud(false));
  expect(pointColors(points, settings({ colorMode: 'rgb' })).error).toMatch('no rgb');
  const missing = pointColors(points, settings({ colorMode: 'colormap', colorField: 'ring' }));
  expect(missing.error).toMatch('"ring"');
  expect(rgba(missing.colors, 0)).toEqual([1, 0, 0, 1]);
});

test('parses short, long and alpha hex colors', () => {
  expect(parseHex('#f00')).toEqual([1, 0, 0, 1]);
  expect(parseHex('#00ff0080')[3]).toBeCloseTo(128 / 255);
  expect(parseHex('nonsense')).toEqual([1, 1, 1, 1]);
});

test('color map colors match the map within an 8-bit step at any value', () => {
  const count = 1000;
  const view = new Float32Array(count);
  for (let i = 0; i < count; i++) view[i] = i / (count - 1);
  const points = {
    count,
    positions: new Float32Array(count * 3),
    fields: ['intensity'],
    hasColors: false,
    values: () => view,
    colors: () => undefined,
  };
  for (const colorMap of ['turbo', 'rainbow'] as const) {
    const { colors } = pointColors(points, settings({ colorMode: 'colormap', colorMap }), 0.5);
    for (let i = 0; i < count; i++) {
      const expected = COLOR_MAPS[colorMap](view[i]);
      for (let c = 0; c < 3; c++)
        expect(Math.abs(colors[i * 4 + c] - expected[c])).toBeLessThan(1 / 255);
      expect(colors[i * 4 + 3]).toBe(0.5);
    }
  }
});
