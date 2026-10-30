/**
 * Work done for a message off the main thread, when it was decoded in a worker (see
 * `lib/bridge/decode-worker.ts`), kept beside the decoded message so the parsers can skip it.
 */
export interface PointScan {
  /** Every `stride`-th point was read. */
  stride: number;
  count: number;
  /** x, y, z per point read, with non-finite points left out. */
  positions: Float32Array<ArrayBuffer>;
  /** Byte offset of each point read in the message's data. */
  offsets: Uint32Array<ArrayBuffer>;
}

export interface PreparedMessage {
  /** A sensor_msgs/Image as RGBA, as `decodeImagePixels` returns it. */
  pixels?: Uint8ClampedArray<ArrayBuffer>;
  /** A sensor_msgs/PointCloud2's points, as `readPointCloud` reads them. */
  cloud?: PointScan;
}

const prepared = new WeakMap<object, PreparedMessage>();

export function attachPrepared(message: unknown, data: PreparedMessage): void {
  if (message && typeof message === 'object') prepared.set(message, data);
}

export function getPrepared(message: unknown): PreparedMessage | undefined {
  return message && typeof message === 'object' ? prepared.get(message) : undefined;
}
