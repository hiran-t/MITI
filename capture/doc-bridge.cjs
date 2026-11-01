// A stand-in foxglove_bridge with a small robot, its TF, a lidar cloud, a map and a cloud in a
// frame TF does not join (FAST-LIO's camera_init), for documentation screenshots.
//   NODE_PATH=<MITI>/node_modules node doc-bridge.cjs [port] [lag]
// With "lag", /tf is stamped 1 s in the past, so synced topics report "TF is too old".
const { WebSocketServer } = require('ws');
const { FoxgloveServer } = require('@foxglove/ws-protocol');
const { parse } = require('@foxglove/rosmsg');
const { MessageWriter } = require('@foxglove/rosmsg2-serialization');
const port = Number(process.argv[2] ?? 8798);
const lag = process.argv[3] === 'lag' ? 1.0 : 0;
const SEP = '\n================================================================================\n';
const TIME = 'MSG: builtin_interfaces/Time\nint32 sec\nuint32 nanosec';
const HEADER = 'MSG: std_msgs/Header\nbuiltin_interfaces/Time stamp\nstring frame_id';
const VEC = 'MSG: geometry_msgs/Vector3\nfloat64 x\nfloat64 y\nfloat64 z';
const QUAT = 'MSG: geometry_msgs/Quaternion\nfloat64 x\nfloat64 y\nfloat64 z\nfloat64 w';
const POINT = 'MSG: geometry_msgs/Point\nfloat64 x\nfloat64 y\nfloat64 z';
const schemas = {
  'std_msgs/msg/String': 'string data',
  'tf2_msgs/msg/TFMessage': ['geometry_msgs/TransformStamped[] transforms',
    'MSG: geometry_msgs/TransformStamped\nstd_msgs/Header header\nstring child_frame_id\ngeometry_msgs/Transform transform',
    HEADER, TIME, 'MSG: geometry_msgs/Transform\ngeometry_msgs/Vector3 translation\ngeometry_msgs/Quaternion rotation', VEC, QUAT].join(SEP),
  'sensor_msgs/msg/PointCloud2': ['std_msgs/Header header\nuint32 height\nuint32 width\nsensor_msgs/PointField[] fields\nbool is_bigendian\nuint32 point_step\nuint32 row_step\nuint8[] data\nbool is_dense',
    HEADER, TIME, 'MSG: sensor_msgs/PointField\nstring name\nuint32 offset\nuint8 datatype\nuint32 count'].join(SEP),
  'nav_msgs/msg/OccupancyGrid': ['std_msgs/Header header\nnav_msgs/MapMetaData info\nint8[] data', HEADER, TIME,
    'MSG: nav_msgs/MapMetaData\nbuiltin_interfaces/Time map_load_time\nfloat32 resolution\nuint32 width\nuint32 height\ngeometry_msgs/Pose origin',
    'MSG: geometry_msgs/Pose\ngeometry_msgs/Point position\ngeometry_msgs/Quaternion orientation', POINT, QUAT].join(SEP),
};
const writers = Object.fromEntries(Object.entries(schemas).map(([k, s]) => [k, new MessageWriter(parse(s, { ros2: true }))]));

const URDF = `<?xml version="1.0"?>
<robot name="demo_rover">
  <material name="body"><color rgba="0.82 0.84 0.87 1"/></material>
  <material name="dark"><color rgba="0.16 0.17 0.19 1"/></material>
  <material name="teal"><color rgba="0.18 0.71 0.77 1"/></material>
  <link name="base_link"><visual><origin xyz="0 0 0.2"/><geometry><box size="0.7 0.48 0.2"/></geometry><material name="body"/></visual></link>
  ${[['fl', 0.22, 0.27], ['fr', 0.22, -0.27], ['rl', -0.22, 0.27], ['rr', -0.22, -0.27]].map(([n, x, y]) => `
  <link name="wheel_${n}"><visual><origin rpy="1.5708 0 0"/><geometry><cylinder radius="0.11" length="0.07"/></geometry><material name="dark"/></visual></link>
  <joint name="wheel_${n}_joint" type="fixed"><parent link="base_link"/><child link="wheel_${n}"/><origin xyz="${x} ${y} 0.11"/></joint>`).join('')}
  <link name="mast"><visual><origin xyz="0 0 0.08"/><geometry><box size="0.12 0.12 0.16"/></geometry><material name="dark"/></visual></link>
  <joint name="mast_joint" type="fixed"><parent link="base_link"/><child link="mast"/><origin xyz="0.12 0 0.3"/></joint>
  <link name="laser_link"><visual><geometry><cylinder radius="0.06" length="0.07"/></geometry><material name="teal"/></visual></link>
  <joint name="laser_joint" type="fixed"><parent link="mast"/><child link="laser_link"/><origin xyz="0 0 0.2"/></joint>
</robot>`;

