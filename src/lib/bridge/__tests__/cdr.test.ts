/**
 * @jest-environment node
 */
import fixture from './fixtures/cdr-messages.json';
import { CdrReader, CdrWriter } from '../cdr';
import { compileReader, compileWriter } from '../cdr-message';
import { createDecoder, createEncoder } from '../codec';
import { parseMessageDefinition, type MessageDefinition } from '../msg-definition';

/**
 * fixtures/cdr-messages.json (scripts/cdr-fixtures/generate.js) holds what Foxglove's ROS libraries,
 * which MITI used before its own, made of sample messages, and the bytes ROS 2 itself serializes.
 */
interface Case {
  key: string;
  type: string;
  message?: unknown;
  cdr: string;
  decoded: unknown;
  ros?: Record<string, { cdr: string; decoded?: unknown }>;
}
const { types, cases } = fixture as unknown as {
  types: Record<string, { schema: string; definitions: unknown[] }>;
  cases: Case[];
};

const TYPED: Record<string, new (buffer: ArrayBuffer) => ArrayBufferView> = {
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  BigInt64Array,
  BigUint64Array,
  Float32Array,
  Float64Array,
};
const NUMBERS: Record<string, number> = {
  NaN: NaN,
  Infinity: Infinity,
  '-Infinity': -Infinity,
  '-0': -0,
};

/** The fixture's values with typed arrays, bigints and special numbers restored. */
function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (!value || typeof value !== 'object') return value;
  const tagged = value as Record<string, unknown>;
  if (typeof tagged.$bigint === 'string') return BigInt(tagged.$bigint);
  if (typeof tagged.$number === 'string') return NUMBERS[tagged.$number];
  if (typeof tagged.$typed === 'string') {
    const bytes = Uint8Array.from(Buffer.from(tagged.base64 as string, 'base64'));
    return new TYPED[tagged.$typed](bytes.buffer);
  }
  return Object.fromEntries(Object.entries(tagged).map(([k, v]) => [k, revive(v)]));
}

const fromHex = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));
const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/** The bytes at an odd offset of a larger buffer, as they arrive after a WebSocket frame header. */
function unaligned(bytes: Uint8Array): Uint8Array {
  const frame = new Uint8Array(bytes.length + 17).fill(0xee);
  frame.set(bytes, 13);
  return frame.subarray(13, 13 + bytes.length);
}

/** MITI's definitions in the shape the fixture records Foxglove's in. */
const asFixture = (definitions: MessageDefinition[]) =>
  definitions.map(({ name, fields, constants }) => ({
    ...(name !== undefined && { name }),
    fields: fields.map((field) => ({
      name: field.name,
      type: field.type,
      ...(field.isComplex && { isComplex: true }),
      ...(field.isArray && { isArray: true }),
      ...(field.arrayLength !== undefined && { arrayLength: field.arrayLength }),
      ...(field.arrayUpperBound !== undefined && { arrayUpperBound: field.arrayUpperBound }),
      ...(field.upperBound !== undefined && { upperBound: field.upperBound }),
      ...(field.defaultValue !== undefined && { defaultValue: field.defaultValue }),
    })),
    constants,
  }));

describe('MITI reads definitions as Foxglove did', () => {
  test.each(Object.keys(types))('%s', (type) => {
    const { schema, definitions } = types[type];
    expect(asFixture(parseMessageDefinition(schema))).toStrictEqual(revive(definitions));
  });
});

describe('MITI decodes and encodes CDR as Foxglove did', () => {
  test.each(cases.map((c) => [c.key, c] as const))('%s', (_, c) => {
    const { schema } = types[c.type];
    const decode = createDecoder('cdr', 'ros2msg', schema);
    const expected = revive(c.decoded);
    expect(decode(fromHex(c.cdr))).toStrictEqual(expected);
    expect(decode(unaligned(fromHex(c.cdr)))).toStrictEqual(expected);
    if (c.message === undefined) return;
    const encode = createEncoder(schema);
    expect(toHex(encode(revive(c.message)))).toBe(c.cdr);
    // What MITI decodes encodes back to the same bytes.
    expect(toHex(encode(decode(fromHex(c.cdr))))).toBe(c.cdr);
  });
});

