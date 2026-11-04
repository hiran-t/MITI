import { BridgeClient } from '../client';
import { createDecoder, createEncoder } from '../codec';
import { createDecodeHandler, type DecodeReply, type DecodeRequest } from '../decode-core';

/** A WebSocket stand-in that records what the client sends and replays server frames. */
class Socket {
  static instances: Socket[] = [];
  binaryType = '';
  /** The subprotocol the server selected. */
  protocol = '';
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: unknown[] = [];
  constructor(
    public url: string,
    public protocols: string[]
  ) {
    Socket.instances.push(this);
  }
  send(data: string | Uint8Array) {
    this.sent.push(typeof data === 'string' ? JSON.parse(data) : data);
  }
  close() {
    this.onclose?.({});
  }
  json(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  binary(bytes: Uint8Array) {
    this.onmessage?.({ data: bytes.slice().buffer });
  }
  ops(op: string) {
    return this.sent.filter((m) => (m as { op?: string }).op === op) as Record<string, unknown>[];
  }
  subscribedChannels() {
    return this.ops('subscribe').map(
      (m) => (m.subscriptions as { channelId: number }[])[0].channelId
    );
  }
  lastSubscriptionId() {
    const subscribes = this.ops('subscribe');
    return (subscribes[subscribes.length - 1].subscriptions as { id: number }[])[0].id;
  }
}

const STRING_SCHEMA = 'string data';
const cdr = (schema: string, message: object) => createEncoder(schema)(message);

function frame(op: number, header: number[], payload: Uint8Array, header64 = false) {
  const size = 1 + header.length * 4 + (header64 ? 8 : 0) + payload.length;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, op);
  header.forEach((value, i) => view.setUint32(1 + i * 4, value, true));
  bytes.set(payload, size - payload.length);
  return bytes;
}
const messageFrame = (subscriptionId: number, payload: Uint8Array) =>
  frame(1, [subscriptionId], payload, true);
const jsonFrame = (subscriptionId: number, message: object) =>
  messageFrame(subscriptionId, new TextEncoder().encode(JSON.stringify(message)));

/** Let queued promise callbacks run (asset requests wait for a cache lookup first). */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const serverInfo = (capabilities: string[]) => ({
  op: 'serverInfo',
  name: 'bridge',
  capabilities,
  supportedEncodings: ['cdr', 'json'],
});

/**
 * Connects the client's control connection. Most tests use `separate` stream mode, where each
 * heavy topic opens a connection of its own.
 */
async function connect(
  capabilities: string[] = [],
  streamMode: 'synchronized' | 'separate' = 'separate',
  protocol = 'foxglove.sdk.v1'
) {
  Socket.instances = [];
  const client = new BridgeClient('ws://robot:8765', { streamMode });
  const connected = client.connect();
  const [control] = Socket.instances;
  control.protocol = protocol;
  control.json(serverInfo(capabilities));
  await connected;
  const advertise = (channels: object[]) => control.json({ op: 'advertise', channels });
  return { client, control, advertise };
}

/** Completes the handshake of the most recently opened connection; the bridge re-advertises. */
function openLane(channels: object[] = [], capabilities: string[] = []) {
  const lane = Socket.instances[Socket.instances.length - 1];
  lane.json(serverInfo(capabilities));
  lane.json({ op: 'advertise', channels });
  return lane;
}

const jsonChannel = (id: number, topic: string, schemaName: string) => ({
  id,
  topic,
  encoding: 'json',
  schemaName,
  schema: '',
});

const original = global.WebSocket;
beforeAll(() => {
  global.WebSocket = Socket as unknown as typeof WebSocket;
});
afterAll(() => {
  global.WebSocket = original;
});

test('offers miti.bridge.v1, then the Foxglove subprotocols, opening one connection up front', async () => {
  const { client, control } = await connect(['assets']);
  expect(Socket.instances).toHaveLength(1);
  expect(control.protocols).toEqual(['miti.bridge.v1', 'foxglove.sdk.v1', 'foxglove.websocket.v1']);
  expect(client.isConnected()).toBe(true);
  expect(client.hasCapability('assets')).toBe(true);
  client.disconnect();
});

