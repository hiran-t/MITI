'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { sensor_msgs } from '@/types/ros-messages';
import type { Header } from '@/types/scene';
import { drawImageMessage } from '@/lib/parsers/image-parser';
import { decodeScalarImage, isScalarEncoding } from '@/lib/camera/image-colors';

export type ImageMessage = sensor_msgs.Image | sensor_msgs.CompressedImage;

/** The newest decoded frame, as a texture the Image panel's shader samples. */
export interface ImageSource {
  texture: THREE.Texture;
  width: number;
  height: number;
  /** Set for depth and mono images, whose texture holds raw values for Color mode. */
  scalar: { min: number; max: number; zeroInvalid: boolean } | null;
  header: Header;
  /** Increments with every frame. */
  version: number;
}

function scalarTexture(
  previous: THREE.Texture | null,
  values: Float32Array<ArrayBuffer>,
  w: number,
  h: number
) {
  if (
    previous instanceof THREE.DataTexture &&
    previous.image.width === w &&
    previous.image.height === h
  ) {
    Object.assign(previous.image, { data: values });
    previous.needsUpdate = true;
    return previous;
  }
  previous?.dispose();
  // Float textures are not filterable everywhere; depth reads best unsmoothed anyway.
  const texture = new THREE.DataTexture(values, w, h, THREE.RedFormat, THREE.FloatType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function canvasTexture(
  previous: THREE.Texture | null,
  canvas: HTMLCanvasElement,
  w: number,
  h: number
) {
  // Texture storage cannot be resized, so a new size needs a new texture. The canvas itself
  // is resized in place, so compare with the size the texture was made for.
  if (previous instanceof THREE.CanvasTexture && previous.userData.size === `${w}x${h}`) {
    previous.needsUpdate = true;
    return previous;
  }
  previous?.dispose();
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData.size = `${w}x${h}`;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Decode image messages one at a time into a texture. Frames that arrive while one is decoding
 * replace each other, so only the newest is drawn and the previous image stays until then.
 */
export function useImageSource(message: ImageMessage | null, resetKey: string) {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<ImageMessage | null>(null);
  const drawing = useRef(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const textures = useRef<{ color: THREE.Texture | null; scalar: THREE.Texture | null }>({
    color: null,
    scalar: null,
  });
  const version = useRef(0);

  useEffect(() => {
    latest.current = null;
    setSource(null);
    setError(null);
  }, [resetKey]);

  useEffect(
    () => () => {
      textures.current.color?.dispose();
      textures.current.scalar?.dispose();
    },
    []
  );

  useEffect(() => {
    latest.current = message;
    if (!message || drawing.current) return;
    drawing.current = true;
    (async () => {
      while (latest.current) {
        const frame = latest.current;
        latest.current = null;
        try {
          let next: Omit<ImageSource, 'version' | 'header'>;
          if ('encoding' in frame && isScalarEncoding(frame.encoding)) {
            const { values, width, height, min, max, zeroInvalid } = decodeScalarImage(frame);
            textures.current.scalar = scalarTexture(textures.current.scalar, values, width, height);
            next = {
              texture: textures.current.scalar,
              width,
              height,
              scalar: { min, max, zeroInvalid },
            };
          } else {
            canvas.current ??= document.createElement('canvas');
            const { width, height } = await drawImageMessage(canvas.current, frame);
            textures.current.color = canvasTexture(
              textures.current.color,
              canvas.current,
              width,
              height
            );
            next = { texture: textures.current.color, width, height, scalar: null };
          }
          version.current += 1;
          setSource({ ...next, header: frame.header, version: version.current });
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to decode image');
        }
      }
      drawing.current = false;
    })();
  }, [message]);

  return { source, error };
}
