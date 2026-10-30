import { updatePointGeometry } from '../point-geometry';

const points = (count: number, value: number) => ({
  positions: new Float32Array(count * 3).fill(value),
  colors: new Float32Array(count * 4).fill(value / 10),
});

test('writes points into the same geometry while they fit and draws only the current message', () => {
  const first = points(100, 1);
  const geometry = updatePointGeometry(null, first.positions, first.colors, 100);
  const capacity = geometry.getAttribute('position').count;
  expect(capacity).toBeGreaterThanOrEqual(100);
  expect(geometry.drawRange).toEqual({ start: 0, count: 100 });

  const next = points(60, 2);
  const position = geometry.getAttribute('position');
  const version = (position as { version: number }).version;
  expect(updatePointGeometry(geometry, next.positions, next.colors, 60)).toBe(geometry);
  expect(geometry.getAttribute('position')).toBe(position);
  expect((position as { version: number }).version).toBeGreaterThan(version);
  expect(geometry.drawRange.count).toBe(60);
  expect(Array.from(position.array.slice(0, 3))).toEqual([2, 2, 2]);
  expect(geometry.getAttribute('rgba').array[0]).toBeCloseTo(0.2);
});

test('a larger message gets a larger geometry and leaves the old one to be disposed', () => {
  const small = points(10, 1);
  const geometry = updatePointGeometry(null, small.positions, small.colors, 10);
  const dispose = jest.spyOn(geometry, 'dispose');
  const capacity = geometry.getAttribute('position').count;
  const big = points(capacity + 1, 3);
  const grown = updatePointGeometry(geometry, big.positions, big.colors, capacity + 1);
  expect(grown).not.toBe(geometry);
  expect(dispose).not.toHaveBeenCalled();
  expect(grown.getAttribute('position').count).toBeGreaterThan(capacity);
  expect(grown.drawRange.count).toBe(capacity + 1);
});

test('positions may hold more values than the points drawn', () => {
  const geometry = updatePointGeometry(
    null,
    new Float32Array([1, 2, 3, 9, 9, 9]),
    new Float32Array(8),
    1
  );
  expect(geometry.drawRange.count).toBe(1);
  expect(Array.from(geometry.getAttribute('position').array.slice(0, 3))).toEqual([1, 2, 3]);
});