test('light topics bind on the control connection, decode CDR and share one subscription', async () => {
  const { client, control, advertise } = await connect();
  const first = jest.fn();
  const second = jest.fn();
  client.subscribe('/robot_description', first, 'std_msgs/msg/String');
  advertise([
    {
      id: 7,
      topic: '/robot_description',
      encoding: 'cdr',
      schemaName: 'std_msgs/msg/String',
      schema: STRING_SCHEMA,
      schemaEncoding: 'ros2msg',
    },
  ]);
  expect(client.getTopics()).toEqual([
    { topic: '/robot_description', type: 'std_msgs/msg/String' },
  ]);
  client.subscribe('/robot_description', second, 'std_msgs/String');
  expect(control.subscribedChannels()).toEqual([7]);
  expect(Socket.instances).toHaveLength(1);
  control.binary(
    messageFrame(control.lastSubscriptionId(), cdr(STRING_SCHEMA, { data: '<robot/>' }))
  );
  expect(first).toHaveBeenCalledWith({ data: '<robot/>' });
  expect(second).toHaveBeenCalledWith({ data: '<robot/>' });
  client.unsubscribe('/robot_description', first);
  expect(control.ops('unsubscribe')).toHaveLength(0);
  client.unsubscribe('/robot_description', second);
  expect(control.ops('unsubscribe')).toHaveLength(1);
  client.disconnect();
});

test('by default every topic shares one connection, as in Foxglove', async () => {
  Socket.instances = [];
  const client = new BridgeClient('ws://robot:8765');
  const connected = client.connect();
  const [control] = Socket.instances;
  control.json(serverInfo([]));
  await connected;
  control.json({
    op: 'advertise',
    channels: [
      jsonChannel(1, '/tf', 'tf2_msgs/msg/TFMessage'),
      jsonChannel(2, '/camera/image_raw', 'sensor_msgs/msg/Image'),
    ],
  });
  client.subscribe('/tf', jest.fn());
  client.subscribe('/camera/image_raw', jest.fn());
  expect(Socket.instances).toHaveLength(1);
  expect(control.subscribedChannels()).toEqual([1, 2]);
  client.disconnect();
});

test('in separate mode each image and point cloud topic gets a connection of its own', async () => {
  const { client, control, advertise } = await connect();
  const channels = [
    jsonChannel(1, '/tf', 'tf2_msgs/msg/TFMessage'),
    jsonChannel(2, '/camera/image_raw', 'sensor_msgs/msg/Image'),
    jsonChannel(3, '/livox/lidar', 'sensor_msgs/msg/PointCloud2'),
  ];
  advertise(channels);
  const onImage = jest.fn();
  client.subscribe('/tf', jest.fn());
  client.subscribe('/camera/image_raw', onImage, 'sensor_msgs/msg/Image');
  const camera = openLane(channels);
  client.subscribe('/livox/lidar', jest.fn());
  const lidar = openLane(channels);
  expect(Socket.instances).toHaveLength(3);
  expect(control.subscribedChannels()).toEqual([1]);
  expect(camera.subscribedChannels()).toEqual([2]);
  expect(lidar.subscribedChannels()).toEqual([3]);
  camera.binary(jsonFrame(camera.lastSubscriptionId(), { width: 2 }));
  expect(onImage).toHaveBeenCalledWith({ width: 2 });
  client.disconnect();
});

test('a heavy topic waits for its connection, falls back to control if it cannot open', async () => {
  const { client, control, advertise } = await connect();
  const channels = [jsonChannel(2, '/camera/image_raw', 'sensor_msgs/msg/Image')];
  advertise(channels);
  jest.useFakeTimers();
  try {
    client.subscribe('/camera/image_raw', jest.fn());
    expect(control.ops('subscribe')).toHaveLength(0);
    // The topic's connection fails twice; meanwhile the control connection carries it.
    Socket.instances[1].close();
    jest.advanceTimersByTime(3000);
    Socket.instances[2].close();
    expect(control.subscribedChannels()).toEqual([2]);
    // When its own connection opens, the topic moves there.
    jest.advanceTimersByTime(3000);
    const lane = openLane(channels);
    expect(control.ops('unsubscribe')).toHaveLength(1);
    expect(lane.subscribedChannels()).toEqual([2]);
  } finally {
    jest.useRealTimers();
    client.disconnect();
  }
});