describe('MITI decodes the bytes ROS 2 serializes', () => {
  const fromRos = cases.flatMap((c) =>
    Object.entries(c.ros ?? {}).map(([rmw, ros]) => [`${c.key} (${rmw})`, c, ros] as const)
  );
  test.each(fromRos)('%s', (_, c, ros) => {
    const decode = createDecoder('cdr', 'ros2msg', types[c.type].schema);
    expect(decode(unaligned(fromHex(ros.cdr)))).toStrictEqual(revive(ros.decoded ?? c.decoded));
    // ROS 2 writes the same bytes; Fast DDS only pads the end with zeros.
    expect(ros.cdr.startsWith(c.cdr)).toBe(true);
    expect(ros.cdr.slice(c.cdr.length)).toMatch(/^(00)*$/);
  });
});

describe('wstring', () => {
  const schema = 'wstring text\nwstring[] list\nwstring<=4 short\nuint8 after';
  const message = { text: 'aé😀', list: ['', 'ข'], short: 'abcd', after: 7 };
  // Each UTF-16 code unit is a uint32, after the count of code units (rosidl_typesupport_fastrtps).
  const bytes = [
    '00010000',
    '04000000',
    '61000000e9000000',
    '3dd8000000de0000',
    '02000000',
    '00000000',
    '01000000020e0000',
    '04000000',
    '61000000620000006300000064000000',
    '07',
  ].join('');

  test('is written as ROS 2 writes it and read back', () => {
    const encoded = createEncoder(schema)(message);
    expect(toHex(encoded)).toBe(bytes);
    expect(createDecoder('cdr', 'ros2msg', schema)(encoded)).toStrictEqual(message);
  });

  test('is read big-endian', () => {
    const big = new CdrWriter({ bigEndian: true });
    big.wstring('aé');
    expect(toHex(big.data)).toBe('00000000' + '00000002' + '00000061' + '000000e9');
    expect(new CdrReader(big.data).wstring()).toBe('aé');
  });

  test('over its bound is refused', () => {
    expect(() => createEncoder(schema)({ ...message, short: 'abcde' })).toThrow(/bound/);
  });
});

describe('byte order and encapsulation', () => {
  const schema = 'int16 a\nfloat64 b\nfloat32[] c\nuint64 d\nstring e';
  const message = { a: -2, b: 0.5, c: new Float32Array([1, 2, 3]), d: BigInt(9), e: 'é' };

  test('big-endian CDR written by MITI reads back', () => {
    const writer = new CdrWriter({ bigEndian: true });
    writer.int16(-2);
    writer.float64(0.5);
    writer.sequenceLength(3);
    writer.float32Array([1, 2, 3]);
    writer.uint64(BigInt(9));
    writer.string('é');
    expect(writer.data[1]).toBe(0x00);
    expect(createDecoder('cdr', 'ros2msg', schema)(writer.data)).toStrictEqual(message);
  });

  test('parameter-list and delimited CDR are refused, not misread', () => {
    const data = createEncoder(schema)(message);
    for (const kind of [0x02, 0x03, 0x08, 0x09, 0x0a, 0x0b]) {
      data[1] = kind;
      expect(() => createDecoder('cdr', 'ros2msg', schema)(data)).toThrow(/encapsulation/);
    }
  });

  test('data shorter than its header is refused', () => {
    expect(() => new CdrReader(new Uint8Array([0, 1]))).toThrow(/header/);
  });
});

describe('malformed data stops at the end of the message', () => {
  const decode = createDecoder('cdr', 'ros2msg', 'string a\nuint8[] b\nfloat64[] c');
  // A message inside a larger buffer: reading must not run into the bytes after it.
  const inFrame = (hex: string) => {
    const bytes = fromHex(hex);
    const frame = new Uint8Array(bytes.length + 64).fill(0x41);
    frame.set(bytes);
    return frame.subarray(0, bytes.length);
  };

  test.each([
    ['a string longer than the data', '00010000' + '20000000' + '4141'],
    ['bytes longer than the data', '00010000' + '01000000' + '00000000' + '10000000' + '01'],
    [
      'numbers longer than the data',
      '00010000' + '01000000' + '00000000' + '00000000' + '05000000',
    ],
  ])('%s', (_, hex) => {
    expect(() => decode(inFrame(hex))).toThrow(RangeError);
  });
});

