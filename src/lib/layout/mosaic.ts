/**
 * Panel arrangement as react-mosaic 7's n-ary tree, the model Foxglove's layout uses: every node
 * is a panel id or a row/column split of two or more nodes, each with its share.
 *
 * MITI 3.4.5 and earlier saved react-mosaic 6's binary tree (`first`, `second`,
 * `splitPercentage`); `syncMosaic` converts it, keeping every panel's place and size.
 */
export type MosaicDirection = 'row' | 'column';
export interface MosaicSplit {
  type: 'split';
  direction: MosaicDirection;
  children: MosaicTree[];
  /** Share of each child, 0–100, summing to 100; undefined splits evenly. MITI always sets it. */
  splitPercentages?: number[];
}
export type MosaicTree = string | MosaicSplit;

/** A split as MITI 3.4.5 and earlier saved it (react-mosaic 6's binary tree). */
export interface LegacyMosaicSplit {
  direction: MosaicDirection;
  first: LegacyMosaicTree;
  second: LegacyMosaicTree;
  /** Share of the first node, 0–100; undefined splits evenly. */
  splitPercentage?: number;
}
export type LegacyMosaicTree = string | LegacyMosaicSplit;

interface GridRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const isSplit = (node: MosaicTree | null | undefined): node is MosaicSplit =>
  !!node && typeof node === 'object' && node.type === 'split';

/** A binary split saved by MITI 3.4.5 or earlier. */
export const isLegacySplit = (node: unknown): node is LegacyMosaicSplit =>
  !!node && typeof node === 'object' && ('first' in node || 'second' in node);

export function leaves(node: MosaicTree | null | undefined): string[] {
  if (node == null) return [];
  return isSplit(node) ? node.children.flatMap(leaves) : [node];
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Shares scaled to sum to 100, or even shares when they cannot be. */
function toHundred(given: unknown, count: number): number[] {
  if (
    Array.isArray(given) &&
    given.length === count &&
    given.every((share) => finite(share) && share >= 0)
  ) {
    const total = given.reduce((sum: number, share: number) => sum + share, 0);
    if (Math.abs(total - 100) < 1e-6) return [...given];
    if (total > 0) return given.map((share: number) => (share / total) * 100);
  }
  return Array<number>(count).fill(100 / count);
}

/** Each child's share of a split: its `splitPercentages`, or even shares when they are unset. */
export const shares = (split: MosaicSplit): number[] =>
  toHundred(split.splitPercentages, split.children.length);

/** Two nodes side by side (`row`) or stacked (`column`), the first taking `firstShare` percent. */
function pair(
  direction: MosaicDirection,
  first: MosaicTree,
  second: MosaicTree,
  firstShare: number
): MosaicSplit {
  const share = Math.round(firstShare * 10) / 10;
  return {
    type: 'split',
    direction,
    children: [first, second],
    splitPercentages: [share, Math.round((100 - share) * 10) / 10],
  };
}

/** A split of the children that remain; they share the space of the others in proportion. */
function remaining(
  direction: MosaicDirection,
  kept: { node: MosaicTree; share: number }[]
): MosaicTree | null {
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0].node;
  return {
    type: 'split',
    direction,
    children: kept.map((child) => child.node),
    splitPercentages: toHundred(
      kept.map((child) => child.share),
      kept.length
    ),
  };
}

/**
 * Converts react-grid-layout positions into a split tree by cutting the grid where no panel
 * crosses (a guillotine cut), so saved MITI 2.x layouts keep their arrangement.
 */
export function mosaicFromGrid(rects: GridRect[]): MosaicTree | null {
  if (!rects.length) return null;
  if (rects.length === 1) return rects[0].id;
  const span = (axis: 'x' | 'y') => {
    const size: 'w' | 'h' = axis === 'x' ? 'w' : 'h';
    const start = Math.min(...rects.map((r) => r[axis]));
    const end = Math.max(...rects.map((r) => r[axis] + r[size]));
    return { start, end, size };
  };
  for (const axis of ['x', 'y'] as const) {
    const { start, end, size } = span(axis);
    // Candidate cuts are panel edges that no panel straddles.
    const cuts = Array.from(new Set(rects.map((r) => r[axis] + r[size])))
      .filter((cut) => cut > start && cut < end)
      .filter((cut) => rects.every((r) => r[axis] + r[size] <= cut || r[axis] >= cut))
      .sort((a, b) => a - b);
    if (!cuts.length) continue;
    const cut = cuts[0];
    const before = rects.filter((r) => r[axis] + r[size] <= cut);
    const after = rects.filter((r) => r[axis] >= cut);
    return pair(
      axis === 'x' ? 'row' : 'column',
      mosaicFromGrid(before)!,
      mosaicFromGrid(after)!,
      ((cut - start) / (end - start)) * 100
    );
  }
  // Overlapping legacy panels have no clean cut; stack them in reading order.
  const ordered = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  return balanced(
    ordered.map((r) => r.id),
    'column'
  );
}

