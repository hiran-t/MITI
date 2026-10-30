import { Vector3 } from 'three';
import { segmentColors, segmentPositions } from '../FatLine';

test('a polyline becomes consecutive segments', () => {
  const points = [new Vector3(0, 0, 0), [1, 0, 0] as const, new Vector3(1, 1, 0)];
  expect(Array.from(segmentPositions(points))).toEqual([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0]);
});

test('with segments, points are taken in pairs and an unpaired last point is ignored', () => {
  const points = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0],
    [3, 0, 0],
    [9, 9, 9],
  ] as const;
  expect(Array.from(segmentPositions(points, true))).toEqual([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0]);
  expect(segmentPositions([[0, 0, 0]] as const)).toHaveLength(0);
});

test('colors follow the segment layout, with alpha when given', () => {
  const colors = [
    [1, 0, 0, 0.5],
    [0, 1, 0, 1],
    [0, 0, 1, 0.25],
  ] as const;
  expect(Array.from(segmentColors(colors, 4))).toEqual([
    1, 0, 0, 0.5, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0.25,
  ]);
  expect(
    Array.from(
      segmentColors(
        [
          [1, 0, 0],
          [0, 1, 0],
        ] as const,
        3
      )
    )
  ).toEqual([1, 0, 0, 0, 1, 0]);
});
