#!/usr/bin/env node
/**
 * A local foxglove_bridge stand-in that streams robot-sized data, to measure MITI under load:
 * raw rgb8 cameras, a Livox-style PointCloud2, TF, a costmap and /rosout.
 *
 *   node scripts/heavy-bridge.js [--port 8790] [--cams 3] [--cam-hz 15] [--width 1280]
 *     [--height 720] [--points 100000] [--cloud-hz 10] [--tf-hz 100] [--log-hz 50]
 *
 * Connect MITI to ws://localhost:<port>. http://localhost:<port + 1>/stats reports what was sent
 * and dropped per topic since the start (scripts/perf-run.js reads it). Like foxglove_bridge, a message is dropped for a client
 * whose send buffer is over the limit, so a slow browser gets the newest data instead of an
 * ever-growing queue.
 */
const http = require('http');
const { WebSocketServer } = require('ws');
const { FoxgloveServer } = require('@foxglove/ws-protocol');
const { parse } = require('@foxglove/rosmsg');
const { MessageWriter } = require('@foxglove/rosmsg2-serialization');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((pair) => pair.trim().split(/\s+/))
    .map(([key, value]) => [key, Number(value)])
);
const opt = (name, fallback) => (Number.isFinite(args[name]) ? args[name] : fallback);
const PORT = opt('port', 8790);
const CAMS = opt('cams', 3);
const CAM_HZ = opt('cam-hz', 15);
const WIDTH = opt('width', 1280);
const HEIGHT = opt('height', 720);
const POINTS = opt('points', 100000);
const CLOUD_HZ = opt('cloud-hz', 10);
const TF_HZ = opt('tf-hz', 100);
const LOG_HZ = opt('log-hz', 50);
/** foxglove_bridge's default send_buffer_limit. */
const SEND_BUFFER_LIMIT = 10e6;

// ── ROS 2 message definitions (as foxglove_bridge advertises them) ──
const SEP = '\n================================================================================\n';
const TIME = 'MSG: builtin_interfaces/Time\nint32 sec\nuint32 nanosec';
const HEADER = 'MSG: std_msgs/Header\nbuiltin_interfaces/Time stamp\nstring frame_id' + SEP + TIME;
const POSE =
  'MSG: geometry_msgs/Pose\nPoint position\nQuaternion orientation' +
  SEP +
  'MSG: geometry_msgs/Point\nfloat64 x\nfloat64 y\nfloat64 z' +
  SEP +
  'MSG: geometry_msgs/Quaternion\nfloat64 x 0\nfloat64 y 0\nfloat64 z 0\nfloat64 w 1';
const SCHEMAS = {
  'sensor_msgs/msg/Image':
    'std_msgs/Header header\nuint32 height\nuint32 width\nstring encoding\nuint8 is_bigendian\nuint32 step\nuint8[] data' +
    SEP +
    HEADER,
  'sensor_msgs/msg/PointCloud2':
    'std_msgs/Header header\nuint32 height\nuint32 width\nPointField[] fields\nbool is_bigendian\nuint32 point_step\nuint32 row_step\nuint8[] data\nbool is_dense' +
    SEP +
    HEADER +
    SEP +
    'MSG: sensor_msgs/PointField\nuint8 INT8=1\nuint8 UINT8=2\nuint8 INT16=3\nuint8 UINT16=4\nuint8 INT32=5\nuint8 UINT32=6\nuint8 FLOAT32=7\nuint8 FLOAT64=8\nstring name\nuint32 offset\nuint8 datatype\nuint32 count',
  'tf2_msgs/msg/TFMessage':
    'geometry_msgs/TransformStamped[] transforms' +
    SEP +
    'MSG: geometry_msgs/TransformStamped\nstd_msgs/Header header\nstring child_frame_id\nTransform transform' +
    SEP +
    HEADER +
    SEP +
    'MSG: geometry_msgs/Transform\nVector3 translation\nQuaternion rotation' +
    SEP +
    'MSG: geometry_msgs/Vector3\nfloat64 x\nfloat64 y\nfloat64 z' +
    SEP +
    'MSG: geometry_msgs/Quaternion\nfloat64 x 0\nfloat64 y 0\nfloat64 z 0\nfloat64 w 1',
  'rcl_interfaces/msg/Log':
    'byte DEBUG=10\nbyte INFO=20\nbyte WARN=30\nbyte ERROR=40\nbyte FATAL=50\nbuiltin_interfaces/Time stamp\nuint8 level\nstring name\nstring msg\nstring file\nstring function\nuint32 line' +
    SEP +
    TIME,
  'nav_msgs/msg/OccupancyGrid':
    'std_msgs/Header header\nMapMetaData info\nint8[] data' +
    SEP +
    HEADER +
    SEP +
    'MSG: nav_msgs/MapMetaData\nbuiltin_interfaces/Time map_load_time\nfloat32 resolution\nuint32 width\nuint32 height\ngeometry_msgs/Pose origin' +
    SEP +
    POSE,
};

