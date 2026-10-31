import {
  addToMosaic,
  leaves,
  mosaicFromGrid,
  removeFromMosaic,
  syncMosaic,
  type MosaicSplit,
} from '../mosaic';
import { DEFAULT_LAYOUT } from '@/types/widget';

test('converts the default layout into splits that keep its arrangement', () => {
  const tree = DEFAULT_LAYOUT.mosaic as MosaicSplit;
  // Scene on the left half; two cameras above the log on the right.
  expect(tree).toMatchObject({ direction: 'row', first: 'urdf-viewer-1', splitPercentage: 50 });
  expect(tree.second).toEqual({
    direction: 'column',
    first: {
      direction: 'row',
      first: 'camera-viewer-1',
      second: 'camera-viewer-2',
      splitPercentage: 50,
    },
    second: 'log-1',
    splitPercentage: 50,
  });
});

test('a 2×2 block has cuts both ways; vertical cuts are taken first', () => {
  expect(
    mosaicFromGrid([
      { id: 'a', x: 0, y: 0, w: 3, h: 9 },
      { id: 'b', x: 3, y: 0, w: 3, h: 9 },
      { id: 'c', x: 0, y: 9, w: 3, h: 9 },
      { id: 'd', x: 3, y: 9, w: 3, h: 9 },
    ])
  ).toEqual({
    direction: 'row',
    first: { direction: 'column', first: 'a', second: 'c', splitPercentage: 50 },
    second: { direction: 'column', first: 'b', second: 'd', splitPercentage: 50 },
    splitPercentage: 50,
  });
});

test('uneven grids split at the right share, and overlapping panels still all appear', () => {
  expect(
    mosaicFromGrid([
      { id: 'wide', x: 0, y: 0, w: 9, h: 4 },
      { id: 'narrow', x: 9, y: 0, w: 3, h: 4 },
      { id: 'below', x: 0, y: 4, w: 12, h: 12 },
    ])
  ).toEqual({
    direction: 'column',
    first: { direction: 'row', first: 'wide', second: 'narrow', splitPercentage: 75 },
    second: 'below',
    splitPercentage: 25,
  });
  const overlapping = mosaicFromGrid([
    { id: 'a', x: 0, y: 0, w: 6, h: 6 },
    { id: 'b', x: 3, y: 3, w: 6, h: 6 },
    { id: 'c', x: 1, y: 1, w: 2, h: 2 },
  ]);
  expect(leaves(overlapping).sort()).toEqual(['a', 'b', 'c']);
  expect(mosaicFromGrid([])).toBeNull();
});

test('adds beside a panel, removes panels, and lets the sibling take the space', () => {
  let tree = addToMosaic(null, 'a');
  expect(tree).toBe('a');
  tree = addToMosaic(tree, 'b');
  expect(tree).toEqual({ direction: 'row', first: 'a', second: 'b', splitPercentage: 70 });
  tree = addToMosaic(tree, 'c', 'a');
  expect(tree).toEqual({
    direction: 'row',
    first: { direction: 'row', first: 'a', second: 'c', splitPercentage: 50 },
    second: 'b',
    splitPercentage: 70,
  });
  expect(removeFromMosaic(tree, 'a')).toEqual({
    direction: 'row',
    first: 'c',
    second: 'b',
    splitPercentage: 70,
  });
  expect(removeFromMosaic('a', 'a')).toBeNull();
});

test('sync drops unknown and duplicate panels, adds missing ones, and rejects bad nodes', () => {
  const stored = {
    direction: 'row',
    first: { direction: 'column', first: 'a', second: 'gone', splitPercentage: 140 },
    second: { direction: 'diagonal', first: 'a', second: 'b' },
  } as unknown as MosaicSplit;
  // 'gone' and the duplicate 'a' are dropped; 'b' (under an invalid split) and 'c' are added.
  expect(leaves(syncMosaic(stored, ['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
  expect(
    syncMosaic({ ...stored, first: 'a', second: 'b', splitPercentage: 140 }, ['a', 'b'])
  ).toEqual({ direction: 'row', first: 'a', second: 'b', splitPercentage: 100 });
});