test('a topic connection closes when unused for a while', async () => {
  const { client, advertise } = await connect();
  const channels = [jsonChannel(2, '/camera/image_raw', 'sensor_msgs/msg/Image')];
  advertise(channels);
  jest.useFakeTimers();
  try {
    const callback = jest.fn();
    client.subscribe('/camera/image_raw', callback);
    const lane = openLane(channels);
    const close = jest.spyOn(lane, 'close');
    client.unsubscribe('/camera/image_raw', callback);
    jest.advanceTimersByTime(29000);
    client.subscribe('/camera/image_raw', callback);
    expect(lane.subscribedChannels()).toEqual([2, 2]);
    client.unsubscribe('/camera/image_raw', callback);
    jest.advanceTimersByTime(30000);
    expect(close).toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
    client.disconnect();
  }
});

test('a rate cap drops messages that come too soon, without ever unsubscribing', async () => {
  const { client, advertise } = await connect();
  jest.useFakeTimers();
  try {
    const channels = [jsonChannel(2, '/camera/image_raw', 'sensor_msgs/msg/Image')];
    advertise(channels);
    const onImage = jest.fn();
    client.subscribe('/camera/image_raw', onImage, undefined, { maxRate: 2 });
    const lane = openLane(channels);
    const id = lane.lastSubscriptionId();
    const send = (seq: number, afterMs: number) => {
      jest.advanceTimersByTime(afterMs);
      lane.binary(jsonFrame(id, { seq }));
    };
    send(1, 0);
    send(2, 100); // 100 ms after the last delivered one: too soon for 2 Hz
    send(3, 400); // 500 ms after seq 1
    send(4, 600); // a slow link: delivered as soon as it arrives
    expect(onImage.mock.calls.map(([m]) => m.seq)).toEqual([1, 3, 4]);
    // foxglove_bridge does not take the miti.* operations.
    expect(lane.ops('miti.subscriptionOptions')).toHaveLength(0);
    expect(lane.ops('unsubscribe')).toHaveLength(0);
    expect(lane.ops('subscribe')).toHaveLength(1);
    // A subscriber without a cap receives everything.
    const everything = jest.fn();
    client.subscribe('/camera/image_raw', everything);
    send(5, 10);
    expect(everything).toHaveBeenCalledWith({ seq: 5 });
  } finally {
    jest.useRealTimers();
    client.disconnect();
  }
});

test('over miti.bridge.v1 the bridge applies rate limits, and the client does not drop again', async () => {
  const { client, control, advertise } = await connect([], 'synchronized', 'miti.bridge.v1');
  advertise([jsonChannel(3, '/chatter', 'std_msgs/msg/String')]);
  const capped = jest.fn();
  client.subscribe('/chatter', capped, undefined, { maxRate: 5 });
  const id = control.lastSubscriptionId();
  const options = () => control.ops('miti.subscriptionOptions');
  expect(options()).toEqual([{ op: 'miti.subscriptionOptions', subscriptionId: id, maxRate: 5 }]);

  // The bridge spaces the messages; two close together both reach the subscriber.
  control.binary(jsonFrame(id, { seq: 1 }));
  control.binary(jsonFrame(id, { seq: 2 }));
  expect(capped).toHaveBeenCalledTimes(2);

  // The highest subscriber limit applies; one that wants everything lifts it, until it leaves.
  const throttled = jest.fn();
  client.subscribe('/chatter', throttled, undefined, { throttleMs: 100 });
  expect(options()[1]).toMatchObject({ maxRate: 10 });
  const everything = jest.fn();
  client.subscribe('/chatter', everything);
  expect(options()[2]).toMatchObject({ maxRate: null });
  client.unsubscribe('/chatter', everything);
  expect(options()[3]).toMatchObject({ maxRate: 10 });
  expect(options()).toHaveLength(4);
  client.disconnect();
});

// The client does not read these schemas' meaning, only decodes with them.
const IMAGE_SCHEMA = 'uint32 width\nstring encoding\nuint8[] data';
const COMPRESSED_SCHEMA = 'string format\nuint8[] data';
const cdrChannel = (id: number, topic: string, schemaName: string, schema: string) => ({
  id,
  topic,
  encoding: 'cdr',
  schemaName,
  schemaEncoding: 'ros2msg',
  schema,
});
const format = (subscriptionId: number, schemaName: string, schema: string) => ({
  op: 'miti.subscriptionFormat',
  subscriptionId,
  encoding: 'cdr',
  schemaName,
  schemaEncoding: 'ros2msg',
  schema,
});

