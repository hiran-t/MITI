'use client';

import { useEffect, useState, useRef } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/app/hooks/useTopic';
import Scene3D from './Scene3D';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import URDFSourceSelector from './URDFSourceSelector';
import URDFSettings from './URDFSettings';
import URDFLoadStatus from './URDFLoadStatus';
import { loadURDFFromURL, createMeshLoadManager, formatURDFError } from '@/lib/utils/urdf-url-loader';
import { URDFLoadError } from '@/types/urdf-loader';
import { sensor_msgs } from '@/types/ros-messages';

/**
 * Helper function to safely concatenate URL parts without double slashes
 */
function joinUrlPath(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Type guard to check if an object has the setJointValues method
 */
function hasSetJointValues(obj: unknown): obj is { setJointValues: (values: Record<string, number>) => boolean } {
  return (
    obj !== null && 
    typeof obj === 'object' && 
    'setJointValues' in obj && 
    typeof obj.setJointValues === 'function'
  );
}

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
  jointStates?: sensor_msgs.JointState | null;
  onLoadStart?: () => void;
  onLoadComplete?: () => void;
  onLoadError?: (error: Error) => void;
  onLoadProgress?: (loaded: number, total: number) => void;
}

function URDFModel({ 
  urdfString, 
  meshBaseUrl, 
  packageMapping,
  jointStates,
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
              console.log(`Loading: ${url} (${loaded}/${total})`);
              if (onLoadProgress) {
                onLoadProgress(loaded, total);
              }
            },
            (url) => {
              console.error('Failed to load mesh:', url);
            }
          )
        : new THREE.LoadingManager();

      const loader = new URDFLoader(manager);
      
      // FIX: Set up package paths correctly
      if (meshBaseUrl) {
        loader.packages = {
          'ur_description': meshBaseUrl,
          ...packageMapping
        };
        console.log('URDFLoader packages configured:', loader.packages);
      } else {
        loader.packages = packageMapping || {};
      }
      
      // FIX: Override loadMeshCb to handle package:// URLs and different mesh formats
      loader.loadMeshCb = function(path: string, manager: THREE.LoadingManager, done: (mesh: THREE.Object3D, err?: Error) => void) {
        console.log('🔄 Loading mesh:', path);
        
        // Resolve package:// paths
        let resolvedPath = path;
        if (path.startsWith('package://')) {
          const match = path.match(/^package:\/\/([^\/]+)\/(.+)$/);
          if (match) {
            const [, packageName, relativePath] = match;
            let baseUrl = meshBaseUrl || '';
            
            // Check if loader.packages is an object and has the package name
            if (loader.packages && typeof loader.packages === 'object' && !Array.isArray(loader.packages) && packageName in loader.packages) {
              baseUrl = loader.packages[packageName];
            } else if (typeof loader.packages === 'function') {
              baseUrl = loader.packages(packageName);
            }
            
            resolvedPath = joinUrlPath(baseUrl, relativePath);
            console.log(`📦 Resolved: ${path} → ${resolvedPath}`);
          }
        }

        // Determine file type and use appropriate loader
        const extension = resolvedPath.split('.').pop()?.toLowerCase();
        
        if (extension === 'dae') {
          // COLLADA (.dae) files
          const colladaLoader = new ColladaLoader(manager);
          colladaLoader.load(
            resolvedPath,
            (collada) => {
              console.log('✅ Loaded COLLADA:', resolvedPath);
              done(collada.scene);
            },
            undefined,
            (error) => {
              console.error('❌ Failed to load COLLADA:', resolvedPath, error);
              done(new THREE.Group(), error instanceof Error ? error : new Error(String(error))); // Return empty group with error
            }
          );
        } else if (extension === 'stl') {
          // STL files
          const stlLoader = new STLLoader(manager);
          stlLoader.load(
            resolvedPath,
            (geometry: THREE.BufferGeometry) => {
              console.log('✅ Loaded STL:', resolvedPath);
              const material = new THREE.MeshPhongMaterial({ 
                color: 0xaaaaaa,
                flatShading: false
              });
              const mesh = new THREE.Mesh(geometry, material);
              done(mesh);
            },
            undefined,
            (error) => {
              console.error('❌ Failed to load STL:', resolvedPath, error);
              done(new THREE.Group(), error instanceof Error ? error : new Error(String(error)));
            }
          );
        } else if (extension === 'obj') {
          // OBJ files
          const objLoader = new OBJLoader(manager);
          objLoader.load(
            resolvedPath,
            (obj: THREE.Group) => {
              console.log('✅ Loaded OBJ:', resolvedPath);
              done(obj);
            },
            undefined,
            (error) => {
              console.error('❌ Failed to load OBJ:', resolvedPath, error);
              done(new THREE.Group(), error instanceof Error ? error : new Error(String(error)));
            }
          );
        } else {
          console.warn('⚠️ Unknown mesh format:', extension, 'for', resolvedPath);
          // Create a placeholder box for unknown formats
          const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
          const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
          const mesh = new THREE.Mesh(geometry, material);
          done(mesh);
        }
      };
      
      // Parse URDF from string
      const robot = loader.parse(urdfString);
      console.log('URDFModel: Successfully parsed URDF');
      console.log('  - Robot name:', (robot as any).name);
      console.log('  - Links:', (robot as any).links ? Object.keys((robot as any).links).length : 0);
      console.log('  - Joints:', (robot as any).joints ? Object.keys((robot as any).joints).length : 0);
      
      // Add materials to all meshes that don't have them
      let meshCount = 0;
      robot.traverse((child: any) => {
        if (child.isMesh) {
          meshCount++;
          console.log('  - Found mesh:', child.name, 'geometry:', child.geometry);
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
      
      console.log('  - Total meshes:', meshCount);
      
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

  // Update joint positions when jointStates change
  useEffect(() => {
    if (!model || !jointStates) return;

    if (hasSetJointValues(model)) {
      // Build joint values dictionary
      const jointValues: Record<string, number> = {};
      jointStates.name.forEach((name, index) => {
        // Ensure we have a valid position value for this joint
        if (index < jointStates.position.length) {
          jointValues[name] = jointStates.position[index];
        }
      });

      // Update all joint values at once
      const changed = model.setJointValues(jointValues);
      if (changed) {
        console.log('URDFModel: Updated joint positions:', Object.keys(jointValues).length, 'joints');
      }
    }
  }, [model, jointStates]);

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

  // Subscribe to joint_states topic for robot motion (only when URDF is loaded)
  const { data: jointStatesData } = useTopic<sensor_msgs.JointState>(
    urdfString ? client : null,
    '/joint_states',
    'sensor_msgs/JointState'
  );

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
            jointStates={jointStatesData}
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
