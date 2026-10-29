import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { resolveResourceUrl, type ResourceOptions } from './resources';

export interface MeshLoadOptions {
  /** Treat COLLADA geometry as already Z-up, whatever its <up_axis> says. */
  ignoreColladaUpAxis: boolean;
  /** Up axis of formats without orientation metadata (STL, OBJ). */
  meshUpAxis: 'y_up' | 'z_up';
  manager?: THREE.LoadingManager;
  /** File extension when the URL has none (blob URLs of fetched assets). */
  format?: string;
}

const Y_UP_TO_Z_UP = new THREE.Euler(Math.PI / 2, 0, 0);

export const extensionOf = (url: string) =>
  url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';

/** A group that converts its child from Y-up to the scene's Z-up convention. */
function zUp(object: THREE.Object3D): THREE.Object3D {
  const group = new THREE.Group();
  group.rotation.copy(Y_UP_TO_Z_UP);
  group.add(object);
  return group;
}

/**
 * Load an STL, OBJ or COLLADA mesh into the ROS (Z-up) convention. STL meshes come back as a
 * single `Mesh` so URDF materials can still be assigned to them.
 */
export function loadMesh(url: string, options: MeshLoadOptions): Promise<THREE.Object3D> {
  const { manager } = options;
  return new Promise((resolve, reject) => {
    const extension = options.format ?? extensionOf(url);
    if (extension === 'stl')
      new STLLoader(manager).load(
        url,
        (geometry) => {
          if (options.meshUpAxis === 'y_up') geometry.rotateX(Math.PI / 2);
          resolve(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xaaaaaa })));
        },
        undefined,
        reject
      );
    else if (extension === 'obj')
      new OBJLoader(manager).load(
        url,
        (group) => resolve(options.meshUpAxis === 'y_up' ? zUp(group) : group),
        undefined,
        reject
      );
    else if (extension === 'dae')
      new ColladaLoader(manager).load(
        url,
        (collada) => {
          if (!collada) return reject(new Error(`Invalid COLLADA file ${url}`));
          // ColladaLoader rotates Z_UP assets into three's Y-up; undo that for the Z-up scene,
          // which also turns Y_UP assets upright.
          if (options.ignoreColladaUpAxis) {
            collada.scene.rotation.set(0, 0, 0);
            resolve(collada.scene);
          } else resolve(zUp(collada.scene));
        },
        undefined,
        reject
      );
    else reject(new Error(`Unsupported mesh format .${extension} (${url})`));
  });
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

/** Readable reason for a failed mesh request, with a hint when MITI's server lacks the file. */
export function meshErrorMessage(uri: string, error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/asset timeout/i.test(text))
    return `${uri}: no reply from foxglove_bridge. The connection is likely saturated by other topics (raw camera images); hide them or publish compressed images, then reload.`;
  if (uri.startsWith('package://') && /404/.test(text))
    return `${uri} not found on the MITI server. Connect to a foxglove_bridge that serves assets, run MITI on the robot with the ROS workspace sourced, or set a mesh server URL.`;
  return `${uri}: ${text}`;
}

export interface ResourceSources extends ResourceOptions {
  /** Reads package:// and file:// resources through foxglove_bridge, when it serves assets. */
  fetchAsset?: (uri: string) => Promise<Uint8Array<ArrayBuffer>>;
}

/**
 * Load a mesh referenced by a URDF or marker, from (in order) an explicit mesh server or package
 * mapping, foxglove_bridge's asset service, or MITI's own server.
 */
export async function loadMeshResource(
  uri: string,
  sources: ResourceSources,
  options: MeshLoadOptions
): Promise<THREE.Object3D> {
  const pkg = uri.match(/^package:\/\/([^/]+)\//)?.[1];
  const explicit = !!sources.meshBaseUrl || (pkg !== undefined && !!sources.packageMapping?.[pkg]);
  const robotResource = uri.startsWith('package://') || uri.startsWith('file://');
  if (robotResource && !explicit && sources.fetchAsset) {
    const url = URL.createObjectURL(new Blob([await sources.fetchAsset(uri)]));
    try {
      return await loadMesh(url, { ...options, format: extensionOf(uri) });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return loadMesh(resolveResourceUrl(uri, sources), options);
}
