#!/usr/bin/env node
/**
 * Writes src/lib/bridge/__tests__/fixtures/cdr-messages.json, which MITI's CDR tests compare with:
 * sample messages of the types MITI shows, with
 *   - the bytes and decoded objects of Foxglove's ROS libraries, which MITI used before its own;
 *   - the bytes ROS 2 itself serializes, with Fast DDS and Cyclone DDS, and how Foxglove decoded them.
 *
 * MITI no longer depends on the Foxglove libraries; to run this again, install them without saving,
 * in a shell with ROS 2 (e.g. `pixi shell -e humble`):
 *
 *   npm install --no-save @foxglove/rosmsg@5 @foxglove/rosmsg2-serialization@3 @foxglove/cdr@3
 *   node scripts/cdr-fixtures/generate.js
 *
 * ROS 2 only serializes here (rclpy's serialize_message); nothing joins a ROS graph. The domain is
 * still a private one with localhost-only discovery.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CdrWriter, EncapsulationKind } = require('@foxglove/cdr');
const { parse } = require('@foxglove/rosmsg');
const { MessageReader, MessageWriter } = require('@foxglove/rosmsg2-serialization');

const OUT = path.join(__dirname, '../../src/lib/bridge/__tests__/fixtures/cdr-messages.json');
const RMWS = (process.env.RMWS ?? 'rmw_fastrtps_cpp,rmw_cyclonedds_cpp').split(',');
const PYTHON = process.env.PYTHON ?? 'python3';

// ── Values ──

const header = (sec, frame_id) => ({ stamp: { sec, nanosec: 123456789 }, frame_id });
const pose = (x, y, z, w = 1) => ({
  position: { x, y, z },
  orientation: { x: 0, y: 0, z: Math.sqrt(1 - w * w), w },
});
const covariance = (n) => Array.from({ length: n }, (_, i) => (i % 7 === 0 ? 0.25 : 0));
const bytes = (n, seed = 1) => Array.from({ length: n }, (_, i) => (i * 37 + seed) & 255);

/** Float32 data as bytes, little-endian, as PointCloud2 carries it. */
function float32Bytes(values) {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((value, i) => view.setFloat32(i * 4, value, true));
  return Array.from(out);
}

