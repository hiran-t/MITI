/**
 * Panel arrangement as a binary split tree, the model Foxglove's layout uses (react-mosaic):
 * every node is a panel id or a row/column split of two nodes at a percentage.
 */
export type MosaicDirection = 'row' | 'column';
export interface MosaicSplit {
  direction: MosaicDirection;
  first: MosaicTree;
  second: MosaicTree;
  /** Share of the first node, 0–100; undefined splits evenly. */
  splitPercentage?: number;
}
export type MosaicTree = string | MosaicSplit;

interface GridRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const isSplit = (node: MosaicTree | null | undefined): node is MosaicSplit =>
  !!node && typeof node === 'object';

export function leaves(node: MosaicTree | null | undefined): string[] {
  if (node == null) return [];
  return isSplit(node) ? [...leaves(node.first), ...leaves(node.second)] : [node];
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
    return {
      direction: axis === 'x' ? 'row' : 'column',
      first: mosaicFromGrid(before)!,
      second: mosaicFromGrid(after)!,
      splitPercentage: Math.round(((cut - start) / (end - start)) * 1000) / 10,
    };
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
  return {
    direction,
    first: balanced(ids.slice(0, half), other)!,
    second: balanced(ids.slice(half), other)!,
    splitPercentage: (half / ids.length) * 100,
  };
}

/** Removes a panel; its sibling takes the freed space. */
export function removeFromMosaic(node: MosaicTree | null, id: string): MosaicTree | null {
  if (node == null) return null;
  if (!isSplit(node)) return node === id ? null : node;
  const first = removeFromMosaic(node.first, id);
  const second = removeFromMosaic(node.second, id);
  if (first == null) return second;
  if (second == null) return first;
  return first === node.first && second === node.second ? node : { ...node, first, second };
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
  const place = (n: MosaicTree): MosaicTree => ({
    direction,
    first: n,
    second: id,
    splitPercentage: target ? 50 : 70,
  });
  if (!target || !leaves(node).includes(target)) return place(node);
  const visit = (n: MosaicTree): MosaicTree =>
    isSplit(n)
      ? { ...n, first: visit(n.first), second: visit(n.second) }
      : n === target
        ? place(n)
        : n;
  return visit(node);
}

/** Drops panels that no longer exist, removes duplicates, and adds panels missing from the tree. */
export function syncMosaic(node: MosaicTree | null | undefined, ids: string[]): MosaicTree | null {
  const wanted = new Set(ids);
  const seen = new Set<string>();
  const prune = (n: MosaicTree | null | undefined): MosaicTree | null => {
    if (n == null) return null;
    if (!isSplit(n)) {
      if (typeof n !== 'string' || !wanted.has(n) || seen.has(n)) return null;
      seen.add(n);
      return n;
    }
    if (n.direction !== 'row' && n.direction !== 'column') return null;
    const first = prune(n.first);
    const second = prune(n.second);
    if (first == null) return second;
    if (second == null) return first;
    const pct = n.splitPercentage;
    return {
      direction: n.direction,
      first,
      second,
      ...(typeof pct === 'number' && Number.isFinite(pct)
        ? { splitPercentage: Math.min(100, Math.max(0, pct)) }
        : {}),
    };
  };
  let tree = prune(node);
  for (const id of ids) if (!seen.has(id)) tree = addToMosaic(tree, id);
  return tree;
}
