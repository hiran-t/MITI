import { parse } from '@foxglove/rosmsg';
import { MessageWriter } from '@foxglove/rosmsg2-serialization';
import { BridgeClient } from '../client';
import { createDecodeHandler, type DecodeReply, type DecodeRequest } from '../decode-core';

/** A WebSocket stand-in that records what the client sends and replays server frames. */
class Socket {
  static instances: Socket[] = [];
  binaryType = '';
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
const cdr = (schema: string, message: object) =>
  new MessageWriter(parse(schema, { ros2: true })).writeMessage(message);

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
  streamMode: 'synchronized' | 'separate' = 'separate'
) {
  Socket.instances = [];
  const client = new BridgeClient('ws://robot:8765', { streamMode });
  const connected = client.connect();
  const [control] = Socket.instances;
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

test('connects with the Foxglove SDK subprotocol, opening one connection up front', async () => {
  const { client, control } = await connect(['assets']);
  expect(Socket.instances).toHaveLength(1);
  expect(control.protocols).toEqual(['foxglove.sdk.v1', 'foxglove.websocket.v1']);
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
