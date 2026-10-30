import { createDecoder, type Decoder } from './codec';
import { normalizeMessageType } from './topics';
import { decodeImagePixels } from '@/lib/parsers/image-parser';
import { scanPointCloud } from '@/lib/parsers/pointcloud-parser';
import type { PreparedMessage } from '@/lib/parsers/prepared';
import type { sensor_msgs } from '@/types/ros-messages';

/** What a decoder needs to know about a channel, sent with its first message to each worker. */
export interface ChannelSpec {
  encoding: string;
  schemaEncoding?: string;
  schema: string;
  schemaName: string;
}

export interface DecodeRequest {
  id: number;
  /** Identifies the channel across requests; `channel` is sent only until the worker knows it. */
  key: number;
  channel?: ChannelSpec;
  buffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
}

export type DecodeReply =
  | { id: number; message: unknown; prepared?: PreparedMessage }
  | { id: number; error: string };

/** Points read ahead of time per cloud; SceneLayer never asks for more. */
const MAX_PREPARED_POINTS = 1000000;
const IMAGE = normalizeMessageType('sensor_msgs/Image');
const POINT_CLOUD = normalizeMessageType('sensor_msgs/PointCloud2');

/**
 * Work the main thread would otherwise do for every heavy message: raw images to RGBA, point
 * clouds to positions. Anything that cannot be prepared is left to the main thread, which then
 * reports the problem as it always has.
 */
export function prepareMessage(
  schemaName: string,
  message: unknown
): { prepared?: PreparedMessage; transfer: ArrayBuffer[] } {
  try {
    const type = normalizeMessageType(schemaName);
    if (type === IMAGE) {
      const pixels = decodeImagePixels(message as sensor_msgs.Image);
      return { prepared: { pixels }, transfer: [pixels.buffer] };
    }
    if (type === POINT_CLOUD) {
      const cloud = scanPointCloud(message as sensor_msgs.PointCloud2, MAX_PREPARED_POINTS);
      return { prepared: { cloud }, transfer: [cloud.positions.buffer, cloud.offsets.buffer] };
    }
  } catch {
    /* The main thread reads the message itself and reports why it cannot. */
  }
  return { transfer: [] };
}

/** Buffers a decoded message's typed arrays view, so they can move back instead of being copied. */
function messageBuffers(value: unknown, found: Set<ArrayBuffer>, depth = 0): Set<ArrayBuffer> {
  if (!value || typeof value !== 'object' || depth > 8) return found;
  if (ArrayBuffer.isView(value)) {
    if (value.buffer instanceof ArrayBuffer) found.add(value.buffer);
  } else if (Array.isArray(value)) {
    // Arrays of numbers or strings hold no buffers; arrays of messages (e.g. fields) may.
    if (value.length && typeof value[0] === 'object')
      value.forEach((item) => messageBuffers(item, found, depth + 1));
  } else Object.values(value).forEach((item) => messageBuffers(item, found, depth + 1));
  return found;
}

/** Decodes messages for the channels it is told about; the worker's whole job. */
export function createDecodeHandler() {
  const decoders = new Map<number, { decode: Decoder; schemaName: string }>();
  return (request: DecodeRequest): { reply: DecodeReply; transfer: ArrayBuffer[] } => {
    try {
      if (request.channel) {
        const { encoding, schemaEncoding, schema, schemaName } = request.channel;
        decoders.set(request.key, {
          decode: createDecoder(encoding, schemaEncoding, schema),
          schemaName,
        });
      }
      const channel = decoders.get(request.key);
      if (!channel) throw new Error('Unknown channel');
      const data = new Uint8Array(request.buffer, request.byteOffset, request.byteLength);
      const message = channel.decode(data);
      const { prepared, transfer } = prepareMessage(channel.schemaName, message);
      const buffers = messageBuffers(message, new Set(transfer));
      return { reply: { id: request.id, message, prepared }, transfer: Array.from(buffers) };
    } catch (error) {
      return {
        reply: { id: request.id, error: error instanceof Error ? error.message : String(error) },
        transfer: [],
      };
    }
  };
}
