import { Matrix4, Quaternion, Vector3 } from 'three';
import type { TFTree, Transform, TFFrame } from '@/types/tf-messages';

export interface Stamp {
  sec?: number;
  nanosec?: number;
  secs?: number;
  nsecs?: number;
  nsec?: number;
}
export const stampSeconds = (stamp?: Stamp) =>
  (stamp?.sec ?? stamp?.secs ?? 0) + (stamp?.nanosec ?? stamp?.nsecs ?? stamp?.nsec ?? 0) / 1e9;
export const frameName = (name: string) => name.replace(/^\/+/, '');
export function transformMatrix(t: Transform) {
  const q = new Quaternion(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
  if (!Number.isFinite(q.lengthSq()) || q.lengthSq() < 1e-12)
    throw new Error('Invalid transform quaternion');
  const p = new Vector3(t.translation.x, t.translation.y, t.translation.z);
  if (![p.x, p.y, p.z].every(Number.isFinite)) throw new Error('Invalid transform position');
  return new Matrix4().compose(p, q.normalize(), new Vector3(1, 1, 1));
}
function sample(frame: TFFrame, time: number) {
  if (frame.isStatic || !time || !frame.history?.length) return transformMatrix(frame.transform);
  const history = frame.history;
  // First sample at or after `time` (binary search; histories hold thousands of samples).
  let low = 0,
    high = history.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (history[mid].time < time) low = mid + 1;
    else high = mid;
  }
  const after = low === history.length ? -1 : low;
  if (after === -1) {
    if (time - history[history.length - 1].time > 0.2)
      throw new Error(`TF is too old: ${frame.name}`);
    return transformMatrix(history[history.length - 1].transform);
  }
  if (after === 0) {
    if (history[0].time - time > 0.2) throw new Error(`TF history unavailable: ${frame.name}`);
    return transformMatrix(history[0].transform);
  }
  const a = history[after - 1],
    b = history[after];
  const t = (time - a.time) / (b.time - a.time || 1);
  const pa = new Vector3(),
    pb = new Vector3(),
    qa = new Quaternion(),
    qb = new Quaternion();
  transformMatrix(a.transform).decompose(pa, qa, new Vector3());
  transformMatrix(b.transform).decompose(pb, qb, new Vector3());
  return new Matrix4().compose(pa.lerp(pb, t), qa.slerp(qb, t), new Vector3(1, 1, 1));
}
/** Walk to a common ancestor; never pretend disconnected trees share an origin. */
export function lookupTransform(tree: TFTree, target: string, source: string, time = 0): Matrix4 {
  target = frameName(target);
  source = frameName(source);
  if (!target || !source) throw new Error('Missing frame_id or fixed frame');
  if (target === source) return new Matrix4();
  function chain(start: string) {
    const result: string[] = [];
    let name = start;
    while (name) {
      if (result.includes(name)) throw new Error(`TF cycle at ${name}`);
      result.push(name);
      const frame = tree.frames.get(name);
      if (!frame?.parent) break;
      name = frameName(frame.parent);
    }
    return result;
  }
  const from = chain(source),
    to = chain(target);
  const common = from.find((name) => to.includes(name));
  if (!common) throw new Error(`No transform: ${source} → ${target}`);
  function accumulate(path: string[]) {
    let matrix = new Matrix4();
    for (const name of path) {
      if (name === common) break;
      matrix = sample(tree.frames.get(name)!, time).multiply(matrix);
    }
    return matrix;
  }
  return accumulate(to).invert().multiply(accumulate(from));
}
