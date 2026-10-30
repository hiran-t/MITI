import { laserCloud, laserPoints, occupancyPixels, updateMarkers } from '../geometry';
import { occupancyPalette, DEFAULT_MAP_COLORS } from '../colors';
import type { Marker } from '@/types/scene';
const marker = (id: number, action = 0, ns = 'test'): Marker => ({
  id,
  action,
  ns,
  type: 1,
  header: { frame_id: 'map' },
  pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
  scale: { x: 1, y: 1, z: 1 },
  color: { r: 1, g: 0, b: 0, a: 1 },
});
test('laser scan rejects invalid ranges and projects angular coordinates', () => {
  const points = laserPoints({
    ranges: [1, 2, NaN, Infinity, 0.01],
    angle_min: 0,
    angle_increment: Math.PI / 2,
    range_min: 0.1,
    range_max: 10,
  });
  expect(points).toHaveLength(6);
  expect(points[0]).toBe(1);
  expect(points[3]).toBeCloseTo(0);
  expect(points[4]).toBeCloseTo(2);
});
test('map handles free, occupied, and signed unknown bytes', () => {
  const pixels = occupancyPixels(3, 1, [0, 100, -1]);
  expect(Array.from(pixels)).toEqual([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 128]);
  expect(() => occupancyPixels(2, 2, [1])).toThrow('truncated');
});
test('map palettes follow Foxglove: custom, RViz map, costmap and raw', () => {
  const cells = new Int8Array([0, 50, 100, -1, 120]);
  const colors = (palette: Uint8Array) => {
    const px = occupancyPixels(5, 1, cells, palette);
    return [0, 1, 2, 3, 4].map((i) => Array.from(px.slice(i * 4, i * 4 + 4)));
  };
  const custom = colors(
    occupancyPalette({ colorMode: 'custom', ...DEFAULT_MAP_COLORS, minColor: '#0000ff' })
  );
  expect(custom[0]).toEqual([0, 0, 255, 255]);
  expect(custom[2]).toEqual([0, 0, 0, 255]);
  expect(custom[4]).toEqual([255, 0, 255, 255]); // invalid
  const costmap = colors(occupancyPalette({ colorMode: 'costmap', ...DEFAULT_MAP_COLORS }));
  expect(costmap[0][3]).toBe(0); // free space is transparent
  expect(costmap[2]).toEqual([255, 0, 255, 255]); // lethal
  expect(costmap[3]).toEqual([0x70, 0x89, 0x86, 255]); // unknown
  const map = colors(occupancyPalette({ colorMode: 'map', ...DEFAULT_MAP_COLORS }));
  expect(map[0]).toEqual([255, 255, 255, 255]);
  expect(map[4]).toEqual([0, 255, 0, 255]); // illegal positive value
  const raw = colors(occupancyPalette({ colorMode: 'raw', ...DEFAULT_MAP_COLORS }));
  expect(raw[1]).toEqual([50, 50, 50, 255]);
  expect(raw[3]).toEqual([255, 255, 255, 255]);
});
test('laser scan exposes range, intensity and axes for coloring', () => {
  const scan = laserCloud({
    ranges: [1, NaN, 3],
    intensities: [10, 20, 30],
    angle_min: 0,
    angle_increment: Math.PI / 2,
    range_min: 0.1,
    range_max: 10,
  });
  expect(scan.count).toBe(2);
  expect(scan.fields).toEqual(['range', 'intensity', 'x', 'y', 'z']);
  expect(Array.from(scan.values('intensity')!)).toEqual([10, 30]);
  expect(Array.from(scan.values('range')!)).toEqual([1, 3]);
  expect(scan.values('x')![1]).toBeCloseTo(-3);
  expect(scan.values('ring')).toBeUndefined();
});
test('markers accumulate, replace, delete, clear namespace and expire', () => {
  let state = updateMarkers(new Map(), [marker(1), marker(2), marker(1, 0, 'other')], 100);
  state = updateMarkers(state, [{ ...marker(1), text: 'updated' }], 100);
  expect(state.size).toBe(3);
  expect(state.get('test/1')?.marker.text).toBe('updated');
  state = updateMarkers(state, [marker(2, 2)], 100);
  expect(state.size).toBe(2);
  state = updateMarkers(state, [marker(0, 3)], 100);
  expect(state.size).toBe(1);
  state = updateMarkers(state, [{ ...marker(3), lifetime: { sec: 1 } }], 100);
  state = updateMarkers(state, [], 1101);
  expect(state.has('test/3')).toBe(false);
  state = updateMarkers(state, [marker(0, 3, '')], 1101);
  expect(state.size).toBe(0);
});
