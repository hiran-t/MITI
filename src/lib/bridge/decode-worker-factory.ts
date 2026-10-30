/** A decode worker; webpack bundles decode.worker.ts into a chunk of its own. */
export function createDecodeWorker(): Worker {
  return new Worker(new URL('./decode.worker.ts', import.meta.url), { name: 'miti-decode' });
}