const server = new FoxgloveServer({ name: 'miti-heavy-bridge', capabilities: [] });
const connections = new Set();
const wss = new WebSocketServer({
  port: PORT,
  handleProtocols: (protocols) => server.handleProtocols(protocols),
});
wss.on('connection', (conn, req) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
  server.handleConnection(conn, `${req.socket.remoteAddress}:${req.socket.remotePort}`);
  console.log('client connected');
});

const channels = {};
function add(topic, schemaName) {
  const schema = SCHEMAS[schemaName];
  channels[topic] = {
    id: server.addChannel({
      topic,
      encoding: 'cdr',
      schemaName,
      schema,
      schemaEncoding: 'ros2msg',
    }),
    writer: new MessageWriter(parse(schema, { ros2: true })),
    active: false,
    sent: 0,
    dropped: 0,
    total: { sent: 0, dropped: 0, bytes: 0 },
  };
}
server.on('subscribe', (id) => {
  const entry = Object.entries(channels).find(([, c]) => c.id === id);
  if (entry) entry[1].active = true;
});
server.on('unsubscribe', (id) => {
  const entry = Object.entries(channels).find(([, c]) => c.id === id);
  if (entry) entry[1].active = false;
});

const congested = () => Array.from(connections).some((c) => c.bufferedAmount > SEND_BUFFER_LIMIT);
function sendBytes(topic, bytes) {
  const channel = channels[topic];
  if (!channel.active) return;
  if (congested()) {
    channel.dropped += 1;
    channel.total.dropped += 1;
    return;
  }
  channel.sent += 1;
  channel.total.sent += 1;
  channel.total.bytes += bytes.byteLength;
  server.sendMessage(channel.id, BigInt(Date.now()) * 1000000n, bytes);
}
const send = (topic, message) => sendBytes(topic, channels[topic].writer.writeMessage(message));
const stamp = () => {
  const ms = Date.now();
  return { sec: Math.floor(ms / 1000), nanosec: (ms % 1000) * 1e6 };
};
/** Header stamps sit right after the 4-byte CDR encapsulation header. */
function restamp(bytes) {
  const { sec, nanosec } = stamp();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setInt32(4, sec, true);
  view.setUint32(8, nanosec, true);
  return bytes;
}
const yawQ = (yaw) => ({ x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) });
const every = (hz, fn) => hz > 0 && setInterval(fn, 1000 / hz);

// ── Cameras: a few pre-serialized frames per camera, restamped and cycled ──
const FRAMES = 4;
for (let cam = 0; cam < CAMS; cam++) {
  const topic = `/camera${cam}/color/image_raw`;
  add(topic, 'sensor_msgs/msg/Image');
  const frames = Array.from({ length: FRAMES }, (_, f) => {
    const data = new Uint8Array(WIDTH * HEIGHT * 3);
    for (let y = 0, i = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++, i += 3) {
        data[i] = (x + f * 40 + cam * 80) & 255;
        data[i + 1] = (y + f * 20) & 255;
        data[i + 2] = ((x ^ y) + cam * 60) & 255;
      }
    return channels[topic].writer.writeMessage({
      header: { stamp: stamp(), frame_id: `camera${cam}_optical` },
      height: HEIGHT,
      width: WIDTH,
      encoding: 'rgb8',
      is_bigendian: 0,
      step: WIDTH * 3,
      data,
    });
  });
  let next = 0;
  every(CAM_HZ, () => sendBytes(topic, restamp(frames[next++ % FRAMES])));
}

