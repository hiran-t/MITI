import {
  addToMosaic,
  leaves,
  mosaicFromGrid,
  removeFromMosaic,
  shares,
  syncMosaic,
  type LegacyMosaicTree,
  type MosaicSplit,
  type MosaicTree,
} from '../mosaic';
import { DEFAULT_LAYOUT } from '@/types/widget';

type Rect = [x: number, y: number, w: number, h: number];

/** Where each panel of a tree lands in a 100×100 workspace. */
function geometry(node: MosaicTree | LegacyMosaicTree, rect: Rect = [0, 0, 100, 100]) {
  const out: Record<string, Rect> = {};
  const place = (n: unknown, [x, y, w, h]: Rect) => {
    if (typeof n === 'string') {
      out[n] = [x, y, w, h].map((v) => Math.round(v * 1000) / 1000) as Rect;
      return;
    }
    const split = n as {
      direction: 'row' | 'column';
      first?: unknown;
      second?: unknown;
      splitPercentage?: number;
      children?: unknown[];
    };
    const children = split.children ?? [split.first, split.second];
    const parts = split.children
      ? shares(split as MosaicSplit)
      : [split.splitPercentage ?? 50, 100 - (split.splitPercentage ?? 50)];
    let offset = 0;
    children.forEach((child, i) => {
      const size = parts[i] / 100;
      place(
        child,
        split.direction === 'row'
          ? [x + offset * w, y, size * w, h]
          : [x, y + offset * h, w, size * h]
      );
      offset += size;
    });
  };
  place(node, rect);
  return out;
}

/** A layout as MITI 3.4.5 saved it: nested binary splits, some without a percentage. */
const saved34: LegacyMosaicTree = {
  direction: 'row',
  first: {
    direction: 'column',
    first: 'scene',
    second: { direction: 'row', first: 'log', second: 'topics' },
    splitPercentage: 72,
  },
  second: {
    direction: 'column',
    first: { direction: 'column', first: 'cam-1', second: 'cam-2', splitPercentage: 40 },
    second: 'cam-3',
    splitPercentage: 66.7,
  },
  splitPercentage: 61.5,
};
const ids34 = ['scene', 'log', 'topics', 'cam-1', 'cam-2', 'cam-3'];

test('a binary tree saved by MITI 3.4.5 opens unchanged as an n-ary tree', () => {
  const tree = syncMosaic(saved34, ids34);
  expect(tree).toEqual({
    type: 'split',
    direction: 'row',
    children: [
      {
        type: 'split',
        direction: 'column',
        children: [
          'scene',
          {
            type: 'split',
            direction: 'row',
            children: ['log', 'topics'],
            splitPercentages: [50, 50],
          },
        ],
        splitPercentages: [72, 28],
      },
      {
        type: 'split',
        direction: 'column',
        children: [
          {
            type: 'split',
            direction: 'column',
            children: ['cam-1', 'cam-2'],
            splitPercentages: [40, 60],
          },
          'cam-3',
        ],
        splitPercentages: [66.7, 100 - 66.7],
      },
    ],
    splitPercentages: [61.5, 38.5],
  });
  // Every panel keeps its place and size.
  expect(geometry(tree!)).toEqual(geometry(saved34));
  // Converting again changes nothing.
  expect(syncMosaic(tree, ids34)).toEqual(tree);
});

test('converted splits always carry shares, so nested splits keep their sizes', () => {
  const tree = syncMosaic(
    { direction: 'row', first: { direction: 'row', first: 'a', second: 'b' }, second: 'c' },
    ['a', 'b', 'c']
  ) as MosaicSplit;
  expect(tree.splitPercentages).toEqual([50, 50]);
  expect((tree.children[0] as MosaicSplit).splitPercentages).toEqual([50, 50]);
  expect(geometry(tree)).toEqual({
    a: [0, 0, 25, 100],
    b: [25, 0, 25, 100],
    c: [50, 0, 50, 100],
  });
});

test('converts the default layout into splits that keep its arrangement', () => {
  const tree = DEFAULT_LAYOUT.mosaic as MosaicSplit;
  // Scene on the left half; two cameras above the log on the right.
  expect(tree).toEqual({
    type: 'split',
    direction: 'row',
    children: [
      'urdf-viewer-1',
      {
        type: 'split',
        direction: 'column',
        children: [
          {
            type: 'split',
            direction: 'row',
            children: ['camera-viewer-1', 'camera-viewer-2'],
            splitPercentages: [50, 50],
          },
          'log-1',
        ],
        splitPercentages: [50, 50],
      },
    ],
    splitPercentages: [50, 50],
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
    type: 'split',
    direction: 'row',
    children: [
      { type: 'split', direction: 'column', children: ['a', 'c'], splitPercentages: [50, 50] },
      { type: 'split', direction: 'column', children: ['b', 'd'], splitPercentages: [50, 50] },
    ],
    splitPercentages: [50, 50],
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
    type: 'split',
    direction: 'column',
    children: [
      {
        type: 'split',
        direction: 'row',
        children: ['wide', 'narrow'],
        splitPercentages: [75, 25],
      },
      'below',
    ],
    splitPercentages: [25, 75],
  });
  const overlapping = mosaicFromGrid([
    { id: 'a', x: 0, y: 0, w: 6, h: 6 },
    { id: 'b', x: 3, y: 3, w: 6, h: 6 },
    { id: 'c', x: 1, y: 1, w: 2, h: 2 },
  ]);
  expect(leaves(overlapping).sort()).toEqual(['a', 'b', 'c']);
  expect(mosaicFromGrid([])).toBeNull();
});

