import { Vector3 } from 'three';
import { lookupTransform, stampSeconds } from '../transforms';
import type { TFFrame, TFTree } from '@/types/tf-messages';
const transform = (x: number) => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
});
const frame = (name: string, parent: string, x: number): TFFrame => ({
  name,
  parent,
  transform: transform(x),
  timestamp: 0,
  children: [],
  isStatic: true,
});
const tree = (frames: TFFrame[]): TFTree => ({
  frames: new Map(frames.map((f) => [f.name, f])),
  rootFrame: 'map',
});
const x = (m: ReturnType<typeof lookupTransform>) => new Vector3().setFromMatrixPosition(m).x;
test('composes and inverts transforms through a shared ancestor', () => {
  const t = tree([
    frame('base_link', 'map', 10),
    frame('lidar', 'base_link', 2),
    frame('camera', 'base_link', 3),
  ]);
  expect(x(lookupTransform(t, 'map', 'lidar'))).toBe(12);
  expect(x(lookupTransform(t, 'lidar', 'map'))).toBe(-12);
  expect(x(lookupTransform(t, 'camera', 'lidar'))).toBe(-1);
  expect(x(lookupTransform(t, '/map', '/lidar'))).toBe(12);
});
test('rejects missing transforms and cycles instead of rendering at origin', () => {
  expect(() => lookupTransform(tree([]), 'map', 'camera')).toThrow('No transform');
  expect(() => lookupTransform(tree([frame('a', 'b', 1), frame('b', 'a', 1)]), 'map', 'a')).toThrow(
    'cycle'
  );
});
test('interpolates ROS timestamps and rejects extrapolation beyond tolerance', () => {
  const t = tree([
    {
      ...frame('robot', 'map', 10),
      isStatic: false,
      history: [
        { time: 1, transform: transform(0) },
        { time: 3, transform: transform(10) },
      ],
    },
  ]);
  expect(x(lookupTransform(t, 'map', 'robot', 2))).toBe(5);
  expect(() => lookupTransform(t, 'map', 'robot', 4)).toThrow('too old');
  expect(() => lookupTransform(t, 'map', 'robot', 0.5)).toThrow('history');
  expect(stampSeconds({ sec: 2, nanosec: 500000000 })).toBe(2.5);
  expect(stampSeconds({ secs: 2, nsecs: 500000000 })).toBe(2.5);
});

test('relative lookup does not require timestamp history above the common ancestor', () => {
  const t = tree([
    {
      ...frame('base', 'map', 10),
      isStatic: false,
      history: [{ time: 1, transform: transform(10) }],
    },
    frame('sensor', 'base', 2),
  ]);
  expect(x(lookupTransform(t, 'base', 'sensor', 100))).toBe(2);
});
