import * as THREE from 'three';

/** Spare room when a geometry is (re)allocated, so a cloud whose size varies keeps its buffers. */
const GROWTH = 1.25;

function write(attribute: THREE.BufferAttribute, values: Float32Array, length: number): void {
  (attribute.array as Float32Array).set(
    length < values.length ? values.subarray(0, length) : values
  );
  // Upload only what is drawn.
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, length);
  attribute.needsUpdate = true;
}

/**
 * Write a message's points (x y z each) and colors (r g b a each) into `geometry`'s `position` and
 * `rgba` attributes and draw only those. The same geometry comes back while it has room; otherwise
 * a larger one, and the caller disposes the old one once it is no longer drawn.
 */
export function updatePointGeometry(
  geometry: THREE.BufferGeometry | null,
  positions: Float32Array,
  colors: Float32Array,
  count: number
): THREE.BufferGeometry {
  const capacity = (geometry?.getAttribute('position') as THREE.BufferAttribute | undefined)?.count;
  let target = geometry;
  if (!target || capacity === undefined || capacity < count) {
    const size = Math.max(1, Math.ceil(count * GROWTH));
    target = new THREE.BufferGeometry();
    target.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(size * 3), 3).setUsage(THREE.DynamicDrawUsage)
    );
    target.setAttribute(
      'rgba',
      new THREE.BufferAttribute(new Float32Array(size * 4), 4).setUsage(THREE.DynamicDrawUsage)
    );
  }
  write(target.getAttribute('position') as THREE.BufferAttribute, positions, count * 3);
  write(target.getAttribute('rgba') as THREE.BufferAttribute, colors, count * 4);
  target.setDrawRange(0, count);
  return target;
}
