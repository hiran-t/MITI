import { summarizeMessage } from '../message-summary';

test('bulk fields are shortened and small fields are kept', () => {
  const summary = summarizeMessage({
    header: { frame_id: 'camera' },
    width: 640,
    data: 'A'.repeat(1000),
    ranges: Array.from({ length: 40 }, (_, i) => i),
  }) as { header: unknown; width: number; data: string; ranges: unknown[] };
  expect(summary.header).toEqual({ frame_id: 'camera' });
  expect(summary.width).toBe(640);
  expect(summary.data).toMatch(/… \(1000 chars\)$/);
  expect(summary.ranges).toHaveLength(33);
  expect(summary.ranges[32]).toBe('… 8 more');
});

test('typed arrays and 64-bit integers from CDR are summarized', () => {
  expect(
    summarizeMessage({
      data: new Uint8Array(921600),
      position: new Float64Array([1, 2]),
      seq: BigInt(5),
    })
  ).toEqual({ data: '[Uint8Array × 921600]', position: [1, 2], seq: '5' });
});
