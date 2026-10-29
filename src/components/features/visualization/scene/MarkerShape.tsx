'use client';
import { useEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import type { Marker } from '@/types/scene';
import { xyz } from '@/lib/scene/geometry';
import { Cloud } from './Primitives';
const colorString = (c: Marker['color']) => new THREE.Color(c.r, c.g, c.b);
function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((m) => {
        Object.values(m).forEach((v) => {
          if (v instanceof THREE.Texture) v.dispose();
        });
        m.dispose();
      });
    }
  });
}
function MeshResource({
  marker,
  baseUrl,
  packages,
  onError,
  opacity,
}: {
  marker: Marker;
  opacity: number;
  baseUrl: string;
  packages: Record<string, string>;
  onError: (message: string) => void;
}) {
  const resource = marker.mesh_resource;
  const embedded = marker.mesh_use_embedded_materials;
  const { r, g, b, a } = marker.color;
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let live = true;
    let loaded: THREE.Object3D | null = null;
    setObject(null);
    let url = resource ?? '';
    if (url.startsWith('package://')) {
      const [, pkg, path] = url.match(/^package:\/\/([^/]+)\/(.*)$/) ?? [];
      url = `${(packages[pkg] ?? baseUrl).replace(/\/$/, '')}/${path}`;
    }
    const fail = (err: unknown) => {
      if (live) onError(`Mesh failed: ${err instanceof Error ? err.message : String(err)}`);
    };
    const done = (obj: THREE.Object3D) => {
      loaded = obj;
      if (!live) {
        disposeObject(obj);
        return;
      }
      if (!embedded)
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const old = Array.isArray(child.material) ? child.material : [child.material];
            old.forEach((m) => m.dispose());
            child.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(r, g, b),
              opacity: a * opacity,
              transparent: a * opacity < 1,
            });
          }
        });
      setObject(obj);
      onError('');
    };
    try {
      if (!url || url.startsWith('embedded://') || url.startsWith('file://'))
        throw new Error('Use an HTTP(S) mesh URL or package mapping');
      const extension = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
      if (extension === 'stl')
        new STLLoader().load(
          url,
          (g) => done(new THREE.Mesh(g, new THREE.MeshStandardMaterial())),
          undefined,
          fail
        );
      else if (extension === 'obj') new OBJLoader().load(url, done, undefined, fail);
      else if (extension === 'dae')
        new ColladaLoader().load(url, (c) => done(c.scene), undefined, fail);
      else throw new Error(`Unsupported mesh format: ${extension}`);
    } catch (e) {
      fail(e);
    }
    return () => {
      live = false;
      if (loaded) disposeObject(loaded);
    };
  }, [resource, embedded, r, g, b, a, opacity, baseUrl, packages, onError]);
  return object ? <primitive object={object} scale={xyz(marker.scale)} /> : null;
}
function Triangles({ marker, opacity }: { marker: Marker; opacity: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute((marker.points ?? []).flatMap(xyz), 3)
    );
    if (marker.colors && marker.colors.length === marker.points?.length)
      g.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          marker.colors.flatMap((c) => [c.r, c.g, c.b]),
          3
        )
      );
    g.computeVertexNormals();
    return g;
  }, [marker]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} scale={xyz(marker.scale)}>
      <meshBasicMaterial
        color={geometry.getAttribute('color') ? 'white' : colorString(marker.color)}
        vertexColors={!!geometry.getAttribute('color')}
        side={THREE.DoubleSide}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