test('over miti.bridge.v1 a color image topic is sent as JPEG when every subscriber asks', async () => {
  const { client, control, advertise } = await connect(
    ['miti.transforms'],
    'synchronized',
    'miti.bridge.v1'
  );
  advertise([cdrChannel(4, '/camera/image_raw', 'sensor_msgs/msg/Image', IMAGE_SCHEMA)]);
  const view = jest.fn();
  client.subscribe('/camera/image_raw', view, undefined, { transform: { kind: 'jpeg' } });
  const id = control.lastSubscriptionId();
  const options = () => control.ops('miti.subscriptionOptions');
  // Not before a frame shows an encoding JPEG can hold.
  expect(options()).toHaveLength(0);
  const raw = cdr(IMAGE_SCHEMA, { width: 2, encoding: 'rgb8', data: new Uint8Array(6) });
  control.binary(messageFrame(id, raw));
  expect(view).toHaveBeenLastCalledWith(expect.objectContaining({ encoding: 'rgb8' }));
  expect(options()).toEqual([
    { op: 'miti.subscriptionOptions', subscriptionId: id, transform: { kind: 'jpeg' } },
  ]);

  // Messages after the format message are decoded with it.
  control.json(format(id, 'sensor_msgs/msg/CompressedImage', COMPRESSED_SCHEMA));
  const jpeg = cdr(COMPRESSED_SCHEMA, { format: 'jpeg', data: new Uint8Array([0xff, 0xd8]) });
  control.binary(messageFrame(id, jpeg));
  expect(view).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'jpeg' }));

  // A subscriber that wants raw images takes the transform off for everyone, until it leaves.
  const rawView = jest.fn();
  client.subscribe('/camera/image_raw', rawView);
  expect(options()[1]).toEqual({
    op: 'miti.subscriptionOptions',
    subscriptionId: id,
    transform: null,
  });
  control.json(format(id, 'sensor_msgs/msg/Image', IMAGE_SCHEMA));
  control.binary(messageFrame(id, raw));
  expect(rawView).toHaveBeenLastCalledWith(expect.objectContaining({ encoding: 'rgb8' }));
  client.unsubscribe('/camera/image_raw', rawView);
  expect(options()[2]).toMatchObject({ transform: { kind: 'jpeg' } });
  expect(options()).toHaveLength(3);
  client.disconnect();
});

test('depth images, other message types and foxglove_bridge are never sent a transform', async () => {
  const { client, control, advertise } = await connect(
    ['miti.transforms'],
    'synchronized',
    'miti.bridge.v1'
  );
  advertise([
    cdrChannel(4, '/camera/depth', 'sensor_msgs/msg/Image', IMAGE_SCHEMA),
    jsonChannel(5, '/chatter', 'std_msgs/msg/String'),
  ]);
  const jpeg = { transform: { kind: 'jpeg' } as const };
  client.subscribe('/camera/depth', jest.fn(), undefined, jpeg);
  const depth = control.lastSubscriptionId();
  control.binary(
    messageFrame(depth, cdr(IMAGE_SCHEMA, { width: 2, encoding: '16UC1', data: new Uint8Array(4) }))
  );
  client.subscribe('/chatter', jest.fn(), undefined, jpeg);
  control.binary(jsonFrame(control.lastSubscriptionId(), { data: 'hi', encoding: 'rgb8' }));
  expect(control.ops('miti.subscriptionOptions')).toHaveLength(0);
  client.disconnect();

  const foxglove = await connect(['miti.transforms'], 'synchronized');
  foxglove.advertise([cdrChannel(4, '/camera/image_raw', 'sensor_msgs/msg/Image', IMAGE_SCHEMA)]);
  const view = jest.fn();
  foxglove.client.subscribe('/camera/image_raw', view, undefined, jpeg);
  foxglove.control.binary(
    messageFrame(
      foxglove.control.lastSubscriptionId(),
      cdr(IMAGE_SCHEMA, { width: 2, encoding: 'rgb8', data: new Uint8Array(6) })
    )
  );
  expect(view).toHaveBeenCalledTimes(1);
  expect(foxglove.control.ops('miti.subscriptionOptions')).toHaveLength(0);
  foxglove.client.disconnect();
});

