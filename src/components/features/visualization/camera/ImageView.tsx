'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  IntrinsicCamera,
  transpose3,
  type CameraModel,
  type ImageTransform,
  type Intrinsics,
  type Mat3,
} from '@/lib/camera/projection';
import { RECTIFY_GLSL } from '@/lib/camera/rectify';
import { LUT_SIZE } from '@/lib/camera/image-colors';
import { parseHex } from '@/lib/scene/colors';
import type { ImageSource } from './useImageSource';

/**
 * The Image panel's view: the camera image drawn by a full-screen shader (flips and rotation,
 * Color mode for depth and mono, Rectify), with scene layers on top through a camera that has the
 * real camera's intrinsics.
 */

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform sampler2D lut;
uniform bool scalar;
uniform bool zeroInvalid;
uniform vec2 valueRange;
uniform vec2 sourceSize;
uniform vec2 outputSize;
uniform mat3 screenToImage;
uniform bool rectify;
uniform vec3 background;
${RECTIFY_GLSL}
varying vec2 vUv;
void main() {
  vec2 p = (screenToImage * vec3(vUv.x * outputSize.x, (1.0 - vUv.y) * outputSize.y, 1.0)).xy;
  if (rectify && !rectifiedToRaw(p)) {
    gl_FragColor = vec4(background, 1.0);
    return;
  }
  vec2 uv = p / sourceSize;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    gl_FragColor = vec4(background, 1.0);
    return;
  }
  vec4 color = texture2D(map, uv);
  if (scalar) {
    float v = color.r;
    if (v != v || abs(v) > 3.0e38 || (zeroInvalid && v == 0.0)) {
      gl_FragColor = vec4(background, 1.0);
      return;
    }
    float t = clamp((v - valueRange.x) / (valueRange.y - valueRange.x), 0.0, 1.0);
    color = texture2D(lut, vec2((t * ${LUT_SIZE - 1}.0 + 0.5) / ${LUT_SIZE}.0, 0.5));
  }
  gl_FragColor = vec4(mix(background, color.rgb, color.a), 1.0);
}`;

/** Inverse of a flip/rotation pixel transform [R t; 0 1] with R orthogonal: [Rᵀ −Rᵀt; 0 1]. */
function invertPixelTransform(m: Mat3): Mat3 {
  const [a, b, tx, c, d, ty] = m;
  return [a, c, -(a * tx + c * ty), b, d, -(b * tx + d * ty), 0, 0, 1];
}

const vec4Of = ({ fx, fy, cx, cy }: Intrinsics) => new THREE.Vector4(fx, fy, cx, cy);
const matrix3 = (m: Mat3) =>
  new THREE.Matrix3().set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);

function ImageBackground({
  source,
  transform,
  model,
  rectify,
  lut,
  range,
  background,
}: {
  source: ImageSource;
  transform: ImageTransform;
  model: CameraModel | null;
  rectify: boolean;
  lut: Uint8Array<ArrayBuffer>;
  range: [number, number];
  background: string;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const lutTexture = useMemo(() => {
    const texture = new THREE.DataTexture(lut, LUT_SIZE, 1, THREE.RGBAFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [lut]);
  useEffect(() => () => lutTexture.dispose(), [lutTexture]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          map: { value: null },
          lut: { value: null },
          scalar: { value: false },
          zeroInvalid: { value: false },
          valueRange: { value: new THREE.Vector2(0, 1) },
          sourceSize: { value: new THREE.Vector2(1, 1) },
          outputSize: { value: new THREE.Vector2(1, 1) },
          screenToImage: { value: new THREE.Matrix3() },
          rectify: { value: false },
          background: { value: new THREE.Color() },
          rectifiedIntrinsics: { value: new THREE.Vector4(1, 1, 0, 0) },
          unrectify: { value: new THREE.Matrix3() },
          rawIntrinsics: { value: new THREE.Vector4(1, 1, 0, 0) },
          k: { value: new Array(8).fill(0) },
        },
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.map.value = source.texture;
    u.lut.value = lutTexture;
    u.scalar.value = !!source.scalar;
    u.zeroInvalid.value = !!source.scalar?.zeroInvalid;
    u.valueRange.value.set(range[0], range[1]);
    u.sourceSize.value.set(source.width, source.height);
    u.outputSize.value.set(transform.width, transform.height);
    u.screenToImage.value = matrix3(invertPixelTransform(transform.pixel));
    const [r, g, b] = parseHex(background);
    u.background.value.setRGB(r, g, b);
    const rectifying = rectify && !!model;
    u.rectify.value = rectifying;
    if (rectifying) {
      u.rectifiedIntrinsics.value = vec4Of(model.intrinsics);
      u.rawIntrinsics.value = vec4Of(model.raw);
      u.unrectify.value = matrix3(transpose3(model.rotation));
      u.k.value = model.distortion?.coefficients ?? new Array(8).fill(0);
    }
    invalidate();
  }, [material, source, lutTexture, range, transform, model, rectify, background, invalidate]);
  return (
    <mesh material={material} renderOrder={-1e6} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Makes the canvas camera project like the real camera, in the displayed image's pixels. */
function ImageCamera({
  intrinsics,
  width,
  height,
}: {
  intrinsics: Intrinsics;
  width: number;
  height: number;
}) {
  const set = useThree((state) => state.set);
  const invalidate = useThree((state) => state.invalidate);
  const camera = useMemo(() => {
    const c = new IntrinsicCamera();
    c.near = 0.01;
    c.far = 1000;
    return c;
  }, []);
  useLayoutEffect(() => set({ camera }), [camera, set]);
  useLayoutEffect(() => {
    camera.setIntrinsics(intrinsics, width, height);
    invalidate();
  }, [camera, intrinsics, width, height, invalidate]);
  return null;
}

/** Renders again whenever `version` changes; the canvas otherwise only draws on demand. */
function Invalidate({ version }: { version: unknown }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => invalidate(), [version, invalidate]);
  return null;
}

/** Largest size with the image's aspect ratio that fits the panel. */
function useFit(aspect: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = Math.min(box.width, box.height * aspect);
  return { ref, width: Math.floor(width), height: Math.floor(width / aspect) };
}

export default function ImageView({
  source,
  transform,
  model,
  intrinsics,
  rectify,
  lut,
  range,
  background,
  overlay,
  version,
  children,
}: {
  source: ImageSource;
  transform: ImageTransform;
  /** Calibration, when there is one: needed for Rectify. */
  model: CameraModel | null;
  /** Intrinsics of the displayed image; overlays project through them. */
  intrinsics: Intrinsics;
  rectify: boolean;
  lut: Uint8Array<ArrayBuffer>;
  range: [number, number];
  background: string;
  /** Fixed frame → displayed optical frame; null draws no overlays. */
  overlay: THREE.Matrix4 | null;
  /** Anything that should redraw the canvas when it changes (TF, layer data). */
  version: unknown;
  children?: ReactNode;
}) {
  const fit = useFit(transform.width / transform.height);
  return (
    <div ref={fit.ref} className="image-view">
      <div className="image-view-canvas" style={{ width: fit.width, height: fit.height }}>
        {fit.width > 0 && (
          <Canvas frameloop="demand" dpr={[1, 2]} aria-label="Camera feed" style={{ background }}>
            <ImageCamera
              intrinsics={intrinsics}
              width={transform.width}
              height={transform.height}
            />
            <ImageBackground
              source={source}
              transform={transform}
              model={model}
              rectify={rectify}
              lut={lut}
              range={range}
              background={background}
            />
            <ambientLight intensity={1.0} />
            <directionalLight position={[10, -10, 10]} intensity={1} />
            {overlay && (
              <group matrix={overlay} matrixAutoUpdate={false}>
                {children}
              </group>
            )}
            <Invalidate version={version} />
          </Canvas>
        )}
      </div>
    </div>
  );
}
