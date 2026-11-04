import { CdrReader, CdrWriter, toBigInt } from './cdr';
import type { DefaultValue, MessageDefinition, MessageField } from './msg-definition';

/**
 * Reads and writes whole ROS 2 messages as CDR, following parsed definitions
 * (`parseMessageDefinition`). Each definition becomes a list of field readers and writers once, so
 * a message costs one call per field.
 *
 * Decoded messages are plain objects with the fields in definition order and without constants:
 * - `bool` is a boolean, `int64` and `uint64` are bigints, other numbers are numbers;
 * - `string` and `wstring` are strings; `time` and `duration` are `{ sec, nanosec }`;
 * - arrays of numbers are typed arrays (`uint8[]` a view of the received bytes), arrays of
 *   booleans, strings, times and messages are arrays.
 *
 * Writing accepts the same, plain arrays for typed arrays and numbers for bigints. A field that is
 * missing or of the wrong kind gets its default, or zero, `false` or `''`.
 */

type Read = (reader: CdrReader) => unknown;
type Write = (writer: CdrWriter, value: unknown) => void;
type Items = ArrayLike<unknown>;
type Fields = Record<string, unknown>;

const readTime = (reader: CdrReader) => ({ sec: reader.int32(), nanosec: reader.uint32() });

const READ: Record<string, Read> = {
  bool: (r) => r.bool(),
  int8: (r) => r.int8(),
  uint8: (r) => r.uint8(),
  int16: (r) => r.int16(),
  uint16: (r) => r.uint16(),
  int32: (r) => r.int32(),
  uint32: (r) => r.uint32(),
  int64: (r) => r.int64(),
  uint64: (r) => r.uint64(),
  float32: (r) => r.float32(),
  float64: (r) => r.float64(),
  string: (r) => r.string(),
  wstring: (r) => r.wstring(),
  time: readTime,
  duration: readTime,
};

function readEach<T>(read: (reader: CdrReader) => T) {
  return (reader: CdrReader, count: number): T[] => {
    const items: T[] = [];
    for (let i = 0; i < count; i++) items.push(read(reader));
    return items;
  };
}

const READ_ARRAY: Record<string, (reader: CdrReader, count: number) => unknown> = {
  bool: (r, n) => r.boolArray(n),
  int8: (r, n) => r.int8Array(n),
  uint8: (r, n) => r.uint8Array(n),
  int16: (r, n) => r.int16Array(n),
  uint16: (r, n) => r.uint16Array(n),
  int32: (r, n) => r.int32Array(n),
  uint32: (r, n) => r.uint32Array(n),
  int64: (r, n) => r.int64Array(n),
  uint64: (r, n) => r.uint64Array(n),
  float32: (r, n) => r.float32Array(n),
  float64: (r, n) => r.float64Array(n),
  string: (r, n) => r.stringArray(n),
  wstring: readEach((r) => r.wstring()),
  time: readEach(readTime),
  duration: readEach(readTime),
};

const number = (value: unknown, fallback: DefaultValue | undefined) =>
  typeof value === 'number' ? value : typeof fallback === 'number' ? fallback : 0;
const bigint = (value: unknown, fallback: DefaultValue | undefined) =>
  toBigInt(typeof value === 'bigint' || typeof value === 'number' ? value : (fallback ?? 0));

function writeTime(writer: CdrWriter, value: unknown): void {
  const time = (value ?? {}) as { sec?: number; nanosec?: number; nsec?: number };
  writer.int32(time.sec ?? 0);
  writer.uint32(time.nanosec ?? time.nsec ?? 0);
}

type ScalarWrite = (writer: CdrWriter, value: unknown, fallback?: DefaultValue) => void;

const WRITE: Record<string, ScalarWrite> = {
  bool: (w, v, d) => w.bool(typeof v === 'boolean' ? v : d === true),
  int8: (w, v, d) => w.int8(number(v, d)),
  uint8: (w, v, d) => w.uint8(number(v, d)),
  int16: (w, v, d) => w.int16(number(v, d)),
  uint16: (w, v, d) => w.uint16(number(v, d)),
  int32: (w, v, d) => w.int32(number(v, d)),
  uint32: (w, v, d) => w.uint32(number(v, d)),
  int64: (w, v, d) => w.int64(bigint(v, d)),
  uint64: (w, v, d) => w.uint64(bigint(v, d)),
  float32: (w, v, d) => w.float32(number(v, d)),
  float64: (w, v, d) => w.float64(number(v, d)),
  string: (w, v, d) => w.string(typeof v === 'string' ? v : typeof d === 'string' ? d : ''),
  wstring: (w, v, d) => w.wstring(typeof v === 'string' ? v : typeof d === 'string' ? d : ''),
  time: writeTime,
  duration: writeTime,
};

function writeEach(write: (writer: CdrWriter, value: unknown) => void) {
  return (writer: CdrWriter, items: Items) => {
    for (let i = 0; i < items.length; i++) write(writer, items[i]);
  };
}

const writeString = (w: CdrWriter, v: unknown) => w.string(typeof v === 'string' ? v : '');
const writeWstring = (w: CdrWriter, v: unknown) => w.wstring(typeof v === 'string' ? v : '');

const WRITE_ARRAY: Record<string, (writer: CdrWriter, items: Items) => void> = {
  bool: (w, i) => w.boolArray(i),
  int8: (w, i) => w.byteArray(i),
  uint8: (w, i) => w.byteArray(i),
  int16: (w, i) => w.int16Array(i),
  uint16: (w, i) => w.uint16Array(i),
  int32: (w, i) => w.int32Array(i),
  uint32: (w, i) => w.uint32Array(i),
  int64: (w, i) => w.int64Array(i),
  uint64: (w, i) => w.uint64Array(i),
  float32: (w, i) => w.float32Array(i),
  float64: (w, i) => w.float64Array(i),
  string: writeEach(writeString),
  wstring: writeEach(writeWstring),
  time: writeEach(writeTime),
  duration: writeEach(writeTime),
};

