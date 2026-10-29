import { parse } from '@foxglove/rosmsg';
import { MessageReader, MessageWriter } from '@foxglove/rosmsg2-serialization';

const textDecoder = new TextDecoder();

export type Decoder = (data: ArrayBufferView) => unknown;
export type Encoder = (message: unknown) => Uint8Array;

/** `std_msgs/Bool` → `std_msgs/msg/Bool`; ROS 2 publishers need the full type name. */
export function ros2TypeName(type: string): string {
  const parts = type.split('/');
  return parts.length === 2 ? `${parts[0]}/msg/${parts[1]}` : type;
}

/** A decoder for one channel's messages; throws when the channel's encoding is unsupported. */
export function createDecoder(
  encoding: string,
  schemaEncoding: string | undefined,
  schema: string
): Decoder {
  if (encoding === 'json') return (data) => JSON.parse(textDecoder.decode(data));
  if (encoding === 'cdr' && (schemaEncoding ?? 'ros2msg') === 'ros2msg') {
    const reader = new MessageReader(parse(schema, { ros2: true }));
    return (data) => reader.readMessage(data);
  }
  throw new Error(`Unsupported message encoding ${encoding} (${schemaEncoding ?? 'no schema'})`);
}

export function createEncoder(schema: string): Encoder {
  const writer = new MessageWriter(parse(schema, { ros2: true }));
  return (message) => writer.writeMessage(message);
}
