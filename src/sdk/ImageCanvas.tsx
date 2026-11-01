'use client';

import { useEffect, useRef, useState } from 'react';
import type { MitiClient } from '@/panels/types';
import type { Header } from '@/types/scene';
import type { ImageMessage } from '@/components/features/visualization/camera/useImageSource';
import { useTopic } from '@/hooks/useTopic';
import { drawImageMessage } from '@/lib/parsers/image-parser';

/** The image `ImageCanvas` shows, as `draw` receives it. */
export interface ImageFrame {
  width: number;
  height: number;
  header: Header;
}

const RENDER_THROTTLE_MS = 33;

/**
 * The newest frame of a `sensor_msgs/Image` or `sensor_msgs/CompressedImage` topic, fitted to the
 * panel. `draw` paints over it in the image's own pixel coordinates, e.g. a vision node's
 * detection boxes; it runs for every frame and whenever `redraw` changes.
 */
export default function ImageCanvas({
  client,
  topic,
  maxFps,
  draw,
  redraw,
}: {
  client: MitiClient | null;
  topic: string;
  /** Frames per second to receive at most; the bridge still sends every frame. */
  maxFps?: number;
  draw?: (context: CanvasRenderingContext2D, frame: ImageFrame) => void;
  /** Anything that should repaint the overlay when it changes, e.g. the latest detections. */
  redraw?: unknown;
}) {
  const { data } = useTopic<ImageMessage>(client, topic, undefined, {
    throttleRate: RENDER_THROTTLE_MS,
    maxRate: maxFps,
  });
  const image = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState<(ImageFrame & { version: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = canvas.current?.parentElement;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setFrame(null);
    setError(null);
  }, [topic]);

  // Decode one frame at a time; a frame that arrives meanwhile replaces the waiting one.
  const latest = useRef<ImageMessage | null>(null);
  const decoding = useRef(false);
  useEffect(() => {
    latest.current = data;
    if (!data || decoding.current) return;
    decoding.current = true;
    (async () => {
      while (latest.current) {
        const message = latest.current;
        latest.current = null;
        try {
          image.current ??= document.createElement('canvas');
          const { width, height } = await drawImageMessage(image.current, message);
          setFrame((previous) => ({
            width,
            height,
            header: message.header,
            version: (previous?.version ?? 0) + 1,
          }));
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Cannot decode the image');
        }
      }
      decoding.current = false;
    })();
  }, [data]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(box.width * ratio);
    element.height = Math.round(box.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);
    if (!frame || !image.current || !frame.width || !frame.height) return;
    const scale = Math.min(box.width / frame.width, box.height / frame.height);
    const x = (box.width - frame.width * scale) / 2;
    const y = (box.height - frame.height * scale) / 2;
    context.drawImage(image.current, x, y, frame.width * scale, frame.height * scale);
    if (!draw) return;
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    draw(context, { width: frame.width, height: frame.height, header: frame.header });
    context.restore();
  }, [frame, box, draw, redraw]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvas}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {(error || !frame) && (
        <div className="panel-notice" style={{ position: 'absolute', inset: 0 }}>
          {error ?? (client ? `Waiting for ${topic}…` : 'Not connected')}
        </div>
      )}
    </div>
  );
}
