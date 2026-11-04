import * as THREE from 'three';

/**
 * Gives a mesh loaded for a URDF visual the visual's `<material>` (urdf-loader passes it to
 * `loadMeshCb`, or a default material when the URDF names none). A single mesh, as an STL loads,
 * takes it; a scene that brings its own materials, as COLLADA and glTF do, keeps them. The mesh's
 * own material is disposed when it is replaced.
 */
export function applyUrdfMaterial(object: THREE.Object3D, material: THREE.Material): void {
  if (!(object instanceof THREE.Mesh) || object.material === material) return;
  const own: THREE.Material | THREE.Material[] = object.material;
  object.material = material;
  for (const replaced of Array.isArray(own) ? own : [own]) replaced.dispose();
}