describe('writing', () => {
  const schema = [
    'int32[3] fixed',
    'int32[<=2] bounded',
    'float64[] unbounded [1.5, 2.5]',
    'Point p',
    'Point[] ps',
    '=====',
    'MSG: geometry_msgs/Point',
    'float64 x',
    'float64 y 2',
  ].join('\n');
  const encode = createEncoder(schema);
  const decode = createDecoder('cdr', 'ros2msg', schema);

  test('fills left-out fields with their defaults', () => {
    expect(decode(encode({}))).toStrictEqual({
      fixed: new Int32Array(3),
      bounded: new Int32Array(0),
      unbounded: new Float64Array([1.5, 2.5]),
      p: { x: 0, y: 2 },
      ps: [],
    });
  });

  test('accepts plain arrays, numbers for bigints, and other typed arrays', () => {
    const writeLongs = compileWriter(parseMessageDefinition('int64[] a\nuint8[] b\nfloat32[] c'));
    const readLongs = compileReader(parseMessageDefinition('int64[] a\nuint8[] b\nfloat32[] c'));
    expect(
      readLongs(writeLongs({ a: [1, -2.7], b: [1, 256, -1], c: new Float64Array([0.5]) }))
    ).toStrictEqual({
      a: new BigInt64Array([BigInt(1), BigInt(-2)]),
      b: new Uint8Array([1, 0, 255]),
      c: new Float32Array([0.5]),
    });
  });

  test('refuses arrays of the wrong length', () => {
    expect(() => encode({ fixed: [1, 2] })).toThrow(/Expected 3 items/);
    expect(() => encode({ bounded: [1, 2, 3] })).toThrow(/bound of 2/);
  });
});

describe('definitions', () => {
  test('types are found with or without /msg/ and their package', () => {
    const [root, point] = parseMessageDefinition(
      'geometry_msgs/msg/Point a\nPoint b\r\n===\r\nMSG: geometry_msgs/msg/Point\r\nfloat64 x\r\n'
    );
    expect(root.fields.map((field) => field.type)).toEqual([
      'geometry_msgs/Point',
      'geometry_msgs/Point',
    ]);
    expect(point.name).toBe('geometry_msgs/Point');
  });

  test('a missing type, a bad line and a bad value are reported', () => {
    expect(() => parseMessageDefinition('Missing m')).toThrow(/No definition for type Missing/);
    expect(() => parseMessageDefinition('int32')).toThrow(/'int32'.*no name/);
    expect(() => parseMessageDefinition('uint8 X=256')).toThrow(/Invalid uint8 value: 256/);
    expect(() => parseMessageDefinition('int32<=3 x')).toThrow(/bound/);
  });

  test('constants, defaults and comments', () => {
    const [root] = parseMessageDefinition(
      [
        'float64 INF=inf',
        "string S='it\\'s' # not part of it",
        'string U = plain text # comment',
        'float32[] f [nan, -inf]',
        'string[] s []',
      ].join('\n')
    );
    expect(root.constants.map((c) => c.value)).toEqual([Infinity, "it's", 'plain text']);
    expect(root.fields.map((f) => f.defaultValue)).toEqual([[NaN, -Infinity], []]);
  });

  test('an empty message is one byte, as rosidl adds a member to it', () => {
    const empty = 'Empty e\nuint8 after\n===\nMSG: std_msgs/Empty\n# nothing';
    const bytes = createEncoder(empty)({ after: 3 });
    expect(toHex(bytes)).toBe('00010000' + '00' + '03');
    expect(createDecoder('cdr', 'ros2msg', empty)(bytes)).toStrictEqual({ e: {}, after: 3 });
  });
});