test('point clouds are reduced on the robot when every subscriber asks for the same', async () => {
  const { client, control, advertise } = await connect(
    ['miti.transforms'],
    'synchronized',
    'miti.bridge.v1'
  );
  advertise([jsonChannel(6, '/points', 'sensor_msgs/msg/PointCloud2')]);
  const reduce = (maxPoints: number) => ({ transform: { kind: 'reduce', maxPoints } as const });
  const first = jest.fn();
  client.subscribe('/points', first, undefined, reduce(1000));
  const options = () => control.ops('miti.subscriptionOptions');
  expect(options()).toEqual([
    {
      op: 'miti.subscriptionOptions',
      subscriptionId: control.lastSubscriptionId(),
      transform: { kind: 'reduce', maxPoints: 1000 },
    },
  ]);
  // The same transform again changes nothing; another one leaves the cloud as it is.
  client.subscribe('/points', jest.fn(), undefined, reduce(1000));
  expect(options()).toHaveLength(1);
  client.subscribe('/points', jest.fn(), undefined, reduce(500));
  expect(options()[1]).toMatchObject({ transform: null });
  client.disconnect();
});

test('over miti.bridge.v1 the link stats sum what each connection reports', async () => {
  const { client, control, advertise } = await connect(
    ['miti.stats'],
    'synchronized',
    'miti.bridge.v1'
  );
  expect(control.ops('miti.subscribeStats')).toEqual([
    { op: 'miti.subscribeStats', intervalMs: 1000 },
  ]);
  advertise([jsonChannel(3, '/chatter', 'std_msgs/msg/String')]);
  client.subscribe('/chatter', jest.fn());
  const id = control.lastSubscriptionId();
  const seen = jest.fn();
  client.onLinkStats(seen);
  expect(client.getLinkStats()).toBeNull();
  control.json({
    op: 'miti.stats',
    timestamp: 1730530000000,
    bufferedBytes: 2048,
    subscriptions: [
      { subscriptionId: id, bytesPerSecond: 5000, sent: 10, dropped: 2, oldestQueuedMs: 30 },
      { subscriptionId: 99, bytesPerSecond: 100, sent: 1, dropped: 0, oldestQueuedMs: 0 },
    ],
  });
  expect(client.getLinkStats()).toEqual({
    bytesPerSecond: 5100,
    droppedPerSecond: 2,
    bufferedBytes: 2048,
    oldestQueuedMs: 30,
    topics: [{ topic: '/chatter', bytesPerSecond: 5000, sentPerSecond: 10, droppedPerSecond: 2 }],
  });
  expect(seen).toHaveBeenCalledTimes(1);
  control.close();
  expect(client.getLinkStats()).toBeNull();
  expect(seen).toHaveBeenLastCalledWith(null);
  client.disconnect();

  const foxglove = await connect(['miti.stats']);
  expect(foxglove.control.ops('miti.subscribeStats')).toHaveLength(0);
  foxglove.client.disconnect();
});

