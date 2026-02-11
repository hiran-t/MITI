/**
 * Image message parser for ROS sensor_msgs/Image
 * Supports various encoding formats including RGB8, BGR8, RGBA8, BGRA8, MONO8, MONO16, and depth formats
 */

import type { sensor_msgs } from '@/types/ros-messages';

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
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 1) {
    r = c; g = x; b = 0;
  } else if (h >= 1 && h < 2) {
    r = x; g = c; b = 0;
  } else if (h >= 2 && h < 3) {
    r = 0; g = c; b = x;
  } else if (h >= 3 && h < 4) {
    r = 0; g = x; b = c;
  } else if (h >= 4 && h < 5) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Parse a ROS Image message and convert it to a data URL
 * @param imageMsg - ROS sensor_msgs/Image message
 * @returns Data URL string that can be used as img src
 */
export function parseImageMessage(imageMsg: sensor_msgs.Image): string {
  const { width, height, encoding, data } = imageMsg;

  // console.log('Parsing image:', { width, height, encoding, dataLength: data?.length });

  if (!data || data.length === 0) {
    throw new Error('Image data is empty');
  }

  // Handle base64-encoded data from rosbridge
  let imageDataArray: Uint8Array;
  if (typeof data === 'string') {
    // Data is base64 encoded
    // console.log('Decoding base64 data...')
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

  // console.log('Image data array length:', imageDataArray.length);

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
      // MONO8: 8-bit grayscale with auto brightness/contrast enhancement
      let minVal8 = 255;
      let maxVal8 = 0;
      
      // Find min and max values for histogram stretching
      for (let i = 0; i < width * height; i++) {
        const value = imageDataArray[i];
        if (value < minVal8) minVal8 = value;
        if (value > maxVal8) maxVal8 = value;
      }
      
      // Calculate stretch parameters
      const range8 = maxVal8 - minVal8 || 1;
      
      // Apply histogram stretching for better contrast
      for (let i = 0; i < width * height; i++) {
        const value = imageDataArray[i];
        // Stretch and enhance
        const stretched = Math.min(255, Math.floor(((value - minVal8) / range8) * 255));
        const dstIdx = i * 4;
        pixels[dstIdx] = stretched;     // R
        pixels[dstIdx + 1] = stretched; // G
        pixels[dstIdx + 2] = stretched; // B
        pixels[dstIdx + 3] = 255;       // A
      }
      break;

    case 'mono16':
      // MONO16: 16-bit grayscale with auto brightness/contrast enhancement
      let minVal16 = 65535;
      let maxVal16 = 0;
      const values16: number[] = [];
      
      // Read all 16-bit values and find min/max for histogram stretching
      for (let i = 0; i < width * height; i++) {
        const srcIdx = i * 2;
        const value16 = imageDataArray[srcIdx] | (imageDataArray[srcIdx + 1] << 8);
        values16.push(value16);
        if (value16 < minVal16) minVal16 = value16;
        if (value16 > maxVal16) maxVal16 = value16;
      }
      
      // Calculate stretch parameters
      const range16 = maxVal16 - minVal16 || 1;
      
      // Apply histogram stretching for better contrast
      for (let i = 0; i < width * height; i++) {
        const value16 = values16[i];
        // Stretch to full 0-255 range
        const stretched = Math.min(255, Math.floor(((value16 - minVal16) / range16) * 255));
        const dstIdx = i * 4;
        pixels[dstIdx] = stretched;     // R
        pixels[dstIdx + 1] = stretched; // G
        pixels[dstIdx + 2] = stretched; // B
        pixels[dstIdx + 3] = 255;       // A
      }
      break;

    case '16uc1':
      // 16UC1: 16-bit depth data (typical ROS depth camera format)
      // Values are in millimeters, apply rainbow colormap
      let minDepth16 = Infinity;
      let maxDepth16 = -Infinity;
      const depthValues16: number[] = [];

      // Read all 16-bit depth values and find min/max
      for (let i = 0; i < width * height; i++) {
        const srcIdx = i * 2;
        const depth = imageDataArray[srcIdx] | (imageDataArray[srcIdx + 1] << 8);
        depthValues16.push(depth);
        
        if (depth > 0) {
          minDepth16 = Math.min(minDepth16, depth);
          maxDepth16 = Math.max(maxDepth16, depth);
        }
      }

      // Apply rainbow colormap to depth data
      const depthRange16 = maxDepth16 - minDepth16 || 1;
      for (let i = 0; i < width * height; i++) {
        const depth = depthValues16[i];
        const dstIdx = i * 4;

        if (depth === 0) {
          // Invalid depth (0 or too far) - show as black
          pixels[dstIdx] = 0;
          pixels[dstIdx + 1] = 0;
          pixels[dstIdx + 2] = 0;
          pixels[dstIdx + 3] = 255;
        } else {
          // Normalize depth to 0-1 range
          const normalized = (depth - minDepth16) / depthRange16;
          // Apply RViz-style rainbow colormap
          const color = applyRainbowColormap(normalized);
          pixels[dstIdx] = color.r;
          pixels[dstIdx + 1] = color.g;
          pixels[dstIdx + 2] = color.b;
          pixels[dstIdx + 3] = 255;
        }
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

      // Normalize and colorize depth data with RViz-style rainbow colormap
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
          // Apply RViz-style rainbow colormap (Axis color)
          const color = applyRainbowColormap(normalized);
          pixels[dstIdx] = color.r;
          pixels[dstIdx + 1] = color.g;
          pixels[dstIdx + 2] = color.b;
          pixels[dstIdx + 3] = 255;
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