function balanced(ids: string[], direction: MosaicDirection): MosaicTree | null {
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0];
  const half = Math.ceil(ids.length / 2);
  const other: MosaicDirection = direction === 'row' ? 'column' : 'row';
  return pair(
    direction,
    balanced(ids.slice(0, half), other)!,
    balanced(ids.slice(half), other)!,
    (half / ids.length) * 100
  );
}

/** Removes a panel; the panels beside it take the freed space. */
export function removeFromMosaic(node: MosaicTree | null, id: string): MosaicTree | null {
  if (node == null) return null;
  if (!isSplit(node)) return node === id ? null : node;
  const share = shares(node);
  const kept = node.children
    .map((child, index) => ({ node: removeFromMosaic(child, id), share: share[index] }))
    .filter((child): child is { node: MosaicTree; share: number } => child.node != null);
  if (kept.length === node.children.length && kept.every((c, i) => c.node === node.children[i]))
    return node;
  return remaining(node.direction, kept);
}

/**
 * Adds a panel beside `target` (or beside everything when there is no target), splitting along
 * the target's longer side as Foxglove does when a panel is added next to another.
 */
export function addToMosaic(
  node: MosaicTree | null,
  id: string,
  target?: string | null,
  direction: MosaicDirection = 'row'
): MosaicTree {
  if (node == null) return id;
  const place = (n: MosaicTree): MosaicTree => pair(direction, n, id, target ? 50 : 70);
  if (!target || !leaves(node).includes(target)) return place(node);
  const visit = (n: MosaicTree): MosaicTree =>
    isSplit(n) ? { ...n, children: n.children.map(visit) } : n === target ? place(n) : n;
  return visit(node);
}

/**
 * Reads a stored tree, n-ary or binary (MITI 3.4.5 and earlier), into an n-ary tree that holds
 * each panel in `ids` exactly once: it drops panels that no longer exist, duplicates and invalid
 * nodes, gives every split explicit shares, and adds panels missing from the tree. Explicit shares
 * matter: when react-mosaic flattens nested splits after a drag, it keeps sizes only if every split
 * has them.
 *
 * MITI has no tabs, so a react-mosaic tab group (`type: 'tabs'`) opens as its panels side by side.
 */
export function syncMosaic(node: unknown, ids: string[]): MosaicTree | null {
  const wanted = new Set(ids);
  const seen = new Set<string>();
  const prune = (n: unknown): MosaicTree | null => {
    if (typeof n === 'string') {
      if (!wanted.has(n) || seen.has(n)) return null;
      seen.add(n);
      return n;
    }
    if (!n || typeof n !== 'object') return null;
    const value = n as Record<string, unknown>;
    let direction = value.direction;
    let children: unknown[];
    let given: number[];
    if (value.type === 'tabs' && Array.isArray(value.tabs)) {
      direction = 'row';
      children = value.tabs;
      given = toHundred(null, children.length);
    } else if (isLegacySplit(value)) {
      children = [value.first, value.second];
      const first = finite(value.splitPercentage)
        ? Math.min(100, Math.max(0, value.splitPercentage))
        : 50;
      given = [first, 100 - first];
    } else if (value.type === 'split' && Array.isArray(value.children)) {
      children = value.children;
      given = toHundred(value.splitPercentages, children.length);
    } else return null;
    if (direction !== 'row' && direction !== 'column') return null;
    return remaining(
      direction,
      children
        .map((child, index) => ({ node: prune(child), share: given[index] }))
        .filter((child): child is { node: MosaicTree; share: number } => child.node != null)
    );
  };
  let tree = prune(node);
  for (const id of ids) if (!seen.has(id)) tree = addToMosaic(tree, id);
  return tree;
}
