import { laserPoints, occupancyPixels, updateMarkers } from '../geometry';
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
  expect(Array.from(pixels)).toEqual([255, 255, 255, 255, 0, 0, 0, 255, 100, 100, 100, 100]);
  expect(() => occupancyPixels(2, 2, [1])).toThrow('truncated');
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