export default function MarkerShape({
  marker,
  opacity,
  baseUrl,
  packages,
  onError,
}: {
  marker: Marker;
  opacity: number;
  baseUrl: string;
  packages: Record<string, string>;
  onError: (message: string) => void;
}) {
  const color = colorString(marker.color),
    alpha = marker.color.a * opacity,
    points = (marker.points ?? []).map(xyz),
    scale = xyz(marker.scale);
  const material = (
    <meshBasicMaterial color={color} transparent opacity={alpha} side={THREE.DoubleSide} />
  );
  if (marker.type === 10)
    return (
      <MeshResource
        marker={marker}
        opacity={opacity}
        baseUrl={baseUrl}
        packages={packages}
        onError={onError}
      />
    );
  if (marker.type === 9)
    return (
      <Html center sprite distanceFactor={Math.max(0.01, marker.scale.z) * 10}>
        <span
          style={{
            color: `#${color.getHexString()}`,
            opacity: alpha,
            whiteSpace: 'pre',
            pointerEvents: 'none',
          }}
        >
          {marker.text}
        </span>
      </Html>
    );
  if (marker.type === 11) return <Triangles marker={marker} opacity={alpha} />;
  if (marker.type === 8)
    return (
      <Cloud
        positions={points.flat()}
        colors={
          marker.colors?.length === points.length
            ? marker.colors.flatMap((c) => [c.r, c.g, c.b])
            : undefined
        }
        size={scale[0]}
        color={`#${color.getHexString()}`}
        opacity={alpha}
      />
    );
  if (marker.type === 4 || marker.type === 5) {
    const segments = points
      .slice(1)
      .flatMap((point, index) =>
        marker.type === 5 && index % 2 === 1 ? [] : [[points[index], point]]
      );
    return (
      <>
        {segments.map((pair, index) => {
          const a = new THREE.Vector3(...pair[0]),
            b = new THREE.Vector3(...pair[1]);
          const delta = b.clone().sub(a);
          const length = delta.length();
          if (!length) return null;
          return (
            <mesh
              key={index}
              position={a.add(b).multiplyScalar(0.5)}
              quaternion={new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                delta.normalize()
              )}
            >
              <cylinderGeometry args={[scale[0] / 2, scale[0] / 2, length, 8]} />
              <meshBasicMaterial
                color={
                  marker.colors?.[marker.type === 5 ? index * 2 : index]
                    ? colorString(marker.colors[marker.type === 5 ? index * 2 : index])
                    : color
                }
                transparent
                opacity={alpha}
              />
            </mesh>
          );
        })}
      </>
    );
  }
  if (marker.type === 0 || marker.type === 12) {
    const segments =
      marker.type === 12
        ? points.slice(1).map((p, i) => [points[i], p])
        : [
            points.length >= 2
              ? [points[0], points[1]]
              : [
                  [0, 0, 0],
                  [scale[0], 0, 0],
                ],
          ];
    return (
      <>
        {segments.map((pair, i) => {
          const a = new THREE.Vector3(...pair[0]),
            b = new THREE.Vector3(...pair[1]);
          const direction = b.clone().sub(a),
            length = direction.length();
          if (!length) return null;
          const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize()
          );
          const shaft = points.length >= 2 ? scale[0] : scale[1];
          const head = points.length >= 2 ? scale[1] : scale[2];
          const headLength = points.length >= 2 ? scale[2] || length * 0.23 : length * 0.23;
          const h = Math.min(length, headLength);
          return (
            <group key={i} position={a} quaternion={q}>
              <mesh position={[0, (length - h) / 2, 0]}>
                <cylinderGeometry args={[shaft / 2, shaft / 2, length - h, 10]} />
                {material}
              </mesh>
              <mesh position={[0, length - h / 2, 0]}>
                <coneGeometry args={[head / 2, h, 12]} />
                {material}
              </mesh>
            </group>
          );
        })}
      </>
    );
  }
  const shape = (key: number, position: [number, number, number]) => (
    <group key={key} position={position} scale={scale}>
      <mesh rotation={marker.type === 3 ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        {marker.type === 2 || marker.type === 7 ? (
          <sphereGeometry args={[0.5, 16, 12]} />
        ) : marker.type === 3 ? (
          <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
        ) : (
          <boxGeometry args={[1, 1, 1]} />
        )}
        <meshBasicMaterial
          color={marker.colors?.[key] ? colorString(marker.colors[key]) : color}
          transparent
          opacity={alpha}
        />
      </mesh>
    </group>
  );
  return (
    <>
      {marker.type === 6 || marker.type === 7
        ? points.map((p, i) => shape(i, p))
        : shape(0, [0, 0, 0])}
    </>
  );
}
