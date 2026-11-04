import { compileReader, compileWriter } from './cdr-message';
import { parseMessageDefinition } from './msg-definition';

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
  if (encoding === 'cdr' && (schemaEncoding ?? 'ros2msg') === 'ros2msg')
    return compileReader(parseMessageDefinition(schema));
  throw new Error(`Unsupported message encoding ${encoding} (${schemaEncoding ?? 'no schema'})`);
}

/** An encoder of CDR messages, from a `ros2msg` schema. */
export function createEncoder(schema: string): Encoder {
  return compileWriter(parseMessageDefinition(schema));
}
