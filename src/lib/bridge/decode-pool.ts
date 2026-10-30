import { attachPrepared } from '@/lib/parsers/prepared';
import type { ChannelSpec, DecodeReply, DecodeRequest } from './decode-core';
import { createDecodeWorker } from './decode-worker-factory';

/** Thrown for messages in flight when the workers stop working; the client decodes on. */
export class DecodePoolFailure extends Error {}

/** A few workers: enough for several cameras and a point cloud, leaving cores for rendering. */
const defaultSize = () =>
  Math.max(1, Math.min(3, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1));

/**
 * Decodes messages in Web Workers. The message bytes move to a worker and the decoded message,
 * with its typed arrays and anything prepared for it (see `PreparedMessage`), moves back; nothing
 * megabyte-sized is copied. Each channel always goes to the same worker, which keeps its decoder.
 */
export class DecodePool {
  private workers: { worker: Worker; channels: Set<number> }[] = [];
  private pending = new Map<
    number,
    { resolve: (m: unknown) => void; reject: (e: Error) => void }
  >();
  private channelKeys = new WeakMap<object, number>();
  private nextKey = 0;
  private nextId = 1;
  private failed = false;

  constructor(
    size = defaultSize(),
    createWorker: () => Worker = createDecodeWorker,
    private onFailure?: (error: Error) => void
  ) {
    for (let i = 0; i < size; i++) {
      const worker = createWorker();
      worker.onmessage = (event: MessageEvent<DecodeReply>) => this.handleReply(event.data);
      worker.onerror = (event) => this.fail(new Error(event.message || 'Decode worker failed'));
      worker.onmessageerror = () => this.fail(new Error('Decode worker sent an unreadable reply'));
      this.workers.push({ worker, channels: new Set() });
    }
  }

  /** A pool where the platform has workers (browsers), else null (Jest, server rendering). */
  static create(
    onFailure?: (error: Error) => void,
    createWorker?: () => Worker
  ): DecodePool | null {
    if (!createWorker && typeof Worker === 'undefined') return null;
    try {
      return new DecodePool(defaultSize(), createWorker, onFailure);
    } catch (error) {
      console.warn('Decoding on the main thread; cannot start a decode worker:', error);
      return null;
    }
  }

  get available(): boolean {
    return !this.failed;
  }

  /**
   * Decode one message of `channel` (identified by object identity: a re-advertised channel is a
   * new one). The bytes' buffer is handed to the worker and is unusable here afterwards.
   */
  decode(channel: ChannelSpec, data: ArrayBufferView): Promise<unknown> {
    if (this.failed) return Promise.reject(new DecodePoolFailure('Decode workers stopped'));
    let key = this.channelKeys.get(channel);
    if (key === undefined) {
      key = this.nextKey++;
      this.channelKeys.set(channel, key);
    }
    const slot = this.workers[key % this.workers.length];
    let { buffer, byteOffset, byteLength } = data;
    if (!(buffer instanceof ArrayBuffer)) {
      buffer = new Uint8Array(buffer, byteOffset, byteLength).slice().buffer;
      byteOffset = 0;
    }
    const id = this.nextId++;
    const request: DecodeRequest = { id, key, buffer, byteOffset, byteLength };
    if (!slot.channels.has(key)) {
      const { encoding, schemaEncoding, schema, schemaName } = channel;
      request.channel = { encoding, schemaEncoding, schema, schemaName };
      slot.channels.add(key);
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      slot.worker.postMessage(request, [buffer as ArrayBuffer]);
    });
  }

  dispose(): void {
    this.failed = true;
    this.workers.forEach(({ worker }) => worker.terminate());
    this.workers = [];
    this.rejectAll(new DecodePoolFailure('Decode workers stopped'));
  }

  private handleReply(reply: DecodeReply): void {
    const pending = this.pending.get(reply.id);
    if (!pending) return;
    this.pending.delete(reply.id);
    if ('error' in reply) {
      pending.reject(new Error(reply.error));
      return;
    }
    if (reply.prepared) attachPrepared(reply.message, reply.prepared);
    pending.resolve(reply.message);
  }

  private fail(error: Error): void {
    if (this.failed) return;
    this.dispose();
    this.onFailure?.(error);
  }

  private rejectAll(error: Error): void {
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
  }
}
