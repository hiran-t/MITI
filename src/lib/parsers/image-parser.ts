/**
 * Image message parser for ROS sensor_msgs/Image
 * Supports various encoding formats including RGB8, BGR8, RGBA8, BGRA8, MONO8, MONO16, and depth formats
 */

import type { sensor_msgs } from '@/types/ros-messages';
import { decodeBytes } from './bytes';
import { getPrepared } from './prepared';

/**
 * Apply RViz-style rainbow colormap (Axis color)
 * Maps a value from 0-1 to a rainbow color similar to RViz visualization
 * Red (far) -> Yellow -> Green -> Cyan -> Blue (near)
 */
function applyRainbowColormap(value: number): { r: number; g: number; b: number } {
  // Clamp value to 0-1 range
  value = Math.max(0, Math.min(1, value));

  // RViz rainbow colormap uses HSV with hue ranging from 0 (red) to 240 (blue)
  // We reverse it so blue is near (0) and red is far (1)
  const hue = (1 - value) * 240; // 240 to 0 (blue to red)

  // Convert HSV to RGB (with full saturation and value)
  const h = hue / 60;
  const c = 1; // chroma (saturation * value)
  const x = c * (1 - Math.abs((h % 2) - 1));

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 1) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 1 && h < 2) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 2 && h < 3) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 3 && h < 4) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 4 && h < 5) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

const BYTES_PER_PIXEL: Record<string, number> = {
  rgb8: 3,
  bgr8: 3,
  rgba8: 4,
  bgra8: 4,
  mono8: 1,
  mono16: 2,
  '16uc1': 2,
  '32fc1': 4,
  depth: 4,
};

/** Reads one scalar per pixel, walking rows by `step` so padded rows stay aligned. */
function readValues(
  width: number,
  height: number,
  step: number,
  bpp: number,
  read: (offset: number) => number
): Float32Array {
  const values = new Float32Array(width * height);
  for (let row = 0, i = 0; row < height; row++)
    for (let col = 0, offset = row * step; col < width; col++, offset += bpp, i++)
      values[i] = read(offset);
  return values;
}

/** Grayscale with histogram stretching, so dim mono images remain readable. */
function writeStretchedGray(values: Float32Array, out: Uint8ClampedArray): void {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < values.length; i++) {
    const gray = Math.floor(((values[i] - min) / range) * 255);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = gray;
    out[i * 4 + 3] = 255;
  }
}

/** Depth with an RViz-style rainbow; zero and non-finite depths are invalid and drawn black. */
function writeRainbowDepth(values: Float32Array, out: Uint8ClampedArray): void {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const depth = values[i];
    if (Number.isFinite(depth) && depth > 0) {
      if (depth < min) min = depth;
      if (depth > max) max = depth;
    }
  }
  const range = max - min || 1;
  for (let i = 0; i < values.length; i++) {
    const depth = values[i];
    const valid = Number.isFinite(depth) && depth > 0;
    const color = valid ? applyRainbowColormap((depth - min) / range) : { r: 0, g: 0, b: 0 };
    out[i * 4] = color.r;
    out[i * 4 + 1] = color.g;
    out[i * 4 + 2] = color.b;
    out[i * 4 + 3] = 255;
  }
}

/**
 * Decode a ROS sensor_msgs/Image into RGBA pixels, honouring row padding (`step`) and
 * `is_bigendian`. Images decoded by the bridge's worker come with their pixels already converted;
 * those are returned as they are, so treat the result as read-only.
 */
export function decodeImagePixels(imageMsg: sensor_msgs.Image): Uint8ClampedArray<ArrayBuffer> {
  const prepared = getPrepared(imageMsg)?.pixels;
  if (prepared) return prepared;
  const { width, height } = imageMsg;
  const encoding = imageMsg.encoding.toLowerCase();
  const bpp = BYTES_PER_PIXEL[encoding];
  if (!bpp) throw new Error(`Unsupported image encoding: ${imageMsg.encoding}`);
  if (!imageMsg.data || imageMsg.data.length === 0) throw new Error('Image data is empty');

  const bytes = decodeBytes(imageMsg.data);
  const step = imageMsg.step || width * bpp;
  if (step < width * bpp || bytes.length < step * (height - 1) + width * bpp)
    throw new Error(`Image data is too short for ${width}×${height} ${imageMsg.encoding}`);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = !imageMsg.is_bigendian;
  const pixels = new Uint8ClampedArray(width * height * 4);

  switch (encoding) {
    case 'rgb8':
    case 'bgr8':
    case 'rgba8':
    case 'bgra8': {
      const red = encoding.startsWith('bgr') ? 2 : 0;
      const blue = 2 - red;
      for (let row = 0, i = 0; row < height; row++)
        for (let col = 0, src = row * step; col < width; col++, src += bpp, i += 4) {
          pixels[i] = bytes[src + red];
          pixels[i + 1] = bytes[src + 1];
          pixels[i + 2] = bytes[src + blue];
          pixels[i + 3] = bpp === 4 ? bytes[src + 3] : 255;
        }
      break;
    }
    case 'mono8':
      writeStretchedGray(
        readValues(width, height, step, bpp, (offset) => bytes[offset]),
        pixels
      );
      break;
    case 'mono16':
      writeStretchedGray(
        readValues(width, height, step, bpp, (offset) => view.getUint16(offset, littleEndian)),
        pixels
      );
      break;
    case '16uc1':
      // Typical depth camera output in millimetres
      writeRainbowDepth(
        readValues(width, height, step, bpp, (offset) => view.getUint16(offset, littleEndian)),
        pixels
      );
      break;
    default:
      // 32FC1 / depth: metres as 32-bit floats
      writeRainbowDepth(
        readValues(width, height, step, bpp, (offset) => view.getFloat32(offset, littleEndian)),
        pixels
      );
  }
  return pixels;
}

function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  // Assigning a size clears the canvas, so only do it when the image size changes.
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

/**
 * Draw a raw or compressed image message onto `canvas`, sized to the image. Drawing directly
 * avoids re-encoding every frame as a PNG data URL.
 */
export async function drawImageMessage(
  canvas: HTMLCanvasElement,
  imageMsg: sensor_msgs.Image | sensor_msgs.CompressedImage
): Promise<{ width: number; height: number }> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  if ('encoding' in imageMsg) {
    const { width, height } = imageMsg;
    const pixels = decodeImagePixels(imageMsg);
    fitCanvas(canvas, width, height);
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
    return { width, height };
  }

  if (!imageMsg.data || imageMsg.data.length === 0) throw new Error('Image data is empty');
  const type = imageMsg.format.includes('png') ? 'image/png' : 'image/jpeg';
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([decodeBytes(imageMsg.data)], { type }));
  } catch {
    throw new Error(`Cannot decode compressed image (${imageMsg.format})`);
  }
  try {
    fitCanvas(canvas, bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/**
 * Get a human-readable description of an image encoding
 */
export function getEncodingDescription(encoding: string): string {
  const descriptions: Record<string, string> = {
    rgb8: 'RGB 8-bit',
    bgr8: 'BGR 8-bit',
    rgba8: 'RGBA 8-bit',
    bgra8: 'BGRA 8-bit',
    mono8: 'Grayscale 8-bit',
    mono16: 'Grayscale 16-bit',
    '16uc1': '16-bit Unsigned',
    '32fc1': '32-bit Float',
    depth: 'Depth Image',
  };

  return descriptions[encoding.toLowerCase()] || encoding;
}