/** Messages of the types MITI shows and some others, as ROS 2 defines them. */
const ROS_CASES = [
  {
    type: 'sensor_msgs/msg/Image',
    message: {
      header: header(1700000000, 'camera_optical'),
      height: 2,
      width: 3,
      encoding: 'rgb8',
      is_bigendian: 0,
      step: 9,
      data: bytes(18),
    },
  },
  {
    type: 'sensor_msgs/msg/CompressedImage',
    message: {
      header: header(5, 'camera'),
      format: 'rgb8; jpeg compressed bgr8',
      data: [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9],
    },
  },
  {
    type: 'sensor_msgs/msg/PointCloud2',
    message: {
      header: header(7, 'lidar'),
      height: 1,
      width: 3,
      fields: [
        { name: 'x', offset: 0, datatype: 7, count: 1 },
        { name: 'y', offset: 4, datatype: 7, count: 1 },
        { name: 'z', offset: 8, datatype: 7, count: 1 },
        { name: 'intensity', offset: 12, datatype: 7, count: 1 },
      ],
      is_bigendian: false,
      point_step: 16,
      row_step: 48,
      data: float32Bytes([1, 2, 3, 0.5, -1.5, 0.25, 8, 1, NaN, Infinity, -0, 255]),
      is_dense: false,
    },
  },
  {
    type: 'sensor_msgs/msg/LaserScan',
    message: {
      header: header(9, 'laser'),
      angle_min: -1.5,
      angle_max: 1.5,
      angle_increment: 0.75,
      time_increment: 0.000125,
      scan_time: 0.1,
      range_min: 0.05,
      range_max: 30,
      ranges: [1, 2.5, Infinity, NaN, 0.125],
      intensities: [],
    },
  },
  {
    type: 'sensor_msgs/msg/CameraInfo',
    message: {
      header: header(11, 'camera_optical'),
      height: 720,
      width: 1280,
      distortion_model: 'plumb_bob',
      d: [-0.28, 0.07, 0.0002, 0.00002, 0],
      k: [910.5, 0, 640.25, 0, 910.5, 360.75, 0, 0, 1],
      r: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      p: [910.5, 0, 640.25, 0, 0, 910.5, 360.75, 0, 0, 0, 1, 0],
      binning_x: 0,
      binning_y: 2,
      roi: { x_offset: 4, y_offset: 8, height: 100, width: 200, do_rectify: true },
    },
  },
  {
    type: 'sensor_msgs/msg/JointState',
    message: {
      header: header(13, ''),
      name: ['left_hip_pitch', 'left_knee', 'waist_yaw'],
      position: [0.1, -0.2, 0.3],
      velocity: [],
      effort: [1.5, 0, -2.25],
    },
  },
  {
    type: 'sensor_msgs/msg/Imu',
    message: {
      header: header(15, 'imu_link'),
      orientation: { x: 0.1, y: 0.2, z: 0.3, w: 0.927 },
      orientation_covariance: covariance(9),
      angular_velocity: { x: 0.01, y: -0.02, z: 0.03 },
      angular_velocity_covariance: covariance(9),
      linear_acceleration: { x: 0, y: 0, z: 9.81 },
      linear_acceleration_covariance: [-1, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    type: 'nav_msgs/msg/OccupancyGrid',
    message: {
      header: header(17, 'map'),
      info: {
        map_load_time: { sec: 16, nanosec: 5 },
        resolution: 0.05,
        width: 4,
        height: 3,
        origin: pose(-10, -5, 0),
      },
      data: [0, 100, -1, 50, 0, 0, -1, -1, 100, 100, 0, 1],
    },
  },
  {
    type: 'nav_msgs/msg/Path',
    message: {
      header: header(19, 'map'),
      poses: [
        { header: header(19, 'map'), pose: pose(1, 2, 0) },
        { header: header(20, 'map'), pose: pose(1.5, 2.5, 0, 0.6) },
      ],
    },
  },
  {
    type: 'nav_msgs/msg/Odometry',
    message: {
      header: header(21, 'odom'),
      child_frame_id: 'base_link',
      pose: { pose: pose(3, 4, 0.1, 0.8), covariance: covariance(36) },
      twist: {
        twist: { linear: { x: 0.5, y: 0, z: 0 }, angular: { x: 0, y: 0, z: -0.25 } },
        covariance: covariance(36),
      },
    },
  },
  {
    type: 'tf2_msgs/msg/TFMessage',
    message: {
      transforms: [
        {
          header: header(23, 'odom'),
          child_frame_id: 'base_link',
          transform: {
            translation: { x: 1, y: 2, z: 0 },
            rotation: { x: 0, y: 0, z: 0.6, w: 0.8 },
          },
        },
        {
          header: header(23, 'base_link'),
          child_frame_id: 'torso_link',
          transform: { translation: { x: 0, y: 0, z: 0.4 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
        },
      ],
    },
  },
  {
    type: 'visualization_msgs/msg/Marker',
    message: {
      header: header(25, 'map'),
      ns: 'path',
      id: 7,
      type: 4,
      action: 0,
      pose: pose(0, 0, 0),
      scale: { x: 0.05, y: 0, z: 0 },
      color: { r: 1, g: 0.5, b: 0, a: 1 },
      lifetime: { sec: 2, nanosec: 500000000 },
      frame_locked: true,
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      colors: [{ r: 0, g: 1, b: 0, a: 0.75 }],
      text: 'path ✓',
    },
  },
  {
    type: 'visualization_msgs/msg/MarkerArray',
    message: {
      markers: [
        {
          header: header(27, 'map'),
          ns: 'labels',
          id: 1,
          type: 9,
          pose: pose(1, 2, 3),
          scale: { x: 0, y: 0, z: 0.2 },
          color: { r: 1, g: 1, b: 1, a: 1 },
          text: 'สวัสดี',
        },
        { header: header(27, 'map'), ns: 'labels', id: 2, action: 3 },
      ],
    },
  },
  {
    type: 'geometry_msgs/msg/PoseStamped',
    message: { header: header(29, 'map'), pose: pose(1, -2, 0.5, 0.6) },
  },
  {
    type: 'geometry_msgs/msg/PoseArray',
    message: { header: header(31, 'map'), poses: [pose(1, 0, 0), pose(0, 1, 0, 0.8)] },
  },
  {
    type: 'geometry_msgs/msg/PoseWithCovarianceStamped',
    message: {
      header: header(33, 'map'),
      pose: { pose: pose(2, 2, 0), covariance: covariance(36) },
    },
  },
  {
    type: 'geometry_msgs/msg/PolygonStamped',
    message: {
      header: header(35, 'base_link'),
      polygon: {
        points: [
          { x: -0.5, y: -0.25, z: 0 },
          { x: 0.5, y: -0.25, z: 0 },
          { x: 0.5, y: 0.25, z: 0 },
        ],
      },
    },
  },
  {
    type: 'geometry_msgs/msg/Twist',
    message: { linear: { x: 0.5, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 1.2 } },
  },
  {
    type: 'geometry_msgs/msg/WrenchStamped',
    message: {
      header: header(37, 'wrist'),
      wrench: { force: { x: 1, y: 2, z: 3 }, torque: { x: -0.1, y: 0, z: 0.1 } },
    },
  },
  {
    type: 'rcl_interfaces/msg/Log',
    message: {
      stamp: { sec: 39, nanosec: 1 },
      level: 30,
      name: 'controller_manager',
      msg: 'Joint ×3 over limit — ข้อต่อเกินขีดจำกัด',
      file: '/opt/ros/humble/src/controller_manager.cpp',
      function: 'update',
      line: 1234,
    },
  },
  { type: 'std_msgs/msg/String', message: { data: '' } },
  { type: 'std_msgs/msg/Bool', message: { data: true } },
  { type: 'std_msgs/msg/Empty', message: {} },
  { type: 'std_msgs/msg/Int64', message: { data: -(2n ** 63n) } },
  { type: 'std_msgs/msg/UInt64', message: { data: 2n ** 64n - 1n } },
  { type: 'std_msgs/msg/Int8', message: { data: -128 } },
  {
    type: 'std_msgs/msg/Float64MultiArray',
    message: {
      layout: { dim: [{ label: 'rows', size: 2, stride: 4 }], data_offset: 1 },
      data: [-0, 1.5, Number.MAX_VALUE, Number.MIN_VALUE],
    },
  },
  {
    type: 'diagnostic_msgs/msg/DiagnosticArray',
    message: {
      header: header(41, ''),
      status: [
        {
          level: 1,
          name: 'battery',
          message: 'low',
          hardware_id: 'bms0',
          values: [
            { key: 'voltage', value: '22.1' },
            { key: 'cells', value: '6' },
          ],
        },
        { level: 0, name: 'motors', message: 'ok', hardware_id: '', values: [] },
      ],
    },
  },
  {
    type: 'trajectory_msgs/msg/JointTrajectory',
    message: {
      header: header(43, 'base_link'),
      joint_names: ['shoulder', 'elbow'],
      points: [
        {
          positions: [0, 0.5],
          velocities: [],
          accelerations: [],
          effort: [],
          time_from_start: { sec: 0, nanosec: 0 },
        },
        {
          positions: [0.25, 1],
          velocities: [0.1, 0.2],
          accelerations: [],
          effort: [3],
          time_from_start: { sec: 1, nanosec: 500000000 },
        },
      ],
    },
  },
  {
    type: 'sensor_msgs/msg/NavSatFix',
    message: {
      header: header(45, 'gps'),
      status: { status: -1, service: 1 },
      latitude: 13.7563,
      longitude: 100.5018,
      altitude: -12.5,
      position_covariance: covariance(9),
      position_covariance_type: 2,
    },
  },
  {
    type: 'sensor_msgs/msg/BatteryState',
    message: {
      header: header(47, 'battery'),
      voltage: 22.25,
      percentage: 0.5,
      power_supply_status: 2,
      present: true,
      cell_voltage: [3.75, 3.5, NaN],
      cell_temperature: [],
      location: 'rear',
      serial_number: 'SN-01',
    },
  },
  { type: 'std_srvs/srv/SetBool_Request', message: { data: true } },
  { type: 'std_srvs/srv/SetBool_Response', message: { success: false, message: 'busy' } },
];

const SEP = '\n' + '='.repeat(80) + '\n';
const TIME = 'MSG: builtin_interfaces/Time\nint32 sec\nuint32 nanosec';

/** A custom type with nested arrays, defaults and constants; only Foxglove's libraries read it. */
const NESTED_SCHEMA = [
  [
    '# A custom type with nested arrays',
    'uint8 MODE_A=1',
    'int64 BIG=-9223372036854775808',
    'string GREETING="hello # not a comment" # a comment',
    "string NAME='MITI'",
    'float64 RATIO=0.5',
    'bool ON=True',
    'Inner[] inners',
    'Inner[2] pair',
    'Inner[<=3] bounded',
    'string<=10 short_name',
    'string[] names',
    'string[2] fixed_names ["a", "b,c"]',
    'int64[] big',
    'uint64[3] ubig',
    'bool[] flags',
    'bool[2] fixed_flags [true, false]',
    'float32[] f32',
    'float64[3] f64 [1.5, -2.5, 3e2]',
    'int16[] i16',
    'uint16 u16 7',
    'int32[] i32 # unbounded',
    'uint32[<=4] u32',
    'byte b',
    'char c 65',
    'builtin_interfaces/Time[] stamps',
    'builtin_interfaces/Duration wait',
    'int8 i8 -3',
    'uint64 u64 18446744073709551615',
    'float32 f 0.25',
  ].join('\n'),
  [
    'MSG: miti_test/Inner',
    'int32 id 42',
    'float32[] values',
    'Leaf[] leaves',
    "string label 'default label'",
  ].join('\n'),
  [
    'MSG: miti_test/Leaf',
    'uint8[] bytes',
    'float64[2] point [1.5, -2.5]',
    'int64 stamp',
    'string[] tags',
  ].join('\n'),
  TIME,
  'MSG: builtin_interfaces/Duration\nint32 sec\nuint32 nanosec',
].join(SEP);

const leaf = (n) => ({
  bytes: new Uint8Array(bytes(n, n)),
  point: new Float64Array([n, -n]),
  stamp: BigInt(n) * 1000000000n,
  tags: Array.from({ length: n % 3 }, (_, i) => `tag${i}`),
});
const inner = (id, leaves) => ({
  id,
  values: new Float32Array([id, id / 2, -id]),
  leaves: Array.from({ length: leaves }, (_, i) => leaf(i + 1)),
  label: `inner ${id}`,
});

const CUSTOM_CASES = [
  {
    key: 'miti_test/msg/Nested',
    type: 'miti_test/msg/Nested',
    schema: NESTED_SCHEMA,
    message: {
      inners: [inner(1, 2), inner(2, 0), inner(3, 3)],
      pair: [inner(4, 1), inner(5, 0)],
      bounded: [inner(6, 1)],
      short_name: 'robot',
      names: ['α', '', 'base_link'],
      fixed_names: ['x', 'y'],
      big: new BigInt64Array([-(2n ** 63n), 0n, 2n ** 63n - 1n]),
      ubig: new BigUint64Array([0n, 1n, 2n ** 64n - 1n]),
      flags: [true, false, true],
      fixed_flags: [false, true],
      f32: new Float32Array([0.5, -0, NaN, Infinity]),
      f64: [1, 2, 3],
      i16: new Int16Array([-32768, 32767, 0]),
      u16: 65535,
      i32: [],
      u32: new Uint32Array([4294967295, 1]),
      b: 255,
      c: 66,
      stamps: [
        { sec: 1, nanosec: 2 },
        { sec: -1, nanosec: 4294967295 },
      ],
      wait: { sec: 3, nanosec: 4 },
      i8: 127,
      u64: 5n,
      f: -1.75,
    },
  },
  // Every field left out: defaults, and zeros where there are none.
  {
    key: 'miti_test/msg/Nested (defaults)',
    type: 'miti_test/msg/Nested',
    schema: NESTED_SCHEMA,
    message: { stamps: [] },
  },
  {
    key: 'miti_test/msg/Alignment',
    type: 'miti_test/msg/Alignment',
    schema: [
      'uint8 a',
      'float64[] empty_doubles',
      'uint8 b',
      'int64[] empty_longs',
      'uint16 c',
      'float64[] doubles',
      'uint8 d',
      'int16[] shorts',
      'bool e',
      'float64 f',
      'string[] empty_strings',
      'uint8 g',
    ].join('\n'),
    message: {
      a: 1,
      empty_doubles: [],
      b: 2,
      empty_longs: [],
      c: 3,
      doubles: [4.5],
      d: 5,
      shorts: [-6, 7],
      e: true,
      f: 8.25,
      empty_strings: [],
      g: 9,
    },
  },
];

/** Big-endian and CDR2 data, written field by field, that Foxglove's reader decodes. */
const BYTE_ORDER_SCHEMA = [
  'int16 a',
  'float64 b',
  'uint32[] c',
  'string d',
  'float32[] e',
  'int64 f',
  'uint64[] g',
  'Point p',
  SEP + 'MSG: geometry_msgs/Point\nfloat64 x\nfloat64 y\nfloat64 z',
].join('\n');

function writeByteOrder(kind) {
  const writer = new CdrWriter({ kind });
  writer.int16(-2);
  writer.float64(3.5);
  writer.sequenceLength(3);
  writer.uint32Array([1, 0xdeadbeef, 3]);
  writer.string('grüße');
  writer.sequenceLength(12);
  writer.float32Array(Array.from({ length: 12 }, (_, i) => i / 4 - 1));
  writer.int64(-1234567890123n);
  writer.sequenceLength(2);
  writer.uint64Array([1n, 2n ** 64n - 2n]);
  writer.float64(1);
  writer.float64(-2);
  writer.float64(0.5);
  return writer.data;
}

const BYTE_ORDER_CASES = [
  ['big-endian CDR', EncapsulationKind.CDR_BE],
  ['big-endian CDR2', EncapsulationKind.RTPS_CDR2_BE],
  ['little-endian CDR2', EncapsulationKind.RTPS_CDR2_LE],
].map(([name, kind]) => ({
  key: `miti_test/msg/ByteOrder (${name})`,
  type: 'miti_test/msg/ByteOrder',
  schema: BYTE_ORDER_SCHEMA,
  cdr: writeByteOrder(kind),
}));

// ── Fixture encoding: what JSON cannot hold is tagged ──

const hex = (data) => Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex');

function tag(value) {
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { $number: 'NaN' };
    if (value === Infinity) return { $number: 'Infinity' };
    if (value === -Infinity) return { $number: '-Infinity' };
    if (Object.is(value, -0)) return { $number: '-0' };
    return value;
  }
  if (ArrayBuffer.isView(value))
    return {
      $typed: value.constructor.name,
      base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64'),
    };
  if (Array.isArray(value)) return value.map(tag);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tag(v)]));
  return value;
}

