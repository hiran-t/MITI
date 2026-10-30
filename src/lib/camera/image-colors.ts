/**
 * Coloring for single-channel images (depth and mono), as in Foxglove's Image panel: a two-color
 * gradient or a color map between Value min and Value max. The panel's shader looks colors up in
 * `colorLut`; `colorAt` is the same mapping on the CPU.
 */
import type { sensor_msgs } from '@/types/ros-messages';
import { decodeBytes } from '@/lib/parsers/bytes';
import { COLOR_MAPS, parseHex, type ColorMapName } from '@/lib/scene/colors';

export type ImageColorMode = 'gradient' | 'colormap';

export interface ImageColorSettings {
  colorMode: ImageColorMode;
  colorMap: ColorMapName;
  gradient: [string, string];
  /** undefined takes the image's own range, frame by frame. */
  valueMin?: number;
  valueMax?: number;
}

export const DEFAULT_IMAGE_GRADIENT: [string, string] = ['#000000', '#ffffff'];
export const LUT_SIZE = 256;

const SCALAR_BYTES: Record<string, number> = {
  mono8: 1,
  '8uc1': 1,
  mono16: 2,
  '16uc1': 2,
  '32fc1': 4,
  depth: 4,
};

/** Encodings drawn through Color mode rather than as color pixels. */
export const isScalarEncoding = (encoding: string) => encoding.toLowerCase() in SCALAR_BYTES;

/** Depth encodings use 0 (and NaN) for "no reading"; such pixels are left undrawn. */
export const isDepthEncoding = (encoding: string) =>
  ['16uc1', '32fc1', 'depth'].includes(encoding.toLowerCase());

export interface ScalarImage {
  /** One value per pixel, row by row. */
  values: Float32Array<ArrayBuffer>;
  width: number;
  height: number;
  /** Range of the valid values; [0, 1] when none are valid. */
  min: number;
  max: number;
  /** Zero means "no reading" (depth images). */
  zeroInvalid: boolean;
}

const valid = (value: number, zeroInvalid: boolean) =>
  Number.isFinite(value) && !(zeroInvalid && value === 0);

/** Read a mono or depth image's values, honoring row padding (`step`) and `is_bigendian`. */
export function decodeScalarImage(msg: sensor_msgs.Image): ScalarImage {
  const { width, height } = msg;
  const encoding = msg.encoding.toLowerCase();
  const bpp = SCALAR_BYTES[encoding];
  if (!bpp) throw new Error(`${msg.encoding} is not a single-channel encoding`);
  if (!msg.data || msg.data.length === 0) throw new Error('Image data is empty');
  const bytes = decodeBytes(msg.data);
  const step = msg.step || width * bpp;
  if (step < width * bpp || bytes.length < step * (height - 1) + width * bpp)
    throw new Error(`Image data is too short for ${width}×${height} ${msg.encoding}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = !msg.is_bigendian;
  const read =
    bpp === 1
      ? (offset: number) => bytes[offset]
      : bpp === 2
        ? (offset: number) => view.getUint16(offset, little)
        : (offset: number) => view.getFloat32(offset, little);
  const zeroInvalid = isDepthEncoding(encoding);
  const values = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;
  for (let row = 0, i = 0; row < height; row++)
    for (let col = 0, offset = row * step; col < width; col++, offset += bpp, i++) {
      const value = read(offset);
      values[i] = value;
      if (!valid(value, zeroInvalid)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  return min <= max
    ? { values, width, height, min, max, zeroInvalid }
    : { values, width, height, min: 0, max: 1, zeroInvalid };
}

/** Value min and max: fixed where set, else the image's own range. */
export function valueRange(
  image: { min: number; max: number },
  { valueMin, valueMax }: Pick<ImageColorSettings, 'valueMin' | 'valueMax'>
): [number, number] {
  const min = valueMin ?? image.min;
  const max = valueMax ?? image.max;
  return [min, max === min ? min + 1 : max];
}

/** RGBA bytes for t = 0…1 in `LUT_SIZE` steps. */
export function colorLut(settings: ImageColorSettings): Uint8Array<ArrayBuffer> {
  const lut = new Uint8Array(LUT_SIZE * 4);
  const [a, b] = settings.gradient.map(parseHex);
  const map = COLOR_MAPS[settings.colorMap] ?? COLOR_MAPS.turbo;
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    const rgba =
      settings.colorMode === 'colormap'
        ? [...map(t), 1]
        : [0, 1, 2, 3].map((c) => a[c] + (b[c] - a[c]) * t);
    rgba.forEach((value, c) => (lut[i * 4 + c] = Math.round(value * 255)));
  }
  return lut;
}

/** The color a value gets, or null for invalid values (drawn as background). */
export function colorAt(
  value: number,
  [min, max]: [number, number],
  lut: Uint8Array,
  zeroInvalid: boolean
): [number, number, number, number] | null {
  if (!valid(value, zeroInvalid)) return null;
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const i = Math.round(t * (LUT_SIZE - 1)) * 4;
  return [lut[i], lut[i + 1], lut[i + 2], lut[i + 3]];
}
