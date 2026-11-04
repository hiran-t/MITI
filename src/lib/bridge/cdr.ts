/**
 * CDR, the bytes ROS 2 messages travel in: a 4-byte encapsulation header that gives the byte order,
 * then the values in order, each aligned to its own size counted from the end of the header.
 *
 * ROS 2 sends plain CDR (XCDR1), little- or big-endian. Plain CDR2 (XCDR2 for final types) is read
 * too: it aligns 8-byte values to 4. The parameter-list and delimited kinds of XCDR are not.
 */

const CDR_HEADER_SIZE = 4;

interface Encapsulation {
  littleEndian: boolean;
  /** Alignment of 8-byte values: 8 in CDR, 4 in CDR2. */
  align8: number;
}

const ENCAPSULATIONS: Record<number, Encapsulation> = {
  0x00: { littleEndian: false, align8: 8 }, // CDR_BE
  0x01: { littleEndian: true, align8: 8 }, // CDR_LE
  0x06: { littleEndian: false, align8: 4 }, // CDR2_BE
  0x07: { littleEndian: true, align8: 4 }, // CDR2_LE
  0x10: { littleEndian: false, align8: 4 }, // PLAIN_CDR2, big-endian (XTypes ENC_HEADER)
  0x11: { littleEndian: true, align8: 4 }, // PLAIN_CDR2, little-endian
};

const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

type NumberArray =
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

interface NumberArrayType<T extends NumberArray> {
  new (length: number): T;
  new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
  readonly BYTES_PER_ELEMENT: number;
}

type Getter = (view: DataView, offset: number, littleEndian: boolean) => number | bigint;

/** ASCII strings up to this length are faster to build by hand than through TextDecoder. */
const SHORT_STRING = 8;
/** Bytes a growing writer adds beyond what it needs. */
const GROWTH_SLACK = 4096;

/** Bytes of a view, as a Uint8Array over the same memory. */
const bytesOf = (view: DataView, start: number, length: number) =>
  new Uint8Array(view.buffer, view.byteOffset + start, length);

function decodeUtf8(view: DataView, start: number, end: number): string {
  if (end - start <= SHORT_STRING) {
    let text = '';
    for (let i = start; i < end; i++) {
      const byte = view.getUint8(i);
      if (byte > 0x7f) return textDecoder.decode(bytesOf(view, start, end - start));
      text += String.fromCharCode(byte);
    }
    return text;
  }
  return textDecoder.decode(bytesOf(view, start, end - start));
}

export class CdrReader {
  readonly view: DataView;
  readonly littleEndian: boolean;
  private readonly align8: number;
  offset = CDR_HEADER_SIZE;

  constructor(data: ArrayBufferView) {
    if (data.byteLength < CDR_HEADER_SIZE)
      throw new Error(`CDR data of ${data.byteLength} bytes has no 4-byte header`);
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const kind = this.view.getUint8(1);
    const encapsulation = ENCAPSULATIONS[kind];
    if (!encapsulation) throw new Error(`Unsupported CDR encapsulation 0x${kind.toString(16)}`);
    this.littleEndian = encapsulation.littleEndian;
    this.align8 = encapsulation.align8;
  }

  align(size: number): void {
    const rest = (this.offset - CDR_HEADER_SIZE) % size;
    if (rest) this.offset += size - rest;
  }

  /** Fails unless `size` more bytes follow the current offset. */
  private need(size: number): void {
    if (this.offset + size > this.view.byteLength)
      throw new RangeError(
        `CDR data ends at byte ${this.view.byteLength}; ${size} more needed at ${this.offset}`
      );
  }

  bool(): boolean {
    return this.view.getUint8(this.offset++) !== 0;
  }

  int8(): number {
    return this.view.getInt8(this.offset++);
  }

  uint8(): number {
    return this.view.getUint8(this.offset++);
  }

