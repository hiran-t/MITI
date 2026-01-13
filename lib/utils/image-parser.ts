/**
 * Image message parser for ROS sensor_msgs/Image
 * Supports various encoding formats including RGB8, BGR8, RGBA8, BGRA8, MONO8, MONO16, and depth formats
 */

import type { sensor_msgs } from '@/types/ros-messages';

/**
 * Parse a ROS Image message and convert it to a data URL
 * @param imageMsg - ROS sensor_msgs/Image message
 * @returns Data URL string that can be used as img src
 */
export function parseImageMessage(imageMsg: sensor_msgs.Image): string {
  const { width, height, encoding, data } = imageMsg;

  console.log('Parsing image:', { width, height, encoding, dataLength: data?.length });

  if (!data || data.length === 0) {
    throw new Error('Image data is empty');
  }

  // Handle base64-encoded data from rosbridge
  let imageDataArray: Uint8Array;
  if (typeof data === 'string') {
    // Data is base64 encoded
    console.log('Decoding base64 data...');
    const binaryString = atob(data);
    imageDataArray = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageDataArray[i] = binaryString.charCodeAt(i);
    }
  } else if (Array.isArray(data)) {
    // Data is already an array
    imageDataArray = new Uint8Array(data);
  } else {
    throw new Error('Unsupported data format');
  }

  console.log('Image data array length:', imageDataArray.length);

  // Create a canvas to render the image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Create ImageData object
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  // Parse based on encoding type
  switch (encoding.toLowerCase()) {
    case 'rgb8':
      // RGB8: 8-bit per channel, 3 channels
      for (let i = 0; i < width * height; i++) {
        const srcIdx = i * 3;
        const dstIdx = i * 4;
        pixels[dstIdx] = imageDataArray[srcIdx];         // R
        pixels[dstIdx + 1] = imageDataArray[srcIdx + 1]; // G
        pixels[dstIdx + 2] = imageDataArray[srcIdx + 2]; // B
        pixels[dstIdx + 3] = 255;              // A
      }
      break;

    case 'bgr8':
      // BGR8: 8-bit per channel, 3 channels (swapped R and B)
      for (let i = 0; i < width * height; i++) {
        const srcIdx = i * 3;
        const dstIdx = i * 4;
        pixels[dstIdx] = imageDataArray[srcIdx + 2];     // R (from B)
        pixels[dstIdx + 1] = imageDataArray[srcIdx + 1]; // G
        pixels[dstIdx + 2] = imageDataArray[srcIdx];     // B (from R)
        pixels[dstIdx + 3] = 255;              // A
      }
      break;

    case 'rgba8':
      // RGBA8: 8-bit per channel, 4 channels
      for (let i = 0; i < width * height * 4; i++) {
        pixels[i] = imageDataArray[i];
      }
      break;

    case 'bgra8':
      // BGRA8: 8-bit per channel, 4 channels (swapped R and B)
      for (let i = 0; i < width * height; i++) {
        const srcIdx = i * 4;
        const dstIdx = i * 4;
        pixels[dstIdx] = imageDataArray[srcIdx + 2];     // R (from B)
        pixels[dstIdx + 1] = imageDataArray[srcIdx + 1]; // G
        pixels[dstIdx + 2] = imageDataArray[srcIdx];     // B (from R)
        pixels[dstIdx + 3] = imageDataArray[srcIdx + 3]; // A
      }
      break;

    case 'mono8':
      // MONO8: 8-bit grayscale
      for (let i = 0; i < width * height; i++) {
        const value = imageDataArray[i];
        const dstIdx = i * 4;
        pixels[dstIdx] = value;     // R
        pixels[dstIdx + 1] = value; // G
        pixels[dstIdx + 2] = value; // B
        pixels[dstIdx + 3] = 255;   // A
      }
      break;

    case 'mono16':
    case '16uc1':
      // MONO16: 16-bit grayscale - scale down to 8-bit
      for (let i = 0; i < width * height; i++) {
        const srcIdx = i * 2;
        // Read 16-bit value (little-endian)
        const value16 = imageDataArray[srcIdx] | (imageDataArray[srcIdx + 1] << 8);
        // Scale down to 8-bit (divide by 256)
        const value8 = Math.min(255, value16 >> 8);
        const dstIdx = i * 4;
        pixels[dstIdx] = value8;     // R
        pixels[dstIdx + 1] = value8; // G
        pixels[dstIdx + 2] = value8; // B
        pixels[dstIdx + 3] = 255;    // A
      }
      break;

    case '32fc1':
    case 'depth':
      // 32-bit float depth data - normalize and visualize
      const depthData = new Float32Array(imageDataArray.buffer);
      let minDepth = Infinity;
      let maxDepth = -Infinity;

      // Find min and max depth values (excluding invalid values)
      for (let i = 0; i < width * height; i++) {
        const depth = depthData[i];
        if (isFinite(depth) && depth > 0) {
          minDepth = Math.min(minDepth, depth);
          maxDepth = Math.max(maxDepth, depth);
        }
      }

      // Normalize and colorize depth data
      const depthRange = maxDepth - minDepth || 1;
      for (let i = 0; i < width * height; i++) {
        const depth = depthData[i];
        const dstIdx = i * 4;

        if (!isFinite(depth) || depth <= 0) {
          // Invalid depth - show as black
          pixels[dstIdx] = 0;
          pixels[dstIdx + 1] = 0;
          pixels[dstIdx + 2] = 0;
          pixels[dstIdx + 3] = 255;
        } else {
          // Normalize depth to 0-1 range
          const normalized = (depth - minDepth) / depthRange;
          // Apply colormap (blue for near, red for far)
          const value = Math.floor(normalized * 255);
          pixels[dstIdx] = value;           // R increases with distance
          pixels[dstIdx + 1] = 128;         // G constant
          pixels[dstIdx + 2] = 255 - value; // B decreases with distance
          pixels[dstIdx + 3] = 255;         // A
        }
      }
      break;

    default:
      throw new Error(`Unsupported image encoding: ${encoding}`);
  }

  // Put the image data on the canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to data URL
  return canvas.toDataURL('image/png');
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
