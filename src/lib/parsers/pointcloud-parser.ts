import type { sensor_msgs } from '@/types/ros-messages';
import { decodeBytes } from './bytes';
import { getPrepared, type PointScan } from './prepared';

export interface ParsedPoint {
  x: number;
  y: number;
  z: number;
  r?: number;
  g?: number;
  b?: number;
  rgb?: number;
}

// PointField datatypes
const POINTFIELD_DATATYPES: { [key: number]: { size: number; reader: string } } = {
  1: { size: 1, reader: 'getInt8' }, // INT8
  2: { size: 1, reader: 'getUint8' }, // UINT8
  3: { size: 2, reader: 'getInt16' }, // INT16
  4: { size: 2, reader: 'getUint16' }, // UINT16
  5: { size: 4, reader: 'getInt32' }, // INT32
  6: { size: 4, reader: 'getUint32' }, // UINT32
  7: { size: 4, reader: 'getFloat32' }, // FLOAT32
  8: { size: 8, reader: 'getFloat64' }, // FLOAT64
};

export function parsePointCloud2(msg: sensor_msgs.PointCloud2, maxPoints = 200000): ParsedPoint[] {
  const points: ParsedPoint[] = [];

  if (!msg.data || msg.data.length === 0) {
    return points;
  }

  const buffer = decodeBytes(msg.data);
  // CDR decoding returns views into the message buffer, so honour the view's offset.
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Find field offsets
  const fields: { [key: string]: { offset: number; datatype: number } } = {};
  msg.fields.forEach((field) => {
    fields[field.name] = {
      offset: field.offset,
      datatype: field.datatype,
    };
  });

  const numPoints = msg.height * msg.width;
  const pointStep = msg.point_step;

  if (
    !Number.isInteger(msg.width) ||
    !Number.isInteger(msg.height) ||
    msg.width < 0 ||
    msg.height < 0 ||
    !Number.isInteger(pointStep) ||
    pointStep <= 0
  )
    throw new Error('Invalid point cloud dimensions');
  const rowStep = msg.row_step || msg.width * pointStep;
  if (rowStep < msg.width * pointStep || buffer.length < rowStep * msg.height)
    throw new Error('Point cloud buffer is truncated');
  for (const axis of ['x', 'y', 'z']) if (!fields[axis]) throw new Error(`Missing ${axis} field`);
  for (const field of Object.values(fields)) {
    const type = POINTFIELD_DATATYPES[field.datatype];
    if (!type || field.offset < 0 || field.offset + type.size > pointStep)
      throw new Error('Invalid point field');
  }
  const stride = Math.max(1, Math.ceil(numPoints / Math.max(1, maxPoints)));
  for (let i = 0; i < numPoints; i += stride) {
    const pointOffset = Math.floor(i / msg.width) * rowStep + (i % msg.width) * pointStep;
    const point: ParsedPoint = { x: 0, y: 0, z: 0 };

    // Read X, Y, Z
    if (fields['x']) {
      point.x = readField(
        dataView,
        pointOffset + fields['x'].offset,
        fields['x'].datatype,
        msg.is_bigendian
      );
    }
    if (fields['y']) {
      point.y = readField(
        dataView,
        pointOffset + fields['y'].offset,
        fields['y'].datatype,
        msg.is_bigendian
      );
    }
    if (fields['z']) {
      point.z = readField(
        dataView,
        pointOffset + fields['z'].offset,
        fields['z'].datatype,
        msg.is_bigendian
      );
    }

    // Read RGB if available
    const packed = fields['rgb'] ?? fields['rgba'];
    if (packed) {
      if (packed.offset + 4 > pointStep) throw new Error('Invalid packed color field');
      const rgb = dataView.getUint32(pointOffset + packed.offset, !msg.is_bigendian);
      point.rgb = rgb;
      // Extract R, G, B from packed RGB
      point.r = ((rgb >> 16) & 0xff) / 255;
      point.g = ((rgb >> 8) & 0xff) / 255;
      point.b = (rgb & 0xff) / 255;
    } else {
      // Try individual r, g, b fields
      if (fields['r']) {
        point.r =
          readField(
            dataView,
            pointOffset + fields['r'].offset,
            fields['r'].datatype,
            msg.is_bigendian
          ) / (fields['r'].datatype === 2 ? 255 : 1);
      }
      if (fields['g']) {
        point.g =
          readField(
            dataView,
            pointOffset + fields['g'].offset,
            fields['g'].datatype,
            msg.is_bigendian
          ) / (fields['g'].datatype === 2 ? 255 : 1);
      }
      if (fields['b']) {
        point.b =
          readField(
            dataView,
            pointOffset + fields['b'].offset,
            fields['b'].datatype,
            msg.is_bigendian
          ) / (fields['b'].datatype === 2 ? 255 : 1);
      }
    }

    // Skip invalid points (NaN or Inf)
    if (!isFinite(point.x) || !isFinite(point.y) || !isFinite(point.z)) {
      continue;
    }

    points.push(point);
  }

  return points;
}

