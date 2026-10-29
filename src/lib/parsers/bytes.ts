/**
 * `uint8[]` fields arrive as a Uint8Array from CDR (foxglove_bridge); base64 strings and number
 * arrays are still accepted. A plain loop is several times faster than `Uint8Array.from(atob(s),
 * mapFn)` on camera frames.
 */
export function decodeBytes(data: string | ArrayLike<number>): Uint8Array<ArrayBuffer> {
  if (data instanceof Uint8Array) return data as Uint8Array<ArrayBuffer>;
  if (typeof data !== 'string') return Uint8Array.from(data);
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
