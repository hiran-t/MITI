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

  useEffect(() => {
    if (!urdfString) return;

    try {
      const loader = new URDFLoader();
      // Set package path resolver
      loader.packages = {};
      
      // Load URDF from string
      const robot = loader.parse(urdfString);
      setModel(robot);
      setLoading(false);
    } catch (err) {
      console.error('Error loading URDF:', err);
      setError('Failed to load URDF model');
      setLoading(false);
    }
  }, [urdfString]);

  if (loading) return null;
  if (error || !model) return null;

  return <primitive object={model} />;
}

export default function URDFViewer({ client }: URDFViewerProps) {
  const { data: urdfData } = useTopic<{ data: string }>(
    client,
    '/robot_description',
    'std_msgs/String'
  );

  const urdfString = urdfData?.data;

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800">
        URDF Viewer
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