  int16(): number {
    this.align(2);
    const value = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  uint16(): number {
    this.align(2);
    const value = this.view.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  int32(): number {
    this.align(4);
    const value = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  uint32(): number {
    this.align(4);
    const value = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  int64(): bigint {
    this.align(this.align8);
    const value = this.view.getBigInt64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  uint64(): bigint {
    this.align(this.align8);
    const value = this.view.getBigUint64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  float32(): number {
    this.align(4);
    const value = this.view.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  float64(): number {
    this.align(this.align8);
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  /** A string: its byte length with the terminating NUL, then its UTF-8 bytes and the NUL. */
  string(): string {
    const length = this.uint32();
    this.need(length);
    const start = this.offset;
    this.offset += length;
    return length > 1 ? decodeUtf8(this.view, start, start + length - 1) : '';
  }

  /**
   * A wide string, as ROS 2 sends it: its length in UTF-16 code units, then each code unit as a
   * uint32, without a terminator. rosidl_typesupport_fastrtps writes it so on Humble and Jazzy, for
   * interoperability with the other DDS implementations.
   */
  wstring(): string {
    const length = this.uint32();
    this.need(length * 4);
    let text = '';
    for (let i = 0; i < length; i++) {
      text += String.fromCharCode(this.view.getUint32(this.offset, this.littleEndian));
      this.offset += 4;
    }
    return text;
  }

  /** The item count before an unbounded or bounded array. */
  sequenceLength(): number {
    return this.uint32();
  }

  stringArray(count: number): string[] {
    const array: string[] = [];
    for (let i = 0; i < count; i++) array.push(this.string());
    return array;
  }

  boolArray(count: number): boolean[] {
    this.need(count);
    const array = new Array<boolean>(count);
    for (let i = 0; i < count; i++) array[i] = this.view.getUint8(this.offset + i) !== 0;
    this.offset += count;
    return array;
  }

  /** Bytes are returned as a view of the data, not copied. */
  uint8Array(count: number): Uint8Array {
    this.need(count);
    const array = bytesOf(this.view, this.offset, count);
    this.offset += count;
    return array;
  }

  int8Array(count: number): Int8Array {
    this.need(count);
    const array = new Int8Array(this.view.buffer, this.view.byteOffset + this.offset, count);
    this.offset += count;
    return array;
  }

  int16Array(count: number): Int16Array {
    return this.numbers(Int16Array, count, 2, readInt16);
  }

  uint16Array(count: number): Uint16Array {
    return this.numbers(Uint16Array, count, 2, readUint16);
  }

  int32Array(count: number): Int32Array {
    return this.numbers(Int32Array, count, 4, readInt32);
  }

  uint32Array(count: number): Uint32Array {
    return this.numbers(Uint32Array, count, 4, readUint32);
  }

  int64Array(count: number): BigInt64Array {
    return this.numbers(BigInt64Array, count, this.align8, readInt64);
  }

  uint64Array(count: number): BigUint64Array {
    return this.numbers(BigUint64Array, count, this.align8, readUint64);
  }

  float32Array(count: number): Float32Array {
    return this.numbers(Float32Array, count, 4, readFloat32);
  }

  float64Array(count: number): Float64Array {
    return this.numbers(Float64Array, count, this.align8, readFloat64);
  }

  /**
   * `count` numbers as a typed array: a view of the data when it is in the host's byte order and
   * aligned in memory, otherwise a copy. An empty array is not aligned, as ROS 2 writes it.
   */
  private numbers<T extends NumberArray>(
    Type: NumberArrayType<T>,
    count: number,
    alignment: number,
    get: Getter
  ): T {
    if (count === 0) return new Type(0);
    this.align(alignment);
    const size = Type.BYTES_PER_ELEMENT;
    this.need(count * size);
    const start = this.view.byteOffset + this.offset;
    let array: T;
    if (this.littleEndian !== HOST_LITTLE_ENDIAN) {
      array = new Type(count);
      for (let i = 0; i < count; i++)
        array[i] = get(this.view, this.offset + i * size, this.littleEndian) as never;
    } else if (start % size === 0) array = new Type(this.view.buffer, start, count);
    else array = new Type(this.view.buffer.slice(start, start + count * size));
    this.offset += count * size;
    return array;
  }
}

const readInt16: Getter = (view, offset, le) => view.getInt16(offset, le);
const readUint16: Getter = (view, offset, le) => view.getUint16(offset, le);
const readInt32: Getter = (view, offset, le) => view.getInt32(offset, le);
const readUint32: Getter = (view, offset, le) => view.getUint32(offset, le);
const readInt64: Getter = (view, offset, le) => view.getBigInt64(offset, le);
const readUint64: Getter = (view, offset, le) => view.getBigUint64(offset, le);
const readFloat32: Getter = (view, offset, le) => view.getFloat32(offset, le);
const readFloat64: Getter = (view, offset, le) => view.getFloat64(offset, le);

export interface CdrWriterOptions {
  /** Write big-endian CDR instead of little-endian, which ROS 2 sends on common hardware. */
  bigEndian?: boolean;
  /** Bytes to reserve at first; the buffer grows as needed. */
  capacity?: number;
}

/** What array fields accept: arrays and typed arrays. */
type Items = ArrayLike<unknown>;
type Setter = (view: DataView, offset: number, value: never, littleEndian: boolean) => void;

export class CdrWriter {
  private buffer: ArrayBuffer;
  private bytes: Uint8Array;
  private view: DataView;
  private readonly littleEndian: boolean;
  offset = CDR_HEADER_SIZE;

  constructor(options: CdrWriterOptions = {}) {
    this.littleEndian = !options.bigEndian;
    this.buffer = new ArrayBuffer(Math.max(options.capacity ?? 64, CDR_HEADER_SIZE));
    this.bytes = new Uint8Array(this.buffer);
    this.view = new DataView(this.buffer);
    this.bytes[1] = this.littleEndian ? 0x01 : 0x00;
  }

  /** The bytes written so far, the header included. */
  get data(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  /** Makes room for `size` more bytes. The buffer starts zeroed, so padding needs no writes. */
  private reserve(size: number): void {
    const needed = this.offset + size;
    if (needed <= this.buffer.byteLength) return;
    // Room for the fields after a large array (PointCloud2's is_dense), without doubling for them.
    const buffer = new ArrayBuffer(Math.max(needed + GROWTH_SLACK, this.buffer.byteLength * 2));
    const bytes = new Uint8Array(buffer);
    bytes.set(this.bytes.subarray(0, this.offset));
    this.buffer = buffer;
    this.bytes = bytes;
    this.view = new DataView(buffer);
  }

  /** Pads to `size` and makes room for `then` bytes after the padding. */
  align(size: number, then = size): void {
    const rest = (this.offset - CDR_HEADER_SIZE) % size;
    const padding = rest ? size - rest : 0;
    this.reserve(padding + then);
    this.offset += padding;
  }

  bool(value: boolean): void {
    this.uint8(value ? 1 : 0);
  }

  int8(value: number): void {
    this.reserve(1);
    this.view.setInt8(this.offset++, value);
  }

  uint8(value: number): void {
    this.reserve(1);
    this.view.setUint8(this.offset++, value);
  }

  int16(value: number): void {
    this.align(2);
    this.view.setInt16(this.offset, value, this.littleEndian);
    this.offset += 2;
  }

  uint16(value: number): void {
    this.align(2);
    this.view.setUint16(this.offset, value, this.littleEndian);
    this.offset += 2;
  }

  int32(value: number): void {
    this.align(4);
    this.view.setInt32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  uint32(value: number): void {
    this.align(4);
    this.view.setUint32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  int64(value: bigint): void {
    this.align(8);
    this.view.setBigInt64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  uint64(value: bigint): void {
    this.align(8);
    this.view.setBigUint64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  float32(value: number): void {
    this.align(4);
    this.view.setFloat32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  float64(value: number): void {
    this.align(8);
    this.view.setFloat64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  string(value: string): void {
    // UTF-8 takes at most 3 bytes per UTF-16 code unit.
    this.align(4, 4 + value.length * 3 + 1);
    const start = this.offset + 4;
    let length = 0;
    for (; length < value.length; length++) {
      const code = value.charCodeAt(length);
      if (code > 0x7f) break;
      this.bytes[start + length] = code;
    }
    if (length < value.length)
      length += textEncoder.encodeInto(
        value.slice(length),
        this.bytes.subarray(start + length, start + value.length * 3)
      ).written;
    this.bytes[start + length] = 0;
    this.view.setUint32(this.offset, length + 1, this.littleEndian);
    this.offset = start + length + 1;
  }

  wstring(value: string): void {
    this.uint32(value.length);
    this.reserve(value.length * 4);
    for (let i = 0; i < value.length; i++) {
      this.view.setUint32(this.offset, value.charCodeAt(i), this.littleEndian);
      this.offset += 4;
    }
  }

  sequenceLength(count: number): void {
    this.uint32(count);
  }

  /** Writes bytes (`uint8`, `int8`); numbers outside 0–255 wrap as they do in a Uint8Array. */
  byteArray(values: Items): void {
    this.reserve(values.length);
    if (ArrayBuffer.isView(values)) {
      const view = values as unknown as ArrayBufferView;
      if (view.byteLength === values.length)
        this.bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), this.offset);
      else this.bytes.set(values as ArrayLike<number>, this.offset);
    } else this.bytes.set(values as ArrayLike<number>, this.offset);
    this.offset += values.length;
  }

  boolArray(values: Items): void {
    this.reserve(values.length);
    for (let i = 0; i < values.length; i++) this.bytes[this.offset + i] = values[i] ? 1 : 0;
    this.offset += values.length;
  }

  int16Array(values: Items): void {
    this.numbers(values, Int16Array, 2, setInt16, Number);
  }

  uint16Array(values: Items): void {
    this.numbers(values, Uint16Array, 2, setUint16, Number);
  }

  int32Array(values: Items): void {
    this.numbers(values, Int32Array, 4, setInt32, Number);
  }

  uint32Array(values: Items): void {
    this.numbers(values, Uint32Array, 4, setUint32, Number);
  }

  int64Array(values: Items): void {
    this.numbers(values, BigInt64Array, 8, setInt64, toBigInt);
  }

  uint64Array(values: Items): void {
    this.numbers(values, BigUint64Array, 8, setUint64, toBigInt);
  }

  float32Array(values: Items): void {
    this.numbers(values, Float32Array, 4, setFloat32, Number);
  }

  float64Array(values: Items): void {
    this.numbers(values, Float64Array, 8, setFloat64, Number);
  }

  /** Copies a typed array of the same type in one go, and converts anything else item by item. */
  private numbers(
    values: Items,
    Type: NumberArrayType<NumberArray>,
    size: number,
    set: Setter,
    convert: (value: unknown) => number | bigint
  ): void {
    if (values.length === 0) return;
    this.align(size, values.length * size);
    if (values instanceof Type && this.littleEndian === HOST_LITTLE_ENDIAN) {
      const view = values as NumberArray;
      this.bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), this.offset);
      this.offset += view.byteLength;
      return;
    }
    for (let i = 0; i < values.length; i++) {
      set(this.view, this.offset, convert(values[i]) as never, this.littleEndian);
      this.offset += size;
    }
  }
}

/** Integers for int64 fields: bigints as they are, numbers truncated, anything else 0. */
export function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  const number = Number(value);
  return Number.isFinite(number) ? BigInt(Math.trunc(number)) : BigInt(0);
}

const setInt16: Setter = (view, offset, value, le) => view.setInt16(offset, value, le);
const setUint16: Setter = (view, offset, value, le) => view.setUint16(offset, value, le);
const setInt32: Setter = (view, offset, value, le) => view.setInt32(offset, value, le);
const setUint32: Setter = (view, offset, value, le) => view.setUint32(offset, value, le);
const setInt64: Setter = (view, offset, value, le) => view.setBigInt64(offset, value, le);
const setUint64: Setter = (view, offset, value, le) => view.setBigUint64(offset, value, le);
const setFloat32: Setter = (view, offset, value, le) => view.setFloat32(offset, value, le);
const setFloat64: Setter = (view, offset, value, le) => view.setFloat64(offset, value, le);