// ── Livox-style cloud: x y z intensity (float32), tag line (uint8), timestamp (float64) ──
add('/livox/lidar', 'sensor_msgs/msg/PointCloud2');
const POINT_STEP = 26;
const CLOUDS = 5;
const cloudFields = [
  ['x', 0, 7],
  ['y', 4, 7],
  ['z', 8, 7],
  ['intensity', 12, 7],
  ['tag', 16, 2],
  ['line', 17, 2],
  ['timestamp', 18, 8],
].map(([name, offset, datatype]) => ({ name, offset, datatype, count: 1 }));
const clouds = Array.from({ length: CLOUDS }, (_, c) => {
  const data = new Uint8Array(POINTS * POINT_STEP);
  const view = new DataView(data.buffer);
  for (let i = 0; i < POINTS; i++) {
    const a = (i / POINTS) * Math.PI * 2 * 40 + c * 0.1;
    const r = 2 + (i % 997) / 60;
    const o = i * POINT_STEP;
    view.setFloat32(o, r * Math.cos(a), true);
    view.setFloat32(o + 4, r * Math.sin(a), true);
    view.setFloat32(o + 8, ((i % 40) - 20) / 20, true);
    view.setFloat32(o + 12, (i * 7) % 255, true);
    view.setUint8(o + 16, 0);
    view.setUint8(o + 17, i % 4);
    view.setFloat64(o + 18, i * 1e-6, true);
  }
  return channels['/livox/lidar'].writer.writeMessage({
    header: { stamp: stamp(), frame_id: 'livox_frame' },
    height: 1,
    width: POINTS,
    fields: cloudFields,
    is_bigendian: false,
    point_step: POINT_STEP,
    row_step: POINTS * POINT_STEP,
    data,
    is_dense: true,
  });
});
let nextCloud = 0;
every(CLOUD_HZ, () => sendBytes('/livox/lidar', restamp(clouds[nextCloud++ % CLOUDS])));

// ── TF: the robot drives a circle; camera and lidar frames hang off base_link ──
add('/tf', 'tf2_msgs/msg/TFMessage');
add('/tf_static', 'tf2_msgs/msg/TFMessage');
const tf = (parent, child, x, y, z, yaw) => ({
  header: { stamp: stamp(), frame_id: parent },
  child_frame_id: child,
  transform: { translation: { x, y, z }, rotation: yawQ(yaw) },
});
every(TF_HZ, () => {
  const t = Date.now() / 6000;
  send('/tf', {
    transforms: [
      tf('map', 'odom', 0, 0, 0, 0),
      tf('odom', 'base_link', 2 * Math.cos(t), 2 * Math.sin(t), 0, t + Math.PI / 2),
    ],
  });
});
every(1, () =>
  send('/tf_static', {
    transforms: [
      tf('base_link', 'livox_frame', 0.2, 0, 0.5, 0),
      ...Array.from({ length: CAMS }, (_, cam) =>
        tf('base_link', `camera${cam}_optical`, 0.3, 0, 0.4, (cam * Math.PI) / 2)
      ),
    ],
  })
);

// ── Costmap: 200×200 cells at 1 Hz ──
add('/local_costmap/costmap', 'nav_msgs/msg/OccupancyGrid');
const CW = 200;
const costs = new Int8Array(CW * CW).map((_, i) => ((i % CW) * (i / CW)) % 101);
every(1, () =>
  send('/local_costmap/costmap', {
    header: { stamp: stamp(), frame_id: 'odom' },
    info: {
      map_load_time: stamp(),
      resolution: 0.05,
      width: CW,
      height: CW,
      origin: { position: { x: -5, y: -5, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
    },
    data: costs,
  })
);

// ── /rosout, in the shape of the nav2 / pick-and-place logs seen on the robot ──
add('/rosout', 'rcl_interfaces/msg/Log');
const NODES = [
  'pick_perception',
  'manipulation_perception',
  'pickplace_state_machine',
  'bt_navigator',
  'controller_server',
];
let seq = 0;
every(LOG_HZ, () => {
  const name = NODES[seq % NODES.length];
  send('/rosout', {
    stamp: stamp(),
    level: seq % 50 === 0 ? 30 : 20,
    name,
    msg: `frame: uv=(${seq % 640}, ${seq % 480}) point=[0.298, 0.002, 0.525] seq=${seq} window=5`,
    file: `/ws/src/${name}/node.py`,
    function: 'tick',
    line: 42,
  });
  seq += 1;
});

setInterval(() => {
  const report = Object.entries(channels)
    .filter(([, c]) => c.active)
    .map(([topic, c]) => `${topic} ${c.sent}${c.dropped ? `(-${c.dropped})` : ''}`)
    .join('  ');
  if (report) console.log(`sent/5s  ${report}`);
  Object.values(channels).forEach((c) => (c.sent = c.dropped = 0));
}, 5000);

http
  .createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        Object.fromEntries(Object.entries(channels).map(([topic, c]) => [topic, c.total]))
      )
    );
  })
  .listen(PORT + 1);

console.log(
  `heavy bridge on ws://localhost:${PORT}: ${CAMS}× ${WIDTH}×${HEIGHT} rgb8 @ ${CAM_HZ} Hz, ` +
    `${POINTS} points @ ${CLOUD_HZ} Hz, TF @ ${TF_HZ} Hz, /rosout @ ${LOG_HZ}/s`
);
