'use client';
import { useEffect, useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { Header, SceneLayerConfig } from '@/types/scene';
import type { sensor_msgs } from '@/types/ros-messages';
import type { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import { parseImageMessage } from '@/lib/parsers/image-parser';
import { frameName } from '@/lib/scene/transforms';
export interface CameraInfo {
  header: Header;
  width: number;
  height: number;
  k: number[];
  p: number[];
  d: number[];
  binning_x?: number;
  binning_y?: number;
  roi?: { x_offset: number; y_offset: number; width: number; height: number };
}
export function cameraCorners(info: CameraInfo, depth: number): [number, number, number][] {
  const p = info.p,
    k = info.k;
  const rectified = p?.[0] > 0 && p?.[5] > 0;
  const fx = rectified ? p[0] : k?.[0],
    fy = rectified ? p[5] : k?.[4],
    cx = rectified ? p[2] : k?.[2],
    cy = rectified ? p[6] : k?.[5];
  if (
    ![fx, fy, cx, cy, info.width, info.height].every(Number.isFinite) ||
    fx <= 0 ||
    fy <= 0 ||
    info.width <= 0 ||
    info.height <= 0
  )
    throw new Error('CameraInfo is uncalibrated');
  const roi = info.roi,
    bx = info.binning_x || 1,
    by = info.binning_y || 1;
  const left = roi?.x_offset ?? 0,
    top = roi?.y_offset ?? 0,
    width = roi?.width || info.width,
    height = roi?.height || info.height;
  // Pixel corners in full-resolution calibration coordinates; binning cancels when back-projecting.
  return [
    [left, top],
    [left + Math.ceil(width / bx) * bx, top],
    [left + Math.ceil(width / bx) * bx, top + Math.ceil(height / by) * by],
    [left, top + Math.ceil(height / by) * by],
  ].map(([u, v]) => [((u - cx) * depth) / fx, ((v - cy) * depth) / fy, depth]);
}
export default function CameraLayer({
  info,
  layer,
  client,
  onError,
}: {
  info: CameraInfo;
  layer: SceneLayerConfig;
  client: ROSBridge | null;
  onError: (message: string) => void;
}) {
  const { data, lastUpdate } = useTopic<
    sensor_msgs.Image | { data: string | number[]; format: string; header: Header }
  >(
    client,
    layer.imageTopic ?? '',
    layer.imageMode === 'compressed' ? 'sensor_msgs/msg/CompressedImage' : 'sensor_msgs/msg/Image'
  );
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const corners = useMemo(() => cameraCorners(info, layer.size ?? 1), [info, layer.size]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, [corners]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    setTexture(null);
    if (!data) return;
    let live = true,
      url = '',
      image: THREE.Texture | undefined;
    try {
      if (frameName(data.header.frame_id) !== frameName(info.header.frame_id))
        throw new Error('Image and CameraInfo must use the same optical frame');
      if ('encoding' in data) url = parseImageMessage(data);
      else {
        const bytes =
          typeof data.data === 'string'
            ? Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0))
            : new Uint8Array(data.data);
        url = URL.createObjectURL(
          new Blob([bytes], { type: data.format.includes('png') ? 'image/png' : 'image/jpeg' })
        );
      }
      image = new THREE.TextureLoader().load(
        url,
        (t) => {
          if (live) {
            t.colorSpace = THREE.SRGBColorSpace;
            setTexture(t);
            onError('');
          } else t.dispose();
        },
        undefined,
        () => {
          if (live) onError('Failed to decode image');
        }
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Invalid image');
    }
    return () => {
      live = false;
      image?.dispose();
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [data, info.header.frame_id, onError]);
  useEffect(() => {
    if (!layer.imageTopic) return;
    const timer = setInterval(() => {
      if (!lastUpdate) onError('Waiting for image');
      else if (Date.now() - lastUpdate.getTime() > (layer.staleAfter ?? 5) * 1000)
        onError('Image is stale');
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdate, layer.imageTopic, layer.staleAfter, onError]);
  return (
    <>
      <Line points={[...corners, corners[0]]} color={layer.color ?? '#a78bfa'} />
      {corners.map((corner, i) => (
        <Line key={i} points={[[0, 0, 0], corner]} color={layer.color ?? '#a78bfa'} />
      ))}
      {texture && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            map={texture}
            side={THREE.DoubleSide}
            transparent
            opacity={layer.opacity ?? 1}
          />
        </mesh>
      )}
    </>
  );
}
