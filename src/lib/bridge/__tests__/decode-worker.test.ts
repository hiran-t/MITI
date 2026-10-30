import { parse } from '@foxglove/rosmsg';
import { MessageWriter } from '@foxglove/rosmsg2-serialization';
import {
  createDecodeHandler,
  type ChannelSpec,
  type DecodeReply,
  type DecodeRequest,
} from '../decode-core';
import { DecodePool, DecodePoolFailure } from '../decode-pool';
import { decodeImagePixels } from '@/lib/parsers/image-parser';
import { readPointCloud } from '@/lib/parsers/pointcloud-parser';
import { getPrepared } from '@/lib/parsers/prepared';
import type { sensor_msgs } from '@/types/ros-messages';

const SEP = '\n================================================================================\n';
const HEADER =
  'MSG: std_msgs/Header\nbuiltin_interfaces/Time stamp\nstring frame_id' +
  SEP +
  'MSG: builtin_interfaces/Time\nint32 sec\nuint32 nanosec';
const IMAGE_SCHEMA =
  'std_msgs/Header header\nuint32 height\nuint32 width\nstring encoding\nuint8 is_bigendian\nuint32 step\nuint8[] data' +
  SEP +
  HEADER;
const CLOUD_SCHEMA =
  'std_msgs/Header header\nuint32 height\nuint32 width\nPointField[] fields\nbool is_bigendian\nuint32 point_step\nuint32 row_step\nuint8[] data\nbool is_dense' +
  SEP +
  HEADER +
  SEP +
  'MSG: sensor_msgs/PointField\nstring name\nuint32 offset\nuint8 datatype\nuint32 count';

const header = { stamp: { sec: 1, nanosec: 0 }, frame_id: 'camera' };
const imageChannel: ChannelSpec = {
  encoding: 'cdr',
  schemaEncoding: 'ros2msg',
  schema: IMAGE_SCHEMA,
  schemaName: 'sensor_msgs/msg/Image',
};
const cloudChannel: ChannelSpec = {
  ...imageChannel,
  schema: CLOUD_SCHEMA,
  schemaName: 'sensor_msgs/msg/PointCloud2',
};

/** A 2×2 bgr8 image with one byte of row padding, as CDR. */
const imageBytes = (blue = 10) =>
  new MessageWriter(parse(IMAGE_SCHEMA, { ros2: true })).writeMessage({
    header,
    height: 2,
    width: 2,
    encoding: 'bgr8',
    is_bigendian: 0,
    step: 7,
    data: new Uint8Array([blue, 20, 30, 1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 0]),
  });

/** Three points, the middle one not finite. */
function cloudBytes() {
  const data = new Uint8Array(36);
  const view = new DataView(data.buffer);
  [1, 2, 3, NaN, 0, 0, 7, 8, 9].forEach((v, i) => view.setFloat32(i * 4, v, true));
  return new MessageWriter(parse(CLOUD_SCHEMA, { ros2: true })).writeMessage({
    header,
    height: 1,
    width: 3,
    fields: ['x', 'y', 'z'].map((name, i) => ({ name, offset: i * 4, datatype: 7, count: 1 })),
    is_bigendian: false,
    point_step: 12,
    row_step: 36,
    data,
    is_dense: false,
  });
}

/** A frame as the WebSocket delivers it: the message after a few header bytes. */
function request(id: number, key: number, bytes: Uint8Array, channel?: ChannelSpec): DecodeRequest {
  const buffer = new ArrayBuffer(bytes.length + 13);
  new Uint8Array(buffer, 13).set(bytes);
  return { id, key, channel, buffer, byteOffset: 13, byteLength: bytes.length };
}