function readField(
  dataView: DataView,
  offset: number,
  datatype: number,
  isBigEndian: boolean
): number {
  const typeInfo = POINTFIELD_DATATYPES[datatype];
  if (!typeInfo) {
    return 0;
  }

  const littleEndian = !isBigEndian;

  switch (typeInfo.reader) {
    case 'getInt8':
      return dataView.getInt8(offset);
    case 'getUint8':
      return dataView.getUint8(offset);
    case 'getInt16':
      return dataView.getInt16(offset, littleEndian);
    case 'getUint16':
      return dataView.getUint16(offset, littleEndian);
    case 'getInt32':
      return dataView.getInt32(offset, littleEndian);
    case 'getUint32':
      return dataView.getUint32(offset, littleEndian);
    case 'getFloat32':
      return dataView.getFloat32(offset, littleEndian);
    case 'getFloat64':
      return dataView.getFloat64(offset, littleEndian);
    default:
      return 0;
  }
}

/** Points of a cloud or scan in their message frame, with the fields that can color them. */
export interface PointData {
  count: number;
  /** x, y, z per point. */
  positions: Float32Array;
  /** Numeric fields a color map or gradient can use. */
  fields: string[];
  /** Whether the message carries per-point colors. */
  hasColors: boolean;
  /** One value per point, or undefined when the message has no such field. */
  values(field: string): Float32Array | undefined;
  /**
   * r, g, b, a (0–1) per point from packed `rgb`/`rgba` or separate r/g/b/a fields. Packed alpha
   * is read as stored; RGB color mode ignores it, as many drivers leave it 0.
   */
  colors(): Float32Array | undefined;
}

const COLOR_FIELDS = ['rgb', 'rgba', 'r', 'g', 'b', 'a'];

/** Validated fields of a cloud; throws on dimensions or fields that cannot be read. */
function cloudFields(msg: sensor_msgs.PointCloud2) {
  const pointStep = msg.point_step;
  if (
    !Number.isInteger(msg.width) ||
    !Number.isInteger(msg.height) ||
    msg.width < 0 ||
    msg.height < 0 ||
    !Number.isInteger(pointStep) ||
    pointStep <= 0
  )
    throw new Error('Invalid point cloud dimensions');
  const fields = new Map<string, { offset: number; datatype: number }>();
  for (const field of msg.fields ?? []) {
    const type = POINTFIELD_DATATYPES[field.datatype];
    if (!type || field.offset < 0 || field.offset + type.size > pointStep)
      throw new Error('Invalid point field');
    fields.set(field.name, { offset: field.offset, datatype: field.datatype });
  }
  for (const axis of ['x', 'y', 'z'])
    if (!fields.has(axis)) throw new Error(`Missing ${axis} field`);
  return fields;
}

const strideFor = (msg: sensor_msgs.PointCloud2, maxPoints: number) =>
  Math.max(1, Math.ceil((msg.width * msg.height) / Math.max(1, maxPoints)));

/**
 * The positions of every `stride`-th point and where each is in the message's data, skipping
 * points with non-finite coordinates. This is the costly part of reading a cloud; a decode worker
 * runs it ahead of time (see `PreparedMessage`).
 */