test('over miti.bridge.v1 publishing sends CDR, asking for an unknown schema once', async () => {
  const { client, control, advertise } = await connect(
    ['clientPublish', 'miti.schemas'],
    'synchronized',
    'miti.bridge.v1'
  );
  const errors = jest.fn();
  client.onError(errors);
  client.advertise('/flag', 'std_msgs/Bool');
  client.publish('/flag', { data: true });
  client.publish('/flag', { data: false });
  const binaryFrames = () => control.sent.filter((m) => m instanceof Uint8Array) as Uint8Array[];
  // Both wait for the schema, asked for once.
  const asked = control.ops('miti.getSchema');
  expect(asked).toEqual([{ op: 'miti.getSchema', type: 'std_msgs/msg/Bool', id: asked[0]?.id }]);
  expect(binaryFrames()).toHaveLength(0);

  control.json({
    op: 'miti.schema',
    id: asked[0].id,
    type: 'std_msgs/msg/Bool',
    schemaName: 'std_msgs/msg/Bool',
    schemaEncoding: 'ros2msg',
    schema: 'bool data',
  });
  expect(control.ops('advertise')).toEqual([
    {
      op: 'advertise',
      channels: [{ id: 1, topic: '/flag', encoding: 'cdr', schemaName: 'std_msgs/msg/Bool' }],
    },
  ]);
  const decode = createDecoder('cdr', 'ros2msg', 'bool data');
  expect(binaryFrames().map((frame) => decode(frame.subarray(5)))).toEqual([
    { data: true },
    { data: false },
  ]);

  // A topic the bridge advertises brings its schema: nothing to ask for.
  advertise([
    {
      id: 9,
      topic: '/chatter',
      encoding: 'cdr',
      schemaName: 'std_msgs/msg/String',
      schema: STRING_SCHEMA,
    },
  ]);
  client.advertise('/chatter', 'std_msgs/msg/String');
  client.publish('/chatter', { data: 'hi' });
  expect(control.ops('miti.getSchema')).toHaveLength(1);
  expect(binaryFrames()).toHaveLength(3);

  // A type the bridge does not know reaches the error callbacks.
  client.advertise('/odd', 'odd_msgs/Thing');
  client.publish('/odd', {});
  const odd = control.ops('miti.getSchema')[1];
  control.json({
    op: 'miti.schema',
    id: odd.id,
    type: 'odd_msgs/msg/Thing',
    error: 'Unknown type',
  });
  expect(errors).toHaveBeenCalledWith(new Error('Cannot publish odd_msgs/msg/Thing: Unknown type'));
  client.disconnect();
});

test('a restarted publisher is rebound and a topic of another type is not subscribed', async () => {
  const { client, control, advertise } = await connect();
  client.subscribe('/scan', jest.fn(), 'sensor_msgs/msg/LaserScan');
  advertise([jsonChannel(1, '/scan', 'sensor_msgs/msg/PointCloud2')]);
  expect(control.ops('subscribe')).toHaveLength(0);
  const unadvertise = (ids: number[]) =>
    Socket.instances.forEach((s) => s.json({ op: 'unadvertise', channelIds: ids }));
  unadvertise([1]);
  advertise([jsonChannel(2, '/scan', 'sensor_msgs/msg/LaserScan')]);
  unadvertise([2]);
  advertise([jsonChannel(3, '/scan', 'sensor_msgs/msg/LaserScan')]);
  expect(control.subscribedChannels()).toEqual([2, 3]);
  client.disconnect();
});

test('late TF subscribers receive retained static transforms', async () => {
  const { client, control, advertise } = await connect();
  const transform = { child_frame_id: 'camera', header: { frame_id: 'base_link' } };
  client.subscribe('/tf_static', jest.fn());
  advertise([jsonChannel(4, '/tf_static', 'tf2_msgs/msg/TFMessage')]);
  control.binary(jsonFrame(control.lastSubscriptionId(), { transforms: [transform] }));
  const late = jest.fn();
  client.subscribe('/tf_static', late);
  expect(late).toHaveBeenCalledWith({ transforms: [transform] });
  client.disconnect();
});

test('publishing advertises a JSON channel once with the ROS 2 type name', async () => {
  const { client, control } = await connect(['clientPublish']);
  client.advertise('/clicked_point', 'geometry_msgs/PointStamped');
  client.publish('/clicked_point', { point: { x: 1 } });
  client.publish('/clicked_point', { point: { x: 2 } });
  expect(control.ops('advertise')).toEqual([
    {
      op: 'advertise',
      channels: [
        {
          id: 1,
          topic: '/clicked_point',
          encoding: 'json',
          schemaName: 'geometry_msgs/msg/PointStamped',
        },
      ],
    },
  ]);
  const frames = control.sent.filter((m) => m instanceof Uint8Array) as Uint8Array[];
  expect(frames).toHaveLength(2);
  expect(JSON.parse(new TextDecoder().decode(frames[1].subarray(5)))).toEqual({ point: { x: 2 } });
  client.disconnect();
});