describe('decode handler', () => {
  test('decodes an image and converts its pixels, handing both buffers back', () => {
    const handle = createDecodeHandler();
    const req = request(1, 0, imageBytes(), imageChannel);
    const { reply, transfer } = handle(req);
    if ('error' in reply) throw new Error(reply.error);
    const message = reply.message as sensor_msgs.Image;
    expect(message.width).toBe(2);
    expect(Array.from(reply.prepared!.pixels!.slice(0, 4))).toEqual([30, 20, 10, 255]);
    expect(Array.from(reply.prepared!.pixels!)).toEqual(Array.from(decodeImagePixels(message)));
    // The decoded bytes view the request's buffer, which goes back rather than being copied.
    expect(transfer).toContain(req.buffer);
    expect(transfer).toContain(reply.prepared!.pixels!.buffer);
    expect(new Set(transfer).size).toBe(transfer.length);
  });

  test('scans point clouds and keeps each channel decoder for later messages', () => {
    const handle = createDecodeHandler();
    handle(request(1, 4, cloudBytes(), cloudChannel));
    const { reply } = handle(request(2, 4, cloudBytes()));
    if ('error' in reply) throw new Error(reply.error);
    expect(reply.prepared!.cloud!.count).toBe(2);
    expect(Array.from(reply.prepared!.cloud!.positions)).toEqual([1, 2, 3, 7, 8, 9]);
  });

  test('reports unknown channels and undecodable messages instead of throwing', () => {
    const handle = createDecodeHandler();
    expect(handle(request(1, 9, imageBytes())).reply).toEqual({ id: 1, error: 'Unknown channel' });
    const { reply } = handle(request(2, 1, new Uint8Array([0, 1, 0, 0, 9]), imageChannel));
    expect('error' in reply).toBe(true);
  });

  test('a message that cannot be prepared is still delivered, for the panel to report', () => {
    const handle = createDecodeHandler();
    const bad = new MessageWriter(parse(IMAGE_SCHEMA, { ros2: true })).writeMessage({
      header,
      height: 2,
      width: 2,
      encoding: 'yuv422_odd',
      is_bigendian: 0,
      step: 4,
      data: new Uint8Array(8),
    });
    const { reply } = handle(request(1, 0, bad, imageChannel));
    if ('error' in reply) throw new Error(reply.error);
    expect(reply.prepared).toBeUndefined();
    expect(() => decodeImagePixels(reply.message as sensor_msgs.Image)).toThrow(
      'Unsupported image encoding'
    );
  });
});

/** Runs the decode handler when told to, as a worker would between main-thread tasks. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: DecodeReply }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  requests: DecodeRequest[] = [];
  terminated = false;
  private handle = createDecodeHandler();
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(request: DecodeRequest) {
    this.requests.push(request);
  }
  replyAll() {
    this.requests.splice(0).forEach((req) => this.onmessage?.({ data: this.handle(req).reply }));
  }
  terminate() {
    this.terminated = true;
  }
}
const createWorker = () => new FakeWorker() as unknown as Worker;

describe('decode pool', () => {
  beforeEach(() => (FakeWorker.instances = []));

  test('prepared pixels and points are used by the parsers without converting again', async () => {
    const pool = new DecodePool(2, createWorker);
    const image = pool.decode(imageChannel, imageBytes());
    const cloud = pool.decode(cloudChannel, cloudBytes());
    // Each channel always goes to the same worker, which learns its schema once.
    expect(FakeWorker.instances.map((w) => w.requests.length)).toEqual([1, 1]);
    FakeWorker.instances.forEach((w) => w.replyAll());
    const imageMsg = (await image) as sensor_msgs.Image;
    expect(decodeImagePixels(imageMsg)).toBe(getPrepared(imageMsg)!.pixels);
    const cloudMsg = (await cloud) as sensor_msgs.PointCloud2;
    const points = readPointCloud(cloudMsg);
    expect(points.positions).toBe(getPrepared(cloudMsg)!.cloud!.positions);
    expect(Array.from(points.values('x')!)).toEqual([1, 7]);
    // A smaller point budget reads its own subset.
    expect(readPointCloud(cloudMsg, 1).count).toBe(1);

    const again = pool.decode(imageChannel, imageBytes());
    const [worker] = FakeWorker.instances;
    expect(worker.requests[0].channel).toBeUndefined();
    pool.dispose();
    await expect(again).rejects.toBeInstanceOf(DecodePoolFailure);
  });

  test('when a worker fails, waiting messages are rejected and the pool reports it', async () => {
    const onFailure = jest.fn();
    const pool = new DecodePool(1, createWorker, onFailure);
    const pending = pool.decode(imageChannel, imageBytes());
    FakeWorker.instances[0].onerror?.({ message: 'chunk failed to load' });
    await expect(pending).rejects.toBeInstanceOf(DecodePoolFailure);
    expect(onFailure).toHaveBeenCalledWith(new Error('chunk failed to load'));
    expect(pool.available).toBe(false);
    expect(FakeWorker.instances[0].terminated).toBe(true);
    await expect(pool.decode(imageChannel, imageBytes())).rejects.toBeInstanceOf(DecodePoolFailure);
  });

  test('no pool where the platform has no workers', () => {
    expect(typeof Worker).toBe('undefined');
    expect(DecodePool.create()).toBeNull();
  });
});
