/**
 * TFVisualizer component
 * Renders TF frames with coordinate axes and connections between parent-child frames
 * Similar to RViz TF display
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { TFTree, TFFrame, Transform } from '@/types/tf-messages';

interface TFVisualizerProps {
  tfTree: TFTree;
  axisLength?: number; // Length of coordinate axes
  lineWidth?: number; // Width of connection lines
  showLabels?: boolean; // Whether to show frame labels
  labelSize?: number; // Size of frame labels
  showAxes?: boolean; // Whether to show coordinate axes
  showConnections?: boolean; // Whether to show parent-child connections
  baseFrame?: string; // Base frame name (e.g., 'base_link') to make transforms relative
  baseLinkPosition?: THREE.Vector3 | null; // Position from URDF base_link
  baseLinkQuaternion?: THREE.Quaternion | null; // Rotation from URDF base_link
}

export default function TFVisualizer({
  tfTree,
  axisLength = 0.3,
  lineWidth = 2,
  showLabels = false,
  labelSize = 0.05,
  showAxes = true,
  showConnections = true,
  baseFrame = 'base_link', // Always use base_link as reference
  baseLinkPosition,
  baseLinkQuaternion,
}: TFVisualizerProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Convert quaternion to Euler angles and create rotation matrix
  const quaternionToMatrix = (q: { x: number; y: number; z: number; w: number }) => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    matrix.makeRotationFromQuaternion(quaternion);
    return matrix;
  };

  // Calculate world transform for a frame recursively
  const getWorldTransform = (frameName: string, cache: Map<string, THREE.Matrix4> = new Map()): THREE.Matrix4 => {
    // Check cache first
    if (cache.has(frameName)) {
      return cache.get(frameName)!.clone();
    }

    const frame = tfTree.frames.get(frameName);
    
    if (!frame) return new THREE.Matrix4();

    // If baseFrame is specified and this is the base frame, return identity matrix
    if (baseFrame && frameName === baseFrame) {
      const identity = new THREE.Matrix4();
      cache.set(frameName, identity);
      return identity.clone();
    }

    // Create local transform matrix
    const position = new THREE.Vector3(
      frame.transform.translation.x,
      frame.transform.translation.y,
      frame.transform.translation.z
    );
    const quaternion = new THREE.Quaternion(
      frame.transform.rotation.x,
      frame.transform.rotation.y,
      frame.transform.rotation.z,
      frame.transform.rotation.w
    );
    
    const localTransform = new THREE.Matrix4();
    localTransform.compose(position, quaternion, new THREE.Vector3(1, 1, 1));

    // If no parent, this is a root frame - return identity (stay at origin)
    if (!frame.parent) {
      const identity = new THREE.Matrix4();
      cache.set(frameName, identity);
      return identity.clone();
    }

    // If parent is baseFrame (when specified), this is the local transform
    if (baseFrame && frame.parent === baseFrame) {
      cache.set(frameName, localTransform);
      return localTransform.clone();
    }

    // Get parent's world transform recursively
    const parentWorldTransform = getWorldTransform(frame.parent, cache);
    
    // Calculate world transform: parent_world * local
    const worldTransform = new THREE.Matrix4();
    worldTransform.multiplyMatrices(parentWorldTransform, localTransform);
    
    cache.set(frameName, worldTransform);
    return worldTransform.clone();
  };

  // Prepare frame data with world transforms
  const frameData = useMemo(() => {
    const data: Array<{
      name: string;
      worldMatrix: THREE.Matrix4;
      position: THREE.Vector3;
      rotation: THREE.Quaternion;
      parent: string | null;
      parentPosition?: THREE.Vector3;
    }> = [];

    // Create a shared cache for all getWorldTransform calls
    const transformCache = new Map<string, THREE.Matrix4>();

    tfTree.frames.forEach((frame, frameName) => {
      const worldMatrix = getWorldTransform(frameName, transformCache);
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      worldMatrix.decompose(position, rotation, scale);

      const frameInfo: any = {
        name: frameName,
        worldMatrix,
        position,
        rotation,
        parent: frame.parent,
      };

      // Get parent position for drawing connection line
      if (frame.parent) {
        const parentMatrix = getWorldTransform(frame.parent, transformCache);
        const parentPosition = new THREE.Vector3();
        parentMatrix.decompose(parentPosition, new THREE.Quaternion(), new THREE.Vector3());
        frameInfo.parentPosition = parentPosition;
      } else if (frameName === baseFrame) {
        // For base frame with no parent, connect to world origin
        frameInfo.parentPosition = new THREE.Vector3(0, 0, 0);
      }

      data.push(frameInfo);
    });

    return data;
  }, [tfTree, baseFrame]);

  // Apply base_link transform from URDF model
  const groupPosition: [number, number, number] = baseLinkPosition 
    ? [baseLinkPosition.x, baseLinkPosition.y, baseLinkPosition.z]
    : [0, 0, 0];
  
  const groupQuaternion: [number, number, number, number] | undefined = baseLinkQuaternion
    ? [baseLinkQuaternion.x, baseLinkQuaternion.y, baseLinkQuaternion.z, baseLinkQuaternion.w]
    : undefined;

  return (
    <>
      {/* World frame at origin (outside the transformed group) */}
      <group position={[0, 0, 0]}>
        {/* World X axis (red) */}
        <Line
          points={[[0, 0, 0], [axisLength * 2, 0, 0]]}
          color="red"
          lineWidth={lineWidth * 2}
        />
        {/* World Y axis (green) */}
        <Line
          points={[[0, 0, 0], [0, axisLength * 2, 0]]}
          color="lime"
          lineWidth={lineWidth * 2}
        />
        {/* World Z axis (blue) */}
        <Line
          points={[[0, 0, 0], [0, 0, axisLength * 2]]}
          color="blue"
          lineWidth={lineWidth * 2}
        />
        {/* World frame label */}
        {showLabels && (
          <Text
            position={[0, 0, axisLength * 3]}
            fontSize={labelSize * 1.2}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={labelSize * 0.15}
            outlineColor="black"
          >
            world
          </Text>
        )}
      </group>

      {/* Connection line from world to base_link */}
      {baseLinkPosition && (
        <Line
          points={[
            [0, 0, 0],
            [baseLinkPosition.x, baseLinkPosition.y, baseLinkPosition.z],
          ]}
          color="yellow"
          lineWidth={lineWidth * 1.0}
          dashed
          dashScale={50}
          dashSize={1}
          gapSize={0}
        />
      )}

      {/* TF frames (transformed by base_link) */}
      <group ref={groupRef} position={groupPosition} quaternion={groupQuaternion}>
        {frameData.map((frame) => (
        <group key={frame.name}>
          {/* Frame coordinate axes */}
          {showAxes && (
            <group position={frame.position} quaternion={frame.rotation}>
              {/* X axis (red) */}
              <Line
                points={[[0, 0, 0], [axisLength, 0, 0]]}
                color="red"
                lineWidth={lineWidth * 1.5}
              />
              {/* Y axis (green) */}
              <Line
                points={[[0, 0, 0], [0, axisLength, 0]]}
                color="lime"
                lineWidth={lineWidth * 1.5}
              />
              {/* Z axis (blue) */}
              <Line
                points={[[0, 0, 0], [0, 0, axisLength]]}
                color="blue"
                lineWidth={lineWidth * 1.5}
              />
            </group>
          )}

          {/* Connection line to parent */}
          {showConnections && frame.parentPosition && (
            <Line
              points={[
                [frame.parentPosition.x, frame.parentPosition.y, frame.parentPosition.z],
                [frame.position.x, frame.position.y, frame.position.z],
              ]}
              color="yellow"
              lineWidth={lineWidth * 1.0}
              dashed
              dashScale={50}
              dashSize={1}
              gapSize={0}
            />
          )}

          {/* Frame label */}
          {showLabels && (
            <Text
              position={[
                frame.position.x,
                frame.position.y,
                frame.position.z + axisLength * 1.5,
              ]}
              fontSize={labelSize}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={labelSize * 0.1}
              outlineColor="black"
            >
              {frame.name}
            </Text>
          )}
        </group>
      ))}
      </group>
    </>
  );
}