export function scanPointCloud(msg: sensor_msgs.PointCloud2, maxPoints = 200000): PointScan {
  const fields = cloudFields(msg);
  const stride = strideFor(msg, maxPoints);
  if (!msg.data || msg.data.length === 0)
    return { stride, count: 0, positions: new Float32Array(0), offsets: new Uint32Array(0) };
  const buffer = decodeBytes(msg.data);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const total = msg.width * msg.height;
  const pointStep = msg.point_step;
  const rowStep = msg.row_step || msg.width * pointStep;
  if (rowStep < msg.width * pointStep || buffer.length < rowStep * msg.height)
    throw new Error('Point cloud buffer is truncated');
  const read = (offset: number, datatype: number) =>
    readField(view, offset, datatype, msg.is_bigendian);
  const capacity = Math.ceil(total / stride);
  const positions = new Float32Array(capacity * 3);
  const offsets = new Uint32Array(capacity);
  const [fx, fy, fz] = ['x', 'y', 'z'].map((axis) => fields.get(axis)!);
  let count = 0;
  for (let i = 0; i < total; i += stride) {
    const base = Math.floor(i / msg.width) * rowStep + (i % msg.width) * pointStep;
    const x = read(base + fx.offset, fx.datatype);
    const y = read(base + fy.offset, fy.datatype);
    const z = read(base + fz.offset, fz.datatype);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    positions[count * 3] = x;
    positions[count * 3 + 1] = y;
    positions[count * 3 + 2] = z;
    offsets[count++] = base;
  }
  return { stride, count, positions: positions.subarray(0, count * 3), offsets };
}

/**
 * Reads a PointCloud2 without building an object per point: positions are read up front and
 * other fields only when a color mode needs them. Points with non-finite coordinates are skipped.
 * A scan prepared by the decode worker for this message is used when it read the same points.
 */
export function readPointCloud(msg: sensor_msgs.PointCloud2, maxPoints = 200000): PointData {
  const fields = cloudFields(msg);
  const hasColors =
    fields.has('rgb') || fields.has('rgba') || ['r', 'g', 'b'].every((c) => fields.has(c));
  if (!msg.data || msg.data.length === 0)
    return {
      count: 0,
      positions: new Float32Array(0),
      fields: numericFields(fields),
      hasColors,
      values: () => undefined,
      colors: () => undefined,
    };
  const prepared = getPrepared(msg)?.cloud;
  const { count, positions, offsets } =
    prepared?.stride === strideFor(msg, maxPoints) ? prepared : scanPointCloud(msg, maxPoints);

  const buffer = decodeBytes(msg.data);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const pointStep = msg.point_step;
  const littleEndian = !msg.is_bigendian;
  const read = (offset: number, datatype: number) =>
    readField(view, offset, datatype, msg.is_bigendian);

  return {
    count,
    positions,
    fields: numericFields(fields),
    hasColors,
    values(name) {
      const field = fields.get(name);
      if (!field) return undefined;
      const out = new Float32Array(count);
      for (let i = 0; i < count; i++) out[i] = read(offsets[i] + field.offset, field.datatype);
      return out;
    },
    colors() {
      const packed = fields.get('rgba') ?? fields.get('rgb');
      const out = new Float32Array(count * 4);
      if (packed) {
        if (packed.offset + 4 > pointStep) throw new Error('Invalid packed color field');
        for (let i = 0; i < count; i++) {
          const v = view.getUint32(offsets[i] + packed.offset, littleEndian);
          out[i * 4] = ((v >>> 16) & 0xff) / 255;
          out[i * 4 + 1] = ((v >>> 8) & 0xff) / 255;
          out[i * 4 + 2] = (v & 0xff) / 255;
          out[i * 4 + 3] = ((v >>> 24) & 0xff) / 255;
        }
        return out;
      }
      const channels = ['r', 'g', 'b', 'a'].map((name) => fields.get(name));
      if (!channels[0] || !channels[1] || !channels[2]) return undefined;
      channels.forEach((field, c) => {
        // 8-bit channels hold 0–255; float channels already hold 0–1.
        const scale = field && field.datatype <= 2 ? 1 / 255 : 1;
        for (let i = 0; i < count; i++)
          out[i * 4 + c] = field ? read(offsets[i] + field.offset, field.datatype) * scale : 1;
      });
      return out;
    },
  };
}

function numericFields(fields: Map<string, unknown>) {
  return Array.from(fields.keys()).filter((name) => !COLOR_FIELDS.includes(name));
}
