'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { ReactNode } from 'react';
import { visualizationStyles } from '@/styles';

interface Scene3DProps {
  children: ReactNode;
}

export default function Scene3D({ children }: Scene3DProps) {
  return (
    <Canvas
      camera={{
        position: [5, -4, 4],
        fov: 25,
        up: [0, 0, 1], // Z-up coordinate system (ROS convention)
      }}
      className={visualizationStyles.scene.canvas}
      shadows
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <ambientLight intensity={1.0} />
      <directionalLight
        position={[10, -10, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} />
      <pointLight position={[0, 0, 10]} intensity={0.5} />

      {/* Grid helper on XY plane (Z-up) */}
      <Grid
        args={[25, 25]}
        cellSize={1.0}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#9ca3af"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
        rotation={[Math.PI / 2, 0, 0]} // Rotate grid to XY plane
      />

      {/* Axis helper - larger and more visible */}
      <axesHelper args={[2]} />

      {children}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={50}
        target={[0, 1, 1]}
      />
    </Canvas>
  );
}
