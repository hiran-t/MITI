import { Matrix4, Vector3 } from 'three';
import { transformMatrix, lookupTransform, stampSeconds } from './transforms';
import type { Header, Pose, Vec3, Marker } from '@/types/scene';
import type { TFTree } from '@/types/tf-messages';
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
export function laserPoints(
  msg: {
    ranges: number[];
    angle_min: number;
    angle_increment: number;
    range_min: number;
    range_max: number;
  },
  max = 200000
) {
  if (
    !Array.isArray(msg.ranges) ||
    ![msg.angle_min, msg.angle_increment, msg.range_min, msg.range_max].every(Number.isFinite)
  )
    throw new Error('Invalid LaserScan');
  const points: number[] = [];
  const stride = Math.max(1, Math.ceil(msg.ranges.length / max));
  for (let i = 0; i < msg.ranges.length; i += stride) {
    const r = msg.ranges[i];
    if (Number.isFinite(r) && r >= msg.range_min && r <= msg.range_max) {
      const a = msg.angle_min + i * msg.angle_increment;
      points.push(r * Math.cos(a), r * Math.sin(a), 0);
    }
  }
  return points;
}
export function occupancyPixels(width: number, height: number, data: number[] | string) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > 16777216
  )
    throw new Error('Invalid map dimensions (maximum 16M cells)');
  const cells = typeof data === 'string' ? Array.from(atob(data), (c) => c.charCodeAt(0)) : data;
  if (!Array.isArray(cells) || cells.length < width * height)
    throw new Error('Map data is truncated');
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const value = cells[i];
    const unknown = value < 0 || value === 255;
    const shade = unknown ? 100 : Math.round(255 * (1 - Math.max(0, Math.min(value, 100)) / 100));
    pixels.set([shade, shade, shade, unknown ? 100 : 255], i * 4);
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
