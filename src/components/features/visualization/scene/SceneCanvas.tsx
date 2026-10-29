'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ViewSettings } from '@/types/scene-config';
import { visualizationStyles } from '@/styles';

export interface RenderStats {
  fps: number;
  calls: number;
  triangles: number;
}

const DEG = Math.PI / 180;
const round = (value: number, digits: number) => Number(value.toFixed(digits));
const viewKey = (view: ViewSettings) => JSON.stringify(view);

/** Height in world units that the orthographic camera shows, matching perspective at `distance`. */
const visibleHeight = (view: ViewSettings) => 2 * view.distance * Math.tan((view.fovy * DEG) / 2);

function applyView(
  camera: THREE.Camera,
  controls: OrbitControlsImpl | null,
  view: ViewSettings,
  height: number
) {
  const target = new THREE.Vector3(...view.targetOffset);
  const phi = view.phi * DEG;
  const theta = view.thetaOffset * DEG;
  camera.position.set(
    target.x + view.distance * Math.sin(phi) * Math.cos(theta),
    target.y + view.distance * Math.sin(phi) * Math.sin(theta),
    target.z + view.distance * Math.cos(phi)
  );
  camera.up.set(0, 0, 1);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = view.fovy;
    camera.near = view.near;
    camera.far = view.far;
    camera.updateProjectionMatrix();
  } else if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = height / visibleHeight(view);
    camera.near = -view.far;
    camera.far = view.far;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(target);
  if (controls) {
    controls.target.copy(target);
    controls.update();
  }
}

function readView(
  camera: THREE.Camera,
  controls: OrbitControlsImpl,
  view: ViewSettings,
  height: number
): ViewSettings {
  const target = controls.target;
  const offset = camera.position.clone().sub(target);
  const length = offset.length() || 1;
  const distance =
    camera instanceof THREE.OrthographicCamera
      ? height / camera.zoom / (2 * Math.tan((view.fovy * DEG) / 2))
      : length;
  return {
    ...view,
    distance: round(distance, 3),
    targetOffset: [round(target.x, 3), round(target.y, 3), round(target.z, 3)],
    phi: round(Math.acos(Math.max(-1, Math.min(1, offset.z / length))) / DEG, 2),
    thetaOffset: round(Math.atan2(offset.y, offset.x) / DEG, 2),
  };
}

/** Keeps the camera and the View settings in sync in both directions. */
function CameraRig({
  view,
  onViewChange,
  enabled,
}: {
  view: ViewSettings;
  onViewChange: (view: ViewSettings) => void;
  enabled: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const height = useThree((state) => state.size.height);
  const applied = useRef('');
  useEffect(() => {
    const key = `${viewKey(view)}|${camera.uuid}|${height}`;
    if (key === applied.current) return;
    applyView(camera, controls.current, view, height);
    applied.current = key;
  }, [view, camera, height]);
  return (
    <>
      {view.perspective ? (
        <PerspectiveCamera
          makeDefault
          up={[0, 0, 1]}
          fov={view.fovy}
          near={view.near}
          far={view.far}
        />
      ) : (
        <OrthographicCamera makeDefault up={[0, 0, 1]} near={-view.far} far={view.far} />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={enabled}
        onEnd={() => {
          if (!controls.current) return;
          const next = readView(camera, controls.current, view, height);
          // Record what the camera already shows so writing it back does not move it again.
          applied.current = `${viewKey(next)}|${camera.uuid}|${height}`;
          onViewChange(next);
        }}
      />
    </>
  );
}

function StatsProbe({ onStats }: { onStats: (stats: RenderStats) => void }) {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  const since = useRef(performance.now());
  useFrame(() => {
    frames.current += 1;
    const now = performance.now();
    if (now - since.current < 500) return;
    onStats({
      fps: Math.round((frames.current * 1000) / (now - since.current)),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    });
    frames.current = 0;
    since.current = now;
  });
  return null;
}

/**
 * The 3D scene canvas. Children are expressed in the fixed frame; `follow` moves them so the
 * camera stays with the display frame.
 */
export default function SceneCanvas({
  background,
  view,
  onViewChange,
  follow,
  controlsEnabled = true,
  onStats,
  children,
}: {
  background: string;
  view: ViewSettings;
  onViewChange: (view: ViewSettings) => void;
  /** Transform from the fixed frame into the camera's frame of reference. */
  follow: THREE.Matrix4;
  controlsEnabled?: boolean;
  onStats?: (stats: RenderStats) => void;
  children: ReactNode;
}) {
  return (
    <Canvas
      className={visualizationStyles.scene.canvas}
      style={{ touchAction: 'none', background }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <color attach="background" args={[background]} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[10, -10, 10]} intensity={1} />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} />
      <CameraRig view={view} onViewChange={onViewChange} enabled={controlsEnabled} />
      <group matrix={follow} matrixAutoUpdate={false}>
        {children}
      </group>
      {onStats && <StatsProbe onStats={onStats} />}
    </Canvas>
  );
}
