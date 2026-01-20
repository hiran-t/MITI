'use client';

import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { createMeshLoadManager } from '@/lib/utils/urdf-url-loader';
import type { sensor_msgs } from '@/types/ros-messages';

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
function hasSetJointValues(
  obj: unknown
): obj is { setJointValues: (values: Record<string, number>) => boolean } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'setJointValues' in obj &&
    typeof obj.setJointValues === 'function'
  );
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

/**
 * Configures URDF loader with package paths
 */
function configureURDFLoader(
  loader: URDFLoader,
  urdfString: string,
  meshBaseUrl?: string,
  packageMapping?: Record<string, string>
): void {
  if (!meshBaseUrl) {
    loader.packages = packageMapping || {};
    return;
  }

  // Extract package names from URDF content
  const packageMatches = urdfString.match(/package:\/\/([^\/\s"']+)/g);
  const detectedPackages: Record<string, string> = {};

  if (packageMatches) {
    packageMatches.forEach((match) => {
      const packageName = match.replace('package://', '');
      if (!detectedPackages[packageName]) {
        detectedPackages[packageName] = meshBaseUrl;
      }
    });
  }

  loader.packages = {
    'ur_description': meshBaseUrl,
    ...detectedPackages,
    ...packageMapping,
  };
}

/**
 * Creates a custom mesh loader callback that handles different mesh formats
 */
function createMeshLoader(
  loader: URDFLoader,
  meshBaseUrl?: string
): (path: string, manager: THREE.LoadingManager, done: (mesh: THREE.Object3D, err?: Error) => void) => void {
  return function loadMesh(path: string, manager: THREE.LoadingManager, done: (mesh: THREE.Object3D, err?: Error) => void) {
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
          done(new THREE.Group(), error instanceof Error ? error : new Error(String(error)));
        }
      );
    } else if (extension === 'stl') {
      const stlLoader = new STLLoader(manager);
      stlLoader.load(
        resolvedPath,
        (geometry: THREE.BufferGeometry) => {
          console.log('✅ Loaded STL:', resolvedPath);
          const material = new THREE.MeshPhongMaterial({
            color: 0xaaaaaa,
            flatShading: false,
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
}

/**
 * Processes and centers the robot model
 */
function processRobotModel(robot: THREE.Object3D): void {
  // Add materials to all meshes that don't have them
  let meshCount = 0;
  robot.traverse((child: any) => {
    if (child.isMesh) {
      meshCount++;
      if (!child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.3,
          roughness: 0.7,
        });
      }
      if (child.material) {
        child.material.needsUpdate = true;
        if (child.material.transparent) {
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      }
      child.castShadow = true;
      child.receiveShadow = true;
      child.visible = true;
    }
  });

  console.log('  - Total meshes:', meshCount);

  // Calculate bounding box to center and scale the model
  const box = new THREE.Box3().setFromObject(robot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (!box.isEmpty()) {
    // Center the model at origin
    robot.position.sub(center);

    // Scale if needed
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const targetSize = 2; // Target size in scene units
      const scale = targetSize / maxDim;
      robot.scale.multiplyScalar(scale);
    }
  } else {
    console.warn('URDFModel: Empty bounding box, skipping centering and scaling');
    robot.scale.set(1, 1, 1);
  }

  robot.visible = true;
}

export default function URDFModel({
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

  // Use refs to store callbacks to avoid including them in dependency array
  // This prevents unnecessary reloads when parent component rerenders
  const callbacksRef = useRef({ onLoadStart, onLoadComplete, onLoadError, onLoadProgress });
  useEffect(() => {
    callbacksRef.current = { onLoadStart, onLoadComplete, onLoadError, onLoadProgress };
  }, [onLoadStart, onLoadComplete, onLoadError, onLoadProgress]);

  useEffect(() => {
    if (!urdfString) return;

    console.log('URDFModel: Attempting to parse URDF, length:', urdfString.length);

    if (callbacksRef.current.onLoadStart) {
      callbacksRef.current.onLoadStart();
    }

    const loadURDF = async () => {
      try {
        // Create custom loading manager if meshBaseUrl is provided
        const manager = meshBaseUrl
          ? createMeshLoadManager(
              meshBaseUrl,
              packageMapping,
              (url, loaded, total) => {
                console.log(`Loading: ${url} (${loaded}/${total})`);
                if (callbacksRef.current.onLoadProgress) {
                  callbacksRef.current.onLoadProgress(loaded, total);
                }
              },
              (url) => {
                console.error('Failed to load mesh:', url);
              }
            )
          : new THREE.LoadingManager();

        // Set up a promise to wait for all meshes to load (with timeout)
        let loadingResolved = false;
        const loadingComplete = new Promise<void>((resolve) => {
          manager.onLoad = () => {
            if (!loadingResolved) {
              loadingResolved = true;
              console.log('✅ All meshes loaded successfully');
              resolve();
            }
          };
          manager.onError = (url) => {
            console.error('❌ Error loading:', url);
          };

          // Timeout after 30 seconds if loading takes too long
          setTimeout(() => {
            if (!loadingResolved) {
              loadingResolved = true;
              console.warn('⚠️ Loading timeout - proceeding with partial model');
              resolve();
            }
          }, 30000);
        });

        const loader = new URDFLoader(manager);
        configureURDFLoader(loader, urdfString, meshBaseUrl, packageMapping);
        loader.loadMeshCb = createMeshLoader(loader, meshBaseUrl);

        // Parse URDF from string
        const robot = loader.parse(urdfString);
        console.log('URDFModel: Successfully parsed URDF');

        // Wait for all meshes to load before proceeding
        console.log('⏳ Waiting for meshes to load...');
        await loadingComplete;
        console.log('✅ Mesh loading complete, processing model...');

        // Process and center the model
        processRobotModel(robot);

        setModel(robot);
        setLoading(false);

        if (callbacksRef.current.onLoadComplete) {
          callbacksRef.current.onLoadComplete();
        }
      } catch (err) {
        console.error('URDFModel: Error loading URDF:', err);
        const errorMsg = 'Failed to load URDF model';
        setError(errorMsg);
        setLoading(false);

        if (callbacksRef.current.onLoadError) {
          callbacksRef.current.onLoadError(err instanceof Error ? err : new Error(errorMsg));
        }
      }
    };

    loadURDF();
    // Only include actual data dependencies, not callbacks
    // Callbacks are stored in refs and updated separately
  }, [urdfString, meshBaseUrl, packageMapping]);

  // Update joint positions when jointStates change
  useEffect(() => {
    if (!model || !jointStates) return;

    if (hasSetJointValues(model)) {
      const jointValues: Record<string, number> = {};
      jointStates.name.forEach((name, index) => {
        if (index < jointStates.position.length) {
          jointValues[name] = jointStates.position[index];
        }
      });

      const changed = model.setJointValues(jointValues);
      if (changed) {
        console.log('URDFModel: Updated joint positions:', Object.keys(jointValues).length, 'joints');
      }
    }
  }, [model, jointStates]);

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  }

  if (!model) {
    return null;
  }

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}
