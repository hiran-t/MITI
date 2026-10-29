/**
 * Resolves mesh and URDF resource URIs (package://, file://, http) to URLs a browser can fetch.
 *
 * Robot resources normally come through foxglove_bridge's asset service (see loadMeshResource).
 * Without it, `package://` resources are served by MITI's own server (`/api/package/...`) from
 * the ROS workspace of the machine it runs on. A mesh server URL or per-package mapping
 * overrides both.
 */
export interface ResourceOptions {
  /** URL of a server whose root is a package directory; used for every unmapped package. */
  meshBaseUrl?: string;
  /** Package name → URL of that package's directory. */
  packageMapping?: Record<string, string>;
}

const join = (base: string, path: string) =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

export function packageApiUrl(pkg: string, path: string): string {
  return `/api/package/${encodeURIComponent(pkg)}/${path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')}`;
}

export function resolveResourceUrl(uri: string, options: ResourceOptions = {}): string {
  const trimmed = uri.trim();
  const pkgMatch = trimmed.match(/^package:\/\/([^/]+)\/(.+)$/);
  if (pkgMatch) {
    const [, pkg, path] = pkgMatch;
    const mapped = options.packageMapping?.[pkg];
    if (mapped) return join(mapped, path);
    if (options.meshBaseUrl) return join(options.meshBaseUrl, path);
    return packageApiUrl(pkg, path);
  }
  if (trimmed.startsWith('file://'))
    return `/api/file?path=${encodeURIComponent(decodeURIComponent(trimmed.slice('file://'.length)))}`;
  return trimmed;
}

/**
 * Base for relative mesh paths in a URDF loaded from `location` (URL, package:// or an absolute
 * file path), e.g. Unitree URDFs reference `meshes/pelvis.STL` next to the URDF.
 */
export function resourceBase(location: string): string {
  const directory = location.trim().replace(/[^/]*$/, '');
  return directory.startsWith('/') ? `file://${directory}` : directory;
}
