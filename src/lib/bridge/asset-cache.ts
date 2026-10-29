/**
 * Persists robot assets (meshes, URDFs) fetched from foxglove_bridge in the browser's Cache
 * Storage, so a robot only has to cross a slow link once. Unavailable outside secure contexts
 * (e.g. MITI opened over plain http from another host); then every call is a no-op.
 */
const CACHE_NAME = 'miti-robot-assets-v1';

const cacheKey = (bridgeUrl: string, uri: string) =>
  `https://miti.cache/${encodeURIComponent(bridgeUrl)}/${encodeURIComponent(uri)}`;

const storage = () => (typeof caches === 'undefined' ? null : caches);

export async function readCachedAsset(
  bridgeUrl: string,
  uri: string
): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const cache = await storage()?.open(CACHE_NAME);
    const response = await cache?.match(cacheKey(bridgeUrl, uri));
    return response ? new Uint8Array(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function writeCachedAsset(
  bridgeUrl: string,
  uri: string,
  bytes: Uint8Array<ArrayBuffer>
): Promise<void> {
  try {
    const cache = await storage()?.open(CACHE_NAME);
    await cache?.put(cacheKey(bridgeUrl, uri), new Response(bytes));
  } catch {
    /* Caching is an optimisation; quota or privacy settings may refuse it. */
  }
}

export async function clearCachedAssets(): Promise<void> {
  try {
    await storage()?.delete(CACHE_NAME);
  } catch {
    /* Nothing to clear. */
  }
}
