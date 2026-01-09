'use client';

import { useEffect, useState, useRef } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/app/hooks/useTopic';
import Scene3D from './Scene3D';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import URDFSourceSelector from './URDFSourceSelector';
import URDFSettings from './URDFSettings';
import URDFLoadStatus from './URDFLoadStatus';
import { loadURDFFromURL, createMeshLoadManager, formatURDFError } from '@/lib/utils/urdf-url-loader';
import { URDFLoadError } from '@/types/urdf-loader';

interface URDFViewerProps {
  client: ROSBridge | null;
  // Mode selection
  mode?: 'topic' | 'url';
  // For topic mode
  topic?: string;
  // For URL mode
  urdfUrl?: string;
  meshBaseUrl?: string;
  packageMapping?: Record<string, string>;
  // Callbacks
  onModeChange?: (mode: 'topic' | 'url') => void;
  onTopicChange?: (topic: string) => void;
  onUrdfUrlChange?: (url: string) => void;
  onMeshBaseUrlChange?: (url: string) => void;
  onPackageMappingChange?: (mapping: Record<string, string>) => void;
}

interface URDFModelProps {
  urdfString: string;
  meshBaseUrl?: string;
  packageMapping?: Record<string, string>;
  onLoadStart?: () => void;
  onLoadComplete?: () => void;
  onLoadError?: (error: Error) => void;
  onLoadProgress?: (loaded: number, total: number) => void;
}

function URDFModel({ 
  urdfString, 
  meshBaseUrl, 
  packageMapping,
  onLoadStart,
  onLoadComplete,
  onLoadError,
  onLoadProgress,
}: URDFModelProps) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!urdfString) return;

    console.log('URDFModel: Attempting to parse URDF, length:', urdfString.length);
    
    if (onLoadStart) {
      onLoadStart();
    }

    try {
      // Create custom loading manager if meshBaseUrl is provided
      const manager = meshBaseUrl 
        ? createMeshLoadManager(
            meshBaseUrl, 
            packageMapping,
            (url, loaded, total) => {
              if (onLoadProgress) {
                onLoadProgress(loaded, total);
              }
            },
            (url) => {
              console.error('Failed to load mesh:', url);
            }
          )
        : undefined;

      const loader = new URDFLoader(manager);
      
      // Set package path resolver - provide empty resolver to avoid external file loading when not using URLs
      loader.packages = packageMapping || {};
      
      // Parse URDF from string
      const robot = loader.parse(urdfString);
      console.log('URDFModel: Successfully parsed URDF, model:', robot);
      
      // Add materials to all meshes that don't have them
      let meshCount = 0;
      robot.traverse((child: any) => {
        if (child.isMesh) {
          meshCount++;
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
            // Make sure material is not transparent
            if (child.material.transparent) {
              child.material.transparent = false;
              child.material.opacity = 1.0;
            }
          }
          // Ensure meshes cast and receive shadows
          child.castShadow = true;
          child.receiveShadow = true;
          // Make sure mesh is visible
          child.visible = true;
        }
      });
      
      console.log('URDFModel: Mesh count:', meshCount);
      
      // Calculate bounding box to center and scale the model
      const box = new THREE.Box3().setFromObject(robot);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      console.log('URDFModel: Bounding box size:', size);
      console.log('URDFModel: Center:', center);
      console.log('URDFModel: Children count:', robot.children.length);
      
      // Only apply transformations if we have valid bounds
      if (!box.isEmpty()) {
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
      } else {
        console.warn('URDFModel: Empty bounding box, skipping centering and scaling');
        // If bounding box is empty, apply a default scale to make small models visible
        robot.scale.set(10, 10, 10);
        console.log('URDFModel: Applied default scale 10x');
      }
      
      // Ensure the robot itself is visible
      robot.visible = true;
      
      setModel(robot);
      setLoading(false);
      
      if (onLoadComplete) {
        onLoadComplete();
      }
    } catch (err) {
      console.error('URDFModel: Error loading URDF:', err);
      const errorMsg = 'Failed to load URDF model';
      setError(errorMsg);
      setLoading(false);
      
      if (onLoadError) {
        onLoadError(err instanceof Error ? err : new Error(errorMsg));
      }
    }
  }, [urdfString, meshBaseUrl, packageMapping]);

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

