import type { sensor_msgs } from '@/types/ros-messages';

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
  1: { size: 1, reader: 'getInt8' },    // INT8
  2: { size: 1, reader: 'getUint8' },   // UINT8
  3: { size: 2, reader: 'getInt16' },   // INT16
  4: { size: 2, reader: 'getUint16' },  // UINT16
  5: { size: 4, reader: 'getInt32' },   // INT32
  6: { size: 4, reader: 'getUint32' },  // UINT32
  7: { size: 4, reader: 'getFloat32' }, // FLOAT32
  8: { size: 8, reader: 'getFloat64' }, // FLOAT64
};

export function parsePointCloud2(msg: sensor_msgs.PointCloud2): ParsedPoint[] {
  const points: ParsedPoint[] = [];
  
  if (!msg.data || msg.data.length === 0) {
    return points;
  }

  // Convert data array to Uint8Array
  const buffer = new Uint8Array(msg.data);
  const dataView = new DataView(buffer.buffer);

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

  for (let i = 0; i < numPoints; i++) {
    const pointOffset = i * pointStep;
    const point: ParsedPoint = { x: 0, y: 0, z: 0 };

    // Read X, Y, Z
    if (fields['x']) {
      point.x = readField(dataView, pointOffset + fields['x'].offset, fields['x'].datatype, msg.is_bigendian);
    }
    if (fields['y']) {
      point.y = readField(dataView, pointOffset + fields['y'].offset, fields['y'].datatype, msg.is_bigendian);
    }
    if (fields['z']) {
      point.z = readField(dataView, pointOffset + fields['z'].offset, fields['z'].datatype, msg.is_bigendian);
    }

    // Read RGB if available
    if (fields['rgb']) {
      const rgb = readField(dataView, pointOffset + fields['rgb'].offset, fields['rgb'].datatype, msg.is_bigendian);
      point.rgb = rgb;
      // Extract R, G, B from packed RGB
      point.r = ((rgb >> 16) & 0xff) / 255;
      point.g = ((rgb >> 8) & 0xff) / 255;
      point.b = (rgb & 0xff) / 255;
    } else {
      // Try individual r, g, b fields
      if (fields['r']) {
        point.r = readField(dataView, pointOffset + fields['r'].offset, fields['r'].datatype, msg.is_bigendian);
      }
      if (fields['g']) {
        point.g = readField(dataView, pointOffset + fields['g'].offset, fields['g'].datatype, msg.is_bigendian);
      }
      if (fields['b']) {
        point.b = readField(dataView, pointOffset + fields['b'].offset, fields['b'].datatype, msg.is_bigendian);
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