test('parameters, assets and service calls resolve from the bridge replies', async () => {
  const { client, control } = await connect(['parameters', 'assets', 'services']);

  const parameter = client.getParameter('/robot_state_publisher.robot_description');
  const [{ id }] = control.ops('getParameters') as { id: string }[];
  control.json({ op: 'parameterValues', id, parameters: [{ name: 'x', value: '<robot/>' }] });
  await expect(parameter).resolves.toBe('<robot/>');

  const asset = client.fetchAsset('package://g1/meshes/pelvis.STL');
  await settle();
  const assets = openLane();
  await settle();
  expect(control.ops('fetchAsset')).toHaveLength(0);
  const [{ requestId }] = assets.ops('fetchAsset') as { requestId: number }[];
  // status SUCCESS (0), a zero-length error message, then the file bytes
  assets.binary(frame(4, [requestId], new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3])));
  await expect(asset).resolves.toEqual(new Uint8Array([1, 2, 3]));

  control.json({
    op: 'advertiseServices',
    services: [
      {
        id: 9,
        name: '/set_bool',
        type: 'std_srvs/srv/SetBool',
        request: {
          encoding: 'cdr',
          schemaName: 'std_srvs/srv/SetBool_Request',
          schemaEncoding: 'ros2msg',
          schema: 'bool data',
        },
        response: {
          encoding: 'cdr',
          schemaName: 'std_srvs/srv/SetBool_Response',
          schemaEncoding: 'ros2msg',
          schema: 'bool success\nstring message',
        },
      },
    ],
  });
  const call = client.callService('/set_bool', { data: true });
  const request = control.sent[control.sent.length - 1] as Uint8Array;
  const view = new DataView(request.buffer, request.byteOffset);
  expect([view.getUint8(0), view.getUint32(1, true)]).toEqual([2, 9]);
  const callId = view.getUint32(5, true);
  const encoding = new TextEncoder().encode('cdr');
  const header = new Uint8Array(13 + encoding.length);
  const headerView = new DataView(header.buffer);
  headerView.setUint8(0, 3);
  headerView.setUint32(1, 9, true);
  headerView.setUint32(5, callId, true);
  headerView.setUint32(9, encoding.length, true);
  header.set(encoding, 13);
  const payload = cdr('bool success\nstring message', { success: true, message: 'ok' });
  const response = new Uint8Array(header.length + payload.length);
  response.set(header);
  response.set(payload, header.length);
  control.binary(response);
  await expect(call).resolves.toEqual({ success: true, message: 'ok' });
  client.disconnect();
});

test('assets are fetched a few at a time and each URI only once', async () => {
  const { client } = await connect(['assets']);
  const uris = Array.from({ length: 6 }, (_, i) => `package://g1/meshes/link${i}.STL`);
  const requests = uris.map((uri) => client.fetchAsset(uri));
  expect(client.fetchAsset(uris[0])).toBe(requests[0]);
  await settle();
  const bulk = openLane();
  await settle();
  const sent = () => bulk.ops('fetchAsset') as { uri: string; requestId: number }[];
  expect(sent()).toHaveLength(4);
  bulk.binary(frame(4, [sent()[0].requestId], new Uint8Array([0, 0, 0, 0, 0, 7])));
  await expect(requests[0]).resolves.toEqual(new Uint8Array([7]));
  await settle();
  expect(sent().map((m) => m.uri)).toEqual(uris.slice(0, 5));
  client.disconnect();
  await Promise.allSettled(requests);
});

test('an asset whose reply never arrives is requested again', async () => {
  const { client } = await connect(['assets']);
  jest.useFakeTimers();
  try {
    const asset = client.fetchAsset('package://g1/meshes/left_elbow_link.stl');
    await settle();
    const bulk = openLane();
    await settle();
    expect(bulk.ops('fetchAsset')).toHaveLength(1);
    jest.advanceTimersByTime(60000);
    await settle();
    const retries = bulk.ops('fetchAsset') as { requestId: number }[];
    expect(retries).toHaveLength(2);
    bulk.binary(frame(4, [retries[1].requestId], new Uint8Array([0, 0, 0, 0, 0, 9])));
    await expect(asset).resolves.toEqual(new Uint8Array([9]));
  } finally {
    jest.useRealTimers();
    client.disconnect();
  }
});