export default function URDFViewer({ 
  client,
  mode: initialMode = 'topic',
  topic: initialTopic = '/robot_description',
  urdfUrl: initialUrdfUrl = '',
  meshBaseUrl: initialMeshBaseUrl = '',
  packageMapping: initialPackageMapping = {},
  onModeChange,
  onTopicChange,
  onUrdfUrlChange,
  onMeshBaseUrlChange,
  onPackageMappingChange,
}: URDFViewerProps) {
  const [currentMode, setCurrentMode] = useState<'topic' | 'url'>(initialMode);
  const [currentTopic, setCurrentTopic] = useState(initialTopic);
  const [currentUrdfUrl, setCurrentUrdfUrl] = useState(initialUrdfUrl);
  const [currentMeshBaseUrl, setCurrentMeshBaseUrl] = useState(initialMeshBaseUrl);
  const [currentPackageMapping, setCurrentPackageMapping] = useState(initialPackageMapping);
  
  const [urdfFromUrl, setUrdfFromUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Use topic subscription for topic mode
  const { data: urdfData } = useTopic<{ data: string }>(
    currentMode === 'topic' ? client : null,
    currentTopic,
    'std_msgs/String'
  );

  // Get URDF string based on current mode
  const urdfString = currentMode === 'topic' ? urdfData?.data : urdfFromUrl;

  // Handle mode change
  const handleModeChange = (newMode: 'topic' | 'url') => {
    setCurrentMode(newMode);
    setUrlError(null);
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  // Handle URL loading
  const handleLoadFromUrl = async () => {
    if (!currentUrdfUrl) {
      setUrlError('Please enter a URDF URL');
      return;
    }

    setIsLoadingUrl(true);
    setUrlError(null);
    setUrdfFromUrl(null);
    setLoadProgress(null);

    try {
      const urdfContent = await loadURDFFromURL({
        urdfUrl: currentUrdfUrl,
        meshBaseUrl: currentMeshBaseUrl,
        packageMapping: currentPackageMapping,
      });

      setUrdfFromUrl(urdfContent);
      setIsLoadingUrl(false);

      // Save to recent URLs
      if (typeof window !== 'undefined') {
        try {
          const storedRecent = localStorage.getItem('vizzy_urdf_recent');
          const recent = storedRecent ? JSON.parse(storedRecent) : [];
          
          // Validate that recent is an array
          if (Array.isArray(recent)) {
            const updated = [currentUrdfUrl, ...recent.filter((u: string) => u !== currentUrdfUrl)].slice(0, 5);
            localStorage.setItem('vizzy_urdf_recent', JSON.stringify(updated));
          } else {
            // If corrupted, reset with current URL
            localStorage.setItem('vizzy_urdf_recent', JSON.stringify([currentUrdfUrl]));
          }
        } catch (e) {
          console.error('Failed to save recent URLs:', e);
          // If localStorage fails, continue without saving
        }
      }
    } catch (err: any) {
      console.error('Failed to load URDF from URL:', err);
      const errorMsg = err.type ? formatURDFError(err) : err.message || 'Failed to load URDF';
      setUrlError(errorMsg);
      setIsLoadingUrl(false);
    }
  };

  // Handle preset loading
  const handleLoadPreset = (preset: { urdfUrl: string; meshBaseUrl: string; packageMapping: Record<string, string> }) => {
    setCurrentUrdfUrl(preset.urdfUrl);
    setCurrentMeshBaseUrl(preset.meshBaseUrl);
    setCurrentPackageMapping(preset.packageMapping);
  };

  // Auto-load after preset is set
  useEffect(() => {
    if (currentMode === 'url' && currentUrdfUrl && currentUrdfUrl.startsWith('http')) {
      // Only auto-load if we have a valid URL in URL mode
      const timer = setTimeout(() => {
        handleLoadFromUrl();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentUrdfUrl, currentMeshBaseUrl, currentPackageMapping]);

  // Debug logging for topic mode
  useEffect(() => {
    if (urdfData && currentMode === 'topic') {
      console.log('URDF data received from topic:', {
        hasData: !!urdfData.data,
        dataLength: urdfData.data?.length,
        dataPreview: urdfData.data?.substring(0, 100)
      });
    }
  }, [urdfData, currentMode]);

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
      {/* Header */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800">
            URDF Viewer
            {currentMode === 'topic' && urdfData && (
              <span className="ml-2 text-green-400">• Connected</span>
            )}
            {currentMode === 'url' && urdfFromUrl && (
              <span className="ml-2 text-purple-400">• Loaded</span>
            )}
          </div>

          <URDFSourceSelector 
            mode={currentMode} 
            onModeChange={handleModeChange}
            topic={currentTopic}
            onTopicChange={(topic) => {
              setCurrentTopic(topic);
              if (onTopicChange) onTopicChange(topic);
            }}
            urdfUrl={currentUrdfUrl}
            onUrdfUrlChange={(url) => {
              setCurrentUrdfUrl(url);
              if (onUrdfUrlChange) onUrdfUrlChange(url);
            }}
            meshBaseUrl={currentMeshBaseUrl}
            onMeshBaseUrlChange={(url) => {
              setCurrentMeshBaseUrl(url);
              if (onMeshBaseUrlChange) onMeshBaseUrlChange(url);
            }}
            onLoadUrl={handleLoadFromUrl}
            isLoadingUrl={isLoadingUrl}
          />
        </div>

        <URDFSettings onLoadPreset={handleLoadPreset} />
      </div>

      {/* Loading/Error Status */}
      {(isLoadingUrl || urlError) && (
        <URDFLoadStatus
          loading={isLoadingUrl}
          error={urlError}
          progress={loadProgress || undefined}
          onClose={() => {
            setUrlError(null);
            setIsLoadingUrl(false);
            setLoadProgress(null);
          }}
        />
      )}

      {/* 3D Scene */}
      {!urdfString ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {currentMode === 'topic' ? (
              <>
                <Loader2 className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Waiting for {currentTopic} topic...
                </p>
              </>
            ) : (
              <>
                <Download className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Enter a URDF URL and click Load
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <Scene3D>
          <URDFModel 
            urdfString={urdfString}
            meshBaseUrl={currentMeshBaseUrl || undefined}
            packageMapping={currentPackageMapping}
            onLoadStart={() => setIsLoadingUrl(true)}
            onLoadComplete={() => {
              setIsLoadingUrl(false);
              setLoadProgress(null);
            }}
            onLoadError={(err) => {
              setUrlError(err.message);
              setIsLoadingUrl(false);
            }}
            onLoadProgress={(loaded, total) => {
              setLoadProgress({ loaded, total });
            }}
          />
        </Scene3D>
      )}
    </div>
  );
}
