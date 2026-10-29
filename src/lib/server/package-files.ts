import { promises as fs } from 'fs';
import path from 'path';

/**
 * Locates ROS package resources on the machine running MITI's server, using the same
 * environment a sourced ROS workspace provides (AMENT_PREFIX_PATH / ROS_PACKAGE_PATH).
 * MITI_PACKAGE_PATH adds directories for servers started without a sourced shell (systemd).
 */
type Env = Record<string, string | undefined>;

const CONTENT_TYPES: Record<string, string> = {
  stl: 'model/stl',
  dae: 'model/vnd.collada+xml',
  obj: 'model/obj',
  mtl: 'text/plain',
  urdf: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tga: 'image/x-tga',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

const PACKAGE_NAME = /^[A-Za-z0-9_.-]+$/;

const split = (value: string | undefined) => (value ?? '').split(path.delimiter).filter(Boolean);

/** Only meshes, textures and URDFs are served; anything else in a package stays private. */
export function contentTypeFor(file: string): string | null {
  return CONTENT_TYPES[path.extname(file).slice(1).toLowerCase()] ?? null;
}

/** Directories that may be `pkg`'s root, in lookup order. */
export function packageDirCandidates(pkg: string, env: Env = process.env): string[] {
  return [
    // A package directory, a merged install (share/<pkg>) or colcon's isolated install
    // (<pkg>/share/<pkg>), so MITI_PACKAGE_PATH can simply name a workspace's install/ folder.
    ...split(env.MITI_PACKAGE_PATH).flatMap((dir) => [
      path.join(dir, pkg),
      path.join(dir, 'share', pkg),
      path.join(dir, pkg, 'share', pkg),
    ]),
    ...split(env.AMENT_PREFIX_PATH).map((prefix) => path.join(prefix, 'share', pkg)),
    ...split(env.ROS_PACKAGE_PATH).map((dir) =>
      path.basename(dir) === pkg ? dir : path.join(dir, pkg)
    ),
  ];
}

/** Directories whose files may be served through `file://` URIs. */
export function searchRoots(env: Env = process.env): string[] {
  return [
    ...split(env.MITI_PACKAGE_PATH),
    ...split(env.AMENT_PREFIX_PATH).map((prefix) => path.join(prefix, 'share')),
    ...split(env.ROS_PACKAGE_PATH),
  ];
}

export const hasSearchPaths = (env: Env = process.env) => searchRoots(env).length > 0;

// Containment is checked on the normalised path, not the real path: colcon --symlink-install
// links share/ into src/, and those links are part of the workspace.
function isInside(dir: string, target: string): boolean {
  const relative = path.relative(dir, target);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function isFile(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

export async function findPackageFile(
  pkg: string,
  relativePath: string,
  env: Env = process.env
): Promise<string | null> {
  if (!PACKAGE_NAME.test(pkg) || !contentTypeFor(relativePath)) return null;
  for (const dir of packageDirCandidates(pkg, env)) {
    const target = path.resolve(dir, relativePath);
    if (!isInside(dir, target)) return null;
    if (await isFile(target)) return target;
  }
  return null;
}

export async function findAllowedFile(
  absolutePath: string,
  env: Env = process.env
): Promise<string | null> {
  if (!path.isAbsolute(absolutePath) || !contentTypeFor(absolutePath)) return null;
  const target = path.resolve(absolutePath);
  if (!searchRoots(env).some((root) => isInside(path.resolve(root), target))) return null;
  return (await isFile(target)) ? target : null;
}
