/**
 * Resolves ROS package:// paths to HTTP URLs
 */

/**
 * Resolves a package:// path to an HTTP URL
 *
 * @param meshPath - The path to resolve (e.g., "package://robot_description/meshes/base.stl")
 * @param baseUrl - The base URL to use for resolution (e.g., "http://192.168.10.27:8000")
 * @param packageMapping - Optional mapping of package names to specific URLs
 * @returns The resolved HTTP URL
 *
 * @example
 * // Basic resolution
 * resolvePackagePath(
 *   "package://robot_description/meshes/base.stl",
 *   "http://192.168.10.27:8000"
 * )
 * // Returns: "http://192.168.10.27:8000/meshes/base.stl"
 *
 * @example
 * // With package mapping
 * resolvePackagePath(
 *   "package://my_robot/models/arm.dae",
 *   "http://192.168.10.27:8000",
 *   { "my_robot": "http://192.168.10.27:8001" }
 * )
 * // Returns: "http://192.168.10.27:8001/models/arm.dae"
 */
export function resolvePackagePath(
  meshPath: string,
  baseUrl: string,
  packageMapping?: Record<string, string>
): string {
  // If it's not a package:// path, return as-is
  if (!meshPath.startsWith('package://')) {
    // If it's already an absolute URL, return as-is
    if (meshPath.startsWith('http://') || meshPath.startsWith('https://')) {
      return meshPath;
    }
    // If it's a relative path, resolve against base URL
    return resolveRelativePath(meshPath, baseUrl);
  }

  // Parse package:// URL
  // Format: package://package_name/path/to/file
  const withoutProtocol = meshPath.substring('package://'.length);
  const firstSlashIndex = withoutProtocol.indexOf('/');

  if (firstSlashIndex === -1) {
    console.warn(`Invalid package path format: ${meshPath}`);
    return meshPath;
  }

  const packageName = withoutProtocol.substring(0, firstSlashIndex);
  const pathInPackage = withoutProtocol.substring(firstSlashIndex + 1);

  // Check if there's a specific mapping for this package
  if (packageMapping && packageMapping[packageName]) {
    const packageUrl = ensureTrailingSlash(packageMapping[packageName]);
    return `${packageUrl}${pathInPackage}`;
  }

  // Use base URL
  const normalizedBaseUrl = ensureTrailingSlash(baseUrl);
  return `${normalizedBaseUrl}${pathInPackage}`;
}

/**
 * Resolves a relative path against a base URL
 */
function resolveRelativePath(path: string, baseUrl: string): string {
  // Remove leading slash if present
  const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  const normalizedBaseUrl = ensureTrailingSlash(baseUrl);
  return `${normalizedBaseUrl}${normalizedPath}`;
}

/**
 * Ensures a URL has a trailing slash
 */
function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Validates if a string is a valid HTTP/HTTPS URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks if a URL uses HTTPS
 */
export function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts package name from a package:// path
 */
export function extractPackageName(meshPath: string): string | null {
  if (!meshPath.startsWith('package://')) {
    return null;
  }

  const withoutProtocol = meshPath.substring('package://'.length);
  const firstSlashIndex = withoutProtocol.indexOf('/');

  if (firstSlashIndex === -1) {
    return null;
  }

  return withoutProtocol.substring(0, firstSlashIndex);
}