test('adds beside a panel, removes panels, and lets the others take the space', () => {
  let tree = addToMosaic(null, 'a');
  expect(tree).toBe('a');
  tree = addToMosaic(tree, 'b');
  expect(tree).toEqual({
    type: 'split',
    direction: 'row',
    children: ['a', 'b'],
    splitPercentages: [70, 30],
  });
  tree = addToMosaic(tree, 'c', 'a');
  expect(tree).toEqual({
    type: 'split',
    direction: 'row',
    children: [
      { type: 'split', direction: 'row', children: ['a', 'c'], splitPercentages: [50, 50] },
      'b',
    ],
    splitPercentages: [70, 30],
  });
  expect(removeFromMosaic(tree, 'a')).toEqual({
    type: 'split',
    direction: 'row',
    children: ['c', 'b'],
    splitPercentages: [70, 30],
  });
  expect(removeFromMosaic(tree, 'missing')).toBe(tree);
  expect(removeFromMosaic('a', 'a')).toBeNull();
  // In a split of three, the other two share the freed space in proportion.
  expect(
    removeFromMosaic(
      {
        type: 'split',
        direction: 'row',
        children: ['a', 'b', 'c'],
        splitPercentages: [20, 20, 60],
      },
      'c'
    )
  ).toEqual({ type: 'split', direction: 'row', children: ['a', 'b'], splitPercentages: [50, 50] });
});

test('a tab group opens as its panels side by side, since MITI has no tabs', () => {
  const tabs = { type: 'tabs', tabs: ['a', 'b', 'c'], activeTabIndex: 2 };
  expect(
    syncMosaic({ type: 'split', direction: 'column', children: ['x', tabs] }, ['x', 'a', 'b', 'c'])
  ).toEqual({
    type: 'split',
    direction: 'column',
    children: [
      'x',
      {
        type: 'split',
        direction: 'row',
        children: ['a', 'b', 'c'],
        splitPercentages: [100 / 3, 100 / 3, 100 / 3],
      },
    ],
    splitPercentages: [50, 50],
  });
  expect(syncMosaic(tabs, ['b'])).toBe('b');
});

test('sync drops unknown and duplicate panels, adds missing ones, and rejects bad nodes', () => {
  const stored = {
    direction: 'row',
    first: { direction: 'column', first: 'a', second: 'gone', splitPercentage: 140 },
    second: { direction: 'diagonal', first: 'a', second: 'b' },
  };
  // 'gone' and the duplicate 'a' are dropped; 'b' (under an invalid split) and 'c' are added.
  expect(leaves(syncMosaic(stored, ['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
  expect(
    syncMosaic({ ...stored, first: 'a', second: 'b', splitPercentage: 140 }, ['a', 'b'])
  ).toEqual({ type: 'split', direction: 'row', children: ['a', 'b'], splitPercentages: [100, 0] });
  // Shares that do not add up to 100 are scaled; missing or broken ones become even.
  expect(
    syncMosaic(
      { type: 'split', direction: 'column', children: ['a', 'b'], splitPercentages: [1, 3] },
      ['a', 'b']
    )
  ).toMatchObject({ splitPercentages: [25, 75] });
  expect(
    syncMosaic(
      {
        type: 'split',
        direction: 'column',
        children: ['a', 'b', 'c'],
        splitPercentages: [50, 'x'],
      },
      ['a', 'b', 'c']
    )
  ).toMatchObject({ splitPercentages: [100 / 3, 100 / 3, 100 / 3] });
  // A pruned child's share goes to the others.
  expect(
    syncMosaic(
      {
        type: 'split',
        direction: 'row',
        children: ['a', 'gone', 'b'],
        splitPercentages: [30, 40, 30],
      },
      ['a', 'b']
    )
  ).toEqual({ type: 'split', direction: 'row', children: ['a', 'b'], splitPercentages: [50, 50] });
  expect(syncMosaic({ type: 'split', direction: 'row' }, ['a'])).toBe('a');
  expect(syncMosaic(42, [])).toBeNull();
});
