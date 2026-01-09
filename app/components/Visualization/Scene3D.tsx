'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { ReactNode } from 'react';

interface Scene3DProps {
  children: ReactNode;
}

export default function Scene3D({ children }: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [3, 3, 3], fov: 50 }}
      className="bg-gray-950"
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} />
      
      {/* Grid helper */}
      <Grid
        args={[10, 10]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#9ca3af"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />
      
      {/* Axis helper - simple colored lines */}
      <axesHelper args={[1]} />
      
      {children}
      
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={50}
      />
    </Canvas>
  );
}