/** The value a missing array item gets. */
function zero(type: string): unknown {
  if (type === 'bool') return false;
  if (type === 'int64' || type === 'uint64') return BigInt(0);
  if (type === 'string' || type === 'wstring') return '';
  if (type === 'time' || type === 'duration') return undefined;
  return 0;
}

const isItems = (value: unknown): value is Items =>
  Array.isArray(value) || (ArrayBuffer.isView(value) && 'length' in value);

/** Builds, once per type, what reading or writing each of its fields takes. */
function compile<T>(
  definitions: MessageDefinition[],
  build: (definition: MessageDefinition, field: (type: string) => T) => T
): T {
  if (!definitions.length) throw new Error('No message definition');
  const byName = new Map(definitions.map((definition) => [definition.name, definition]));
  const built = new Map<MessageDefinition, T>();
  const of = (definition: MessageDefinition): T => {
    const done = built.get(definition);
    if (done) return done;
    // A type that contains itself (through an array) refers to itself before it is built.
    let real: T | undefined;
    const ahead = ((...args: unknown[]) => (real as (...args: unknown[]) => unknown)(...args)) as T;
    built.set(definition, ahead);
    real = build(definition, (type) => {
      const nested = byName.get(type);
      if (!nested) throw new Error(`No definition for type ${type}`);
      return of(nested);
    });
    built.set(definition, real);
    return real;
  };
  return of(definitions[0]);
}

function fieldReader(field: MessageField, nested: (type: string) => Read): Read {
  const fixed = field.arrayLength;
  if (field.isComplex) {
    const read = nested(field.type);
    if (!field.isArray) return read;
    return (reader) => {
      const count = fixed ?? reader.sequenceLength();
      const items: unknown[] = [];
      for (let i = 0; i < count; i++) items.push(read(reader));
      return items;
    };
  }
  if (!field.isArray) return READ[field.type];
  const readArray = READ_ARRAY[field.type];
  return fixed === undefined
    ? (reader) => readArray(reader, reader.sequenceLength())
    : (reader) => readArray(reader, fixed);
}

/** A reader of the first definition's messages (the others are the types it uses). */
export function compileReader(definitions: MessageDefinition[]): (data: ArrayBufferView) => Fields {
  const root = compile<Read>(definitions, (definition, nested) => {
    // An empty message is one byte on the wire, as rosidl adds a member to it.
    if (!definition.fields.length)
      return (reader) => {
        reader.uint8();
        return {};
      };
    const names = definition.fields.map((field) => field.name);
    const reads = definition.fields.map((field) => fieldReader(field, nested));
    return (reader) => {
      const message: Fields = {};
      for (let i = 0; i < reads.length; i++) message[names[i]] = reads[i](reader);
      return message;
    };
  });
  return (data) => root(new CdrReader(data)) as Fields;
}

function checkLength(field: MessageField, count: number): void {
  if (field.arrayLength !== undefined && count !== field.arrayLength)
    throw new Error(
      `Expected ${field.arrayLength} items for fixed-length array field ${field.name} but received ${count}`
    );
  if (field.arrayUpperBound !== undefined && count > field.arrayUpperBound)
    throw new Error(
      `${field.name} has ${count} items, more than its bound of ${field.arrayUpperBound}`
    );
}

function fieldWriter(field: MessageField, nested: (type: string) => Write): Write {
  const fixed = field.arrayLength;
  if (field.isComplex) {
    const write = nested(field.type);
    if (!field.isArray) return write;
    return (writer, value) => {
      const items = isItems(value) ? value : [];
      if (isItems(value)) checkLength(field, value.length);
      const count = fixed ?? items.length;
      if (fixed === undefined) writer.sequenceLength(count);
      for (let i = 0; i < count; i++) write(writer, items[i]);
    };
  }
  if (!field.isArray) {
    const write = WRITE[field.type];
    const fallback = field.defaultValue;
    const bound = field.upperBound;
    if (bound === undefined) return (writer, value) => write(writer, value, fallback);
    return (writer, value) => {
      if (typeof value === 'string' && value.length > bound)
        throw new Error(`${field.name} is longer than its bound of ${bound} characters`);
      write(writer, value, fallback);
    };
  }
  const writeArray = WRITE_ARRAY[field.type];
  const fallback = Array.isArray(field.defaultValue)
    ? field.defaultValue
    : new Array<unknown>(fixed ?? 0).fill(zero(field.type));
  return (writer, value) => {
    const items = isItems(value) ? value : fallback;
    checkLength(field, items.length);
    if (fixed === undefined) writer.sequenceLength(items.length);
    writeArray(writer, items);
  };
}

/** A writer of the first definition's messages, to little-endian CDR. */
export function compileWriter(definitions: MessageDefinition[]): (message: unknown) => Uint8Array {
  const root = compile<Write>(definitions, (definition, nested) => {
    if (!definition.fields.length) return (writer) => writer.uint8(0);
    const names = definition.fields.map((field) => field.name);
    const writes = definition.fields.map((field) => fieldWriter(field, nested));
    return (writer, value) => {
      const message = (value !== null && typeof value === 'object' ? value : {}) as Fields;
      for (let i = 0; i < writes.length; i++) writes[i](writer, message[names[i]]);
    };
  });
  // Messages of a type are often alike: start each with room for the one before.
  let capacity = 256;
  return (message) => {
    const writer = new CdrWriter({ capacity });
    root(writer, message);
    capacity = writer.offset;
    return writer.data;
  };
}
