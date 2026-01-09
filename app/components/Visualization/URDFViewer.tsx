'use client';

import { useEffect, useState, useRef } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/app/hooks/useTopic';
import Scene3D from './Scene3D';
import { Loader2 } from 'lucide-react';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';

interface URDFViewerProps {
  client: ROSBridge | null;
}

function URDFModel({ urdfString }: { urdfString: string }) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!urdfString) return;

    console.log('URDFModel: Attempting to parse URDF, length:', urdfString.length);

    try {
      const loader = new URDFLoader();
      
      // Set package path resolver - provide empty resolver to avoid external file loading
      loader.packages = {};
      
      // Parse URDF from string
      const robot = loader.parse(urdfString);
      console.log('URDFModel: Successfully parsed URDF, model:', robot);
      
      // Add materials to all meshes that don't have them
      robot.traverse((child: any) => {
        if (child.isMesh) {
          if (!child.material) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xcccccc,
              metalness: 0.3,
              roughness: 0.7
            });
          }
          // Ensure materials are visible
          if (child.material) {
            child.material.needsUpdate = true;
          }
          // Ensure meshes cast and receive shadows
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      // Calculate bounding box to center and scale the model
      const box = new THREE.Box3().setFromObject(robot);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      console.log('URDFModel: Bounding box size:', size);
      console.log('URDFModel: Center:', center);
      console.log('URDFModel: Children count:', robot.children.length);
      
      // Center the model at origin
      robot.position.sub(center);
      
      // Scale if needed (if model is too small or too large)
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const targetSize = 2; // Target size in scene units
        const scale = targetSize / maxDim;
        console.log('URDFModel: Applying scale:', scale);
        robot.scale.multiplyScalar(scale);
      }
      
      setModel(robot);
      setLoading(false);
    } catch (err) {
      console.error('URDFModel: Error loading URDF:', err);
      setError('Failed to load URDF model');
      setLoading(false);
    }
  }, [urdfString]);

  // Log when ref changes
  useEffect(() => {
    if (groupRef.current && model) {
      console.log('URDFModel: Group ref attached, children:', groupRef.current.children.length);
    }
  }, [model]);

  if (loading) {
    console.log('URDFModel: Still loading...');
    return null;
  }
  
  if (error) {
    console.log('URDFModel: Error state:', error);
    return (
      <mesh>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  }
  
  if (!model) {
    console.log('URDFModel: No model available');
    return null;
  }

  console.log('URDFModel: Rendering model');
  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}

export default function URDFViewer({ client }: URDFViewerProps) {
  const { data: urdfData } = useTopic<{ data: string }>(
    client,
    '/robot_description',
    'std_msgs/String'
  );

  const urdfString = urdfData?.data;

  // Debug logging
  useEffect(() => {
    if (urdfData) {
      console.log('URDF data received:', {
        hasData: !!urdfData.data,
        dataLength: urdfData.data?.length,
        dataPreview: urdfData.data?.substring(0, 100)
      });
    }
  }, [urdfData]);

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800">
        URDF Viewer
        {urdfData && (
          <span className="ml-2 text-green-400">• Data received</span>
        )}
      </div>

      {!urdfString ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              Waiting for /robot_description topic...
            </p>
          </div>
        </div>
      ) : (
        <Scene3D>
          <URDFModel urdfString={urdfString} />
        </Scene3D>
      )}
    </div>
  );
}