/** A decode worker that answers only when told to, so tests can hold a decode in flight. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: DecodeReply }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  requests: DecodeRequest[] = [];
  private handle = createDecodeHandler();
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(request: DecodeRequest) {
    this.requests.push(request);
  }
  replyNext() {
    const request = this.requests.shift();
    if (request) this.onmessage?.({ data: this.handle(request).reply });
  }
  terminate() {}
}

async function connectWithWorkers() {
  Socket.instances = [];
  FakeWorker.instances = [];
  const client = new BridgeClient('ws://robot:8765', {
    createWorker: () => new FakeWorker() as unknown as Worker,
  });
  const connected = client.connect();
  const [control] = Socket.instances;
  control.json(serverInfo([]));
  await connected;
  control.json({
    op: 'advertise',
    channels: [
      jsonChannel(1, '/camera/image_raw', 'sensor_msgs/msg/Image'),
      jsonChannel(2, '/status', 'std_msgs/msg/String'),
    ],
  });
  return { client, control };
}

test('heavy messages are decoded in a worker; the newest waits while one is decoding', async () => {
  const { client, control } = await connectWithWorkers();
  const onImage = jest.fn();
  const onStatus = jest.fn();
  client.subscribe('/camera/image_raw', onImage);
  const image = control.lastSubscriptionId();
  client.subscribe('/status', onStatus);
  control.binary(jsonFrame(control.lastSubscriptionId(), { data: 'light' }));
  // Light topics stay on the main thread and arrive at once.
  expect(onStatus).toHaveBeenCalledWith({ data: 'light' });

  [1, 2, 3].forEach((seq) => control.binary(jsonFrame(image, { seq })));
  const worker = FakeWorker.instances.find((w) => w.requests.length)!;
  // One frame is decoding; 2 was replaced by 3 before it was ever sent to a worker.
  expect(worker.requests).toHaveLength(1);
  expect(onImage).not.toHaveBeenCalled();
  worker.replyNext();
  await settle();
  expect(onImage.mock.calls.map(([m]) => m.seq)).toEqual([1]);
  expect(worker.requests).toHaveLength(1);
  worker.replyNext();
  await settle();
  expect(onImage.mock.calls.map(([m]) => m.seq)).toEqual([1, 3]);

  // Frames decoded for a subscriber that has left are dropped.
  control.binary(jsonFrame(image, { seq: 4 }));
  client.unsubscribe('/camera/image_raw', onImage);
  worker.replyNext();
  await settle();
  expect(onImage).toHaveBeenCalledTimes(2);
  client.disconnect();
});

test('if the workers fail, heavy topics are decoded on the main thread again', async () => {
  const { client, control } = await connectWithWorkers();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const onImage = jest.fn();
  client.subscribe('/camera/image_raw', onImage);
  const image = control.lastSubscriptionId();
  control.binary(jsonFrame(image, { seq: 1 }));
  control.binary(jsonFrame(image, { seq: 2 }));
  FakeWorker.instances[0].onerror?.({ message: 'chunk failed to load' });
  await settle();
  // The frame in the worker is lost; the one still waiting is decoded here.
  expect(onImage.mock.calls.map(([m]) => m.seq)).toEqual([2]);
  control.binary(jsonFrame(image, { seq: 3 }));
  expect(onImage.mock.calls.map(([m]) => m.seq)).toEqual([2, 3]);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
  client.disconnect();
});

test('a throttle window drops superseded messages before decoding and delivers the newest', async () => {
  const { client, control } = await connect([], 'synchronized');
  jest.useFakeTimers();
  try {
    control.json({ op: 'advertise', channels: [jsonChannel(1, '/status', 'std_msgs/msg/String')] });
    const throttled = jest.fn();
    client.subscribe('/status', throttled, undefined, { throttleMs: 100 });
    const id = control.lastSubscriptionId();
    const send = (seq: number) => control.binary(jsonFrame(id, { seq }));
    send(1);
    send(2);
    send(3);
    expect(throttled.mock.calls.map(([m]) => m.seq)).toEqual([1]);
    jest.advanceTimersByTime(100);
    expect(throttled.mock.calls.map(([m]) => m.seq)).toEqual([1, 3]);
    // A subscriber without a window gets every message again.
    const everything = jest.fn();
    client.subscribe('/status', everything);
    jest.advanceTimersByTime(10);
    send(4);
    send(5);
    expect(everything.mock.calls.map(([m]) => m.seq)).toEqual([4, 5]);
  } finally {
    jest.useRealTimers();
    client.disconnect();
  }
});