/** An object without its undefined properties. */
const present = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));

/** Foxglove's parsed definitions, for comparing MITI's parser with. */
const definitionsOf = (schema) =>
  parse(schema, { ros2: true }).map(({ name, definitions }) =>
    present({
      name,
      fields: definitions
        .filter((field) => !field.isConstant)
        .map((field) =>
          present({
            name: field.name,
            type: field.type,
            isComplex: field.isComplex || undefined,
            isArray: field.isArray || undefined,
            arrayLength: field.arrayLength,
            arrayUpperBound: field.arrayUpperBound,
            upperBound: field.upperBound,
            defaultValue: field.defaultValue === undefined ? undefined : tag(field.defaultValue),
          })
        ),
      constants: definitions
        .filter((field) => field.isConstant)
        .map((field) => ({
          name: field.name,
          type: field.type,
          value: tag(field.value),
          valueText: field.valueText,
        })),
    })
  );

/** JSON with objects of plain values on one line, which Prettier then keeps when they fit. */
function stringify(value, indent = '') {
  const inner = indent + '  ';
  const flat = (v) => v === null || typeof v !== 'object' || (Array.isArray(v) && v.every(flat));
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (value.every(flat)) return JSON.stringify(value);
    return `[\n${value.map((v) => inner + stringify(v, inner)).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    if (entries.every(([, v]) => flat(v)))
      return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
    const lines = entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${stringify(v, inner)}`);
    return `{\n${lines.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function rosSerialize(samples) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'miti-cdr-')), 'samples.json');
  fs.writeFileSync(file, JSON.stringify(samples.map((s) => ({ ...s, message: tag(s.message) }))));
  const byRmw = {};
  for (const rmw of RMWS) {
    const result = spawnSync(PYTHON, [path.join(__dirname, 'ros_messages.py'), file], {
      encoding: 'utf8',
      maxBuffer: 64e6,
      env: {
        ...process.env,
        RMW_IMPLEMENTATION: rmw,
        ROS_DOMAIN_ID: String(100 + Math.floor(Math.random() * 100)),
        ROS_LOCALHOST_ONLY: '1',
        ROS_AUTOMATIC_DISCOVERY_RANGE: 'LOCALHOST',
      },
    });
    if (result.status !== 0) throw new Error(`${rmw}: ${result.stderr}`);
    byRmw[rmw] = JSON.parse(result.stdout);
  }
  return byRmw;
}

function main() {
  const rosSamples = ROS_CASES.map((c) => ({ key: c.type, type: c.type, message: c.message }));
  const ros = rosSerialize(rosSamples);
  /** Each type's schema once, as the bridge advertises it, with Foxglove's parse of it. */
  const types = {};
  const addType = (type, schema) => {
    types[type] ??= { schema, definitions: definitionsOf(schema) };
    if (types[type].schema !== schema) throw new Error(`Two schemas for ${type}`);
    return parse(schema, { ros2: true });
  };
  const cases = [];
  const sameAsRos = [];
  for (const sample of [...rosSamples, ...CUSTOM_CASES]) {
    const definitions = addType(sample.type, sample.schema ?? ros[RMWS[0]][sample.key].schema);
    const writer = new MessageWriter(definitions);
    const reader = new MessageReader(definitions);
    const cdr = writer.writeMessage(sample.message);
    const decoded = reader.readMessage(cdr);
    if (hex(writer.writeMessage(decoded)) !== hex(cdr))
      throw new Error(`${sample.key}: decoded message encodes differently`);
    const entry = {
      key: sample.key,
      type: sample.type,
      message: tag(sample.message),
      cdr: hex(cdr),
      decoded: tag(decoded),
    };
    if (!sample.schema) {
      entry.ros = {};
      for (const rmw of RMWS) {
        const bytes = Buffer.from(ros[rmw][sample.key].cdr, 'hex');
        // How Foxglove decoded ROS 2's bytes, kept only where it differs from `decoded`.
        const fromRos = tag(reader.readMessage(bytes));
        entry.ros[rmw] = { cdr: bytes.toString('hex') };
        if (JSON.stringify(fromRos) !== JSON.stringify(entry.decoded))
          entry.ros[rmw].decoded = fromRos;
        if (bytes.toString('hex') === entry.cdr) sameAsRos.push(`${sample.key} ${rmw}`);
      }
    }
    cases.push(entry);
  }
  for (const sample of BYTE_ORDER_CASES) {
    const reader = new MessageReader(addType(sample.type, sample.schema));
    cases.push({
      key: sample.key,
      type: sample.type,
      cdr: hex(sample.cdr),
      decoded: tag(reader.readMessage(sample.cdr)),
    });
  }
  const versions = Object.fromEntries(
    ['@foxglove/rosmsg', '@foxglove/rosmsg2-serialization', '@foxglove/cdr'].map((name) => [
      name,
      JSON.parse(fs.readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version,
    ])
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const fixture = {
    generatedBy: 'scripts/cdr-fixtures/generate.js',
    versions,
    rmws: RMWS,
    types,
    cases,
  };
  fs.writeFileSync(OUT, stringify(fixture) + '\n');
  spawnSync('npx', ['prettier', '--write', OUT], { stdio: 'inherit' });
  console.log(`${cases.length} cases written to ${path.relative(process.cwd(), OUT)}`);
  console.log(
    `Foxglove's bytes equal ROS 2's for ${sameAsRos.length} of ${rosSamples.length * RMWS.length}`
  );
}

main();