// The world in map: walls of a room and a few shelves.
const ROBOT = { x: 1.6, y: 0.9, yaw: 0.45 }, ODOM = { x: 0.2, y: 0.1, yaw: 0 };
const LASER_Z = 0.5;
const pts = [];
const wall = (x1, y1, x2, y2, h = 2.0) => {
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.round(len / 0.07);
  for (let i = 0; i <= n; i++) for (let z = 0.05; z < h; z += 0.16)
    pts.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, z]);
};
const boxAt = (x, y, w, d, h) => { wall(x, y, x + w, y, h); wall(x + w, y, x + w, y + d, h); wall(x + w, y + d, x, y + d, h); wall(x, y + d, x, y, h); };
wall(-4, -3.5, 8, -3.5); wall(8, -3.5, 8, 5); wall(8, 5, -4, 5); wall(-4, 5, -4, -3.5);
boxAt(4.2, 2.4, 2.4, 0.8, 1.6); boxAt(4.2, -2.6, 2.4, 0.8, 1.6); boxAt(-2.8, 1.8, 0.9, 1.6, 1.1); boxAt(0.6, 3.6, 1.2, 0.6, 0.8);
// map → laser_link: laser = R(-yaw)(p - t)
const yaw = ROBOT.yaw + ODOM.yaw, tx = ODOM.x + ROBOT.x * Math.cos(ODOM.yaw) - ROBOT.y * Math.sin(ODOM.yaw), ty = ODOM.y + ROBOT.x * Math.sin(ODOM.yaw) + ROBOT.y * Math.cos(ODOM.yaw);
const laserX = 0.12, laserZ = LASER_Z;
function cloud(frame, points, stamp) {
  const step = 16, buf = Buffer.alloc(points.length * step);
  points.forEach(([x, y, z, i], k) => { buf.writeFloatLE(x, k * step); buf.writeFloatLE(y, k * step + 4); buf.writeFloatLE(z, k * step + 8); buf.writeFloatLE(i, k * step + 12); });
  return { header: { stamp, frame_id: frame }, height: 1, width: points.length,
    fields: [['x', 0], ['y', 4], ['z', 8], ['intensity', 12]].map(([name, offset]) => ({ name, offset, datatype: 7, count: 1 })),
    is_bigendian: false, point_step: step, row_step: buf.length, data: buf, is_dense: true };
}
const lidarPoints = pts.map(([x, y, z]) => {
  const dx = x - tx, dy = y - ty, c = Math.cos(-yaw), s = Math.sin(-yaw);
  return [c * dx - s * dy - laserX, s * dx + c * dy, z - laserZ, 20 + 80 * (z / 2)];
});
const fastlioPoints = [];
for (let i = 0; i < 4000; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 2; fastlioPoints.push([r * Math.cos(a), r * Math.sin(a), Math.random() * 1.5, 50]); }

// Occupancy grid of the room.
const RES = 0.05, OX = -5, OY = -4.5, GW = 280, GH = 220, grid = new Int8Array(GW * GH).fill(-1);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const x = OX + i * RES, y = OY + j * RES;
  if (x > -4 && x < 8 && y > -3.5 && y < 5) grid[j * GW + i] = 0;
}
for (const [x, y] of pts) { const i = Math.round((x - OX) / RES), j = Math.round((y - OY) / RES); if (i >= 0 && i < GW && j >= 0 && j < GH) grid[j * GW + i] = 100; }

const q = (a) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
const toStamp = (t) => ({ sec: Math.floor(t), nanosec: Math.round((t % 1) * 1e9) });
const tf = (parent, child, x, y, z, a, stamp) => ({ header: { stamp, frame_id: parent }, child_frame_id: child, transform: { translation: { x, y, z }, rotation: q(a) } });

const server = new FoxgloveServer({ name: 'miti-demo-robot', capabilities: [], supportedEncodings: ['cdr'], metadata: { ROS_DISTRO: 'jazzy' } });
const ch = (topic, schemaName) => server.addChannel({ topic, encoding: 'cdr', schemaName, schema: schemas[schemaName], schemaEncoding: 'ros2msg' });
const C = {
  desc: ch('/robot_description', 'std_msgs/msg/String'), tf: ch('/tf', 'tf2_msgs/msg/TFMessage'), tfs: ch('/tf_static', 'tf2_msgs/msg/TFMessage'),
  points: ch('/points', 'sensor_msgs/msg/PointCloud2'), fastlio: ch('/cloud_registered', 'sensor_msgs/msg/PointCloud2'), map: ch('/map', 'nav_msgs/msg/OccupancyGrid'),
};
const send = (c, type, msg) => server.sendMessage(c, BigInt(Date.now()) * 1_000_000n, writers[type].writeMessage(msg));
const wss = new WebSocketServer({ port, host: '127.0.0.1', handleProtocols: (p) => server.handleProtocols(p) });
wss.on('connection', (conn, req) => server.handleConnection(conn, `${req.socket.remoteAddress}:${req.socket.remotePort}`));
const now = () => Date.now() / 1000;
function latched() {
  send(C.desc, 'std_msgs/msg/String', { data: URDF });
  send(C.tfs, 'tf2_msgs/msg/TFMessage', { transforms: [tf('base_link', 'laser_link', 0.12, 0, LASER_Z, 0, toStamp(now()))] });
  send(C.map, 'nav_msgs/msg/OccupancyGrid', { header: { stamp: toStamp(now()), frame_id: 'map' }, info: { map_load_time: toStamp(now()), resolution: RES, width: GW, height: GH, origin: { position: { x: OX, y: OY, z: 0 }, orientation: q(0) } }, data: grid });
}
server.on('subscribe', () => setTimeout(latched, 100));
setInterval(latched, 1000);
setInterval(() => {
  const s = toStamp(now() - lag);
  send(C.tf, 'tf2_msgs/msg/TFMessage', { transforms: [tf('map', 'odom', ODOM.x, ODOM.y, 0, ODOM.yaw, s), tf('odom', 'base_link', ROBOT.x, ROBOT.y, 0, ROBOT.yaw, s)] });
}, 50);
setInterval(() => {
  send(C.points, 'sensor_msgs/msg/PointCloud2', cloud('laser_link', lidarPoints, toStamp(now())));
  send(C.fastlio, 'sensor_msgs/msg/PointCloud2', cloud('camera_init', fastlioPoints, toStamp(now())));
}, 100);
console.log(`stand-in robot bridge on ws://127.0.0.1:${port}${lag ? ' (TF 1 s late)' : ''}, ${lidarPoints.length} lidar points`);
