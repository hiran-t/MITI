import { Matrix4, Vector3 } from 'three';
import { transformMatrix, lookupTransform, stampSeconds } from './transforms';
import type { Header, Pose, Vec3, Marker } from '@/types/scene';
import type { TFTree } from '@/types/tf-messages';
import type { PointData } from '@/lib/parsers/pointcloud-parser';
import { DEFAULT_MAP_COLORS, occupancyPalette } from './colors';
export const xyz = (p: Vec3): [number, number, number] => {
  if (!p || ![p.x, p.y, p.z].every(Number.isFinite)) throw new Error('Invalid XYZ coordinates');
  return [p.x, p.y, p.z];
};
export const poseMatrix = (p: Pose) =>
  transformMatrix({ translation: p.position, rotation: p.orientation });
export function messageTransform(tree: TFTree, fixed: string, header: Header, sync: boolean) {
  return lookupTransform(
    tree,
    fixed,
    header?.frame_id ?? '',
    sync ? stampSeconds(header?.stamp) : 0
  );
}
type LaserScan = {
  ranges: number[] | Float32Array;
  intensities?: number[] | Float32Array;
  angle_min: number;
  angle_increment: number;
  range_min: number;
  range_max: number;
};
/** Points of a LaserScan in its frame; `range` and `intensity` can color them. */
export function laserCloud(msg: LaserScan, max = 200000): PointData {
  if (
    !msg.ranges ||
    typeof msg.ranges.length !== 'number' ||
    ![msg.angle_min, msg.angle_increment, msg.range_min, msg.range_max].every(Number.isFinite)
  )
    throw new Error('Invalid LaserScan');
  const kept: number[] = [];
  const stride = Math.max(1, Math.ceil(msg.ranges.length / max));
  for (let i = 0; i < msg.ranges.length; i += stride) {
    const r = msg.ranges[i];
    if (Number.isFinite(r) && r >= msg.range_min && r <= msg.range_max) kept.push(i);
  }
  const positions = new Float32Array(kept.length * 3);
  kept.forEach((index, i) => {
    const r = msg.ranges[index],
      a = msg.angle_min + index * msg.angle_increment;
    positions[i * 3] = r * Math.cos(a);
    positions[i * 3 + 1] = r * Math.sin(a);
  });
  const intensities =
    msg.intensities && msg.intensities.length === msg.ranges.length ? msg.intensities : undefined;
  const axes = ['x', 'y', 'z'];
  return {
    count: kept.length,
    positions,
    fields: intensities ? ['range', 'intensity', ...axes] : ['range', ...axes],
    hasColors: false,
    values(field) {
      const source = field === 'range' ? msg.ranges : field === 'intensity' ? intensities : null;
      const axis = axes.indexOf(field);
      if (!source && axis < 0) return undefined;
      const out = new Float32Array(kept.length);
      kept.forEach((index, i) => (out[i] = source ? source[index] : positions[i * 3 + axis]));
      return out;
    },
    colors: () => undefined,
  };
}
export function laserPoints(msg: LaserScan, max = 200000) {
  return Array.from(laserCloud(msg, max).positions);
}
/** RGBA pixels of an occupancy grid, colored by a 256-entry palette indexed by the cell byte. */
export function occupancyPixels(
  width: number,
  height: number,
  data: ArrayLike<number> | string,
  palette: Uint8Array = occupancyPalette({ colorMode: 'custom', ...DEFAULT_MAP_COLORS })
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > 16777216
  )
    throw new Error('Invalid map dimensions (maximum 16M cells)');
  const cells: ArrayLike<number> =
    typeof data === 'string' ? Array.from(atob(data), (c) => c.charCodeAt(0)) : data;
  if (!cells || typeof cells.length !== 'number' || cells.length < width * height)
    throw new Error('Map data is truncated');
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = (cells[i] & 0xff) * 4;
    pixels[i * 4] = palette[p];
    pixels[i * 4 + 1] = palette[p + 1];
    pixels[i * 4 + 2] = palette[p + 2];
    pixels[i * 4 + 3] = palette[p + 3];
  }
  return pixels;
}
export interface StoredMarker {
  marker: Marker;
  expires: number;
  matrix?: Matrix4;
}
export function updateMarkers(
  previous: Map<string, StoredMarker>,
  incoming: Marker[],
  now: number
) {
  const next = new Map(previous);
  for (const marker of incoming) {
    if (
      !marker ||
      typeof marker.ns !== 'string' ||
      !Number.isFinite(marker.id) ||
      ![0, 2, 3].includes(marker.action)
    )
      continue;
    const key = `${marker.ns}/${marker.id}`;
    if (marker.action === 3) {
      next.forEach((entry, id) => {
        if (!marker.ns || entry.marker.ns === marker.ns) next.delete(id);
      });
    } else if (marker.action === 2) next.delete(key);
    else if (marker.action === 0) {
      const lifetime = stampSeconds(marker.lifetime);
      next.set(key, { marker, expires: lifetime > 0 ? now + lifetime * 1000 : Infinity });
    }
  }
  next.forEach((entry, key) => {
    if (entry.expires <= now) next.delete(key);
  });
  return next;
}
export function transformPoint(p: Vec3, m: Matrix4): [number, number, number] {
  const v = new Vector3(...xyz(p)).applyMatrix4(m);
  return [v.x, v.y, v.z];
}
