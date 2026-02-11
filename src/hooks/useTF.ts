/**
 * Hook for managing TF (Transform) data from ROS
 * Subscribes to /tf and /tf_static topics and maintains the TF tree
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { TFMessage, TFFrame, TFTree, TransformStamped } from '@/types/tf-messages';

interface UseTFOptions {
  rosbridgeClient: any | null;
  maxAge?: number; // Maximum age in milliseconds before a transform is considered stale (default: 10000ms)
  enabled?: boolean; // Whether TF visualization is enabled
}

export function useTF({ rosbridgeClient, maxAge = 10000, enabled = true }: UseTFOptions) {
  const [tfTree, setTfTree] = useState<TFTree>({
    frames: new Map(),
    rootFrame: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const framesRef = useRef<Map<string, TFFrame>>(new Map());

  // Update transform in the tree
  const updateTransform = useCallback((transformStamped: TransformStamped) => {
    const parentFrame = transformStamped.header.frame_id;
    const childFrame = transformStamped.child_frame_id;
    const timestamp = Date.now();

    // Update or create the child frame
    const existingFrame = framesRef.current.get(childFrame);
    const updatedFrame: TFFrame = {
      name: childFrame,
      parent: parentFrame,
      transform: transformStamped.transform,
      timestamp,
      children: existingFrame?.children || [],
    };

    framesRef.current.set(childFrame, updatedFrame);

    // Update parent's children list
    if (parentFrame) {
      const parentFrameData = framesRef.current.get(parentFrame);
      if (parentFrameData) {
        if (!parentFrameData.children.includes(childFrame)) {
          parentFrameData.children.push(childFrame);
        }
      } else {
        // Create parent frame if it doesn't exist
        framesRef.current.set(parentFrame, {
          name: parentFrame,
          parent: null,
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
          timestamp,
          children: [childFrame],
        });
      }
    }
  }, []);

  // Find root frame (frame with no parent)
  const findRootFrame = useCallback(() => {
    const frames = Array.from(framesRef.current.entries());
    for (const [frameName, frame] of frames) {
      if (!frame.parent) {
        return frameName;
      }
    }
    return null;
  }, []);

  // Clean up stale transforms
  const cleanupStaleTransforms = useCallback(() => {
    const now = Date.now();
    const framesToDelete: string[] = [];

    const frames = Array.from(framesRef.current.entries());
    for (const [frameName, frame] of frames) {
      if (now - frame.timestamp > maxAge) {
        framesToDelete.push(frameName);
      }
    }

    framesToDelete.forEach((frameName) => {
      const frame = framesRef.current.get(frameName);
      if (frame && frame.parent) {
        const parentFrame = framesRef.current.get(frame.parent);
        if (parentFrame) {
          parentFrame.children = parentFrame.children.filter((child) => child !== frameName);
        }
      }
      framesRef.current.delete(frameName);
    });
  }, [maxAge]);

  // Update state from ref
  const updateState = useCallback(() => {
    cleanupStaleTransforms();
    const rootFrame = findRootFrame();
    setTfTree({
      frames: new Map(framesRef.current),
      rootFrame,
    });
  }, [cleanupStaleTransforms, findRootFrame]);

  useEffect(() => {
    if (!enabled || !rosbridgeClient || !rosbridgeClient.isConnected()) {
      setIsLoading(true);
      console.log('[TF] Not connecting:', {
        enabled,
        hasClient: !!rosbridgeClient,
        isConnected: rosbridgeClient?.isConnected(),
      });
      return;
    }

    let tfSubscriptionId: string | undefined;
    let tfStaticSubscriptionId: string | undefined;
    let updateInterval: NodeJS.Timeout;

    const handleTFMessage = (message: TFMessage) => {
      if (message.transforms && Array.isArray(message.transforms)) {
        message.transforms.forEach(updateTransform);
      }
    };

    console.log('[TF] Subscribing to /tf and /tf_static topics...');

    // Subscribe to /tf topic (dynamic transforms)
    rosbridgeClient.subscribe(
      '/tf',
      handleTFMessage,
      'tf2_msgs/TFMessage',
      { throttle_rate: 100 } // Throttle to 10Hz
    );

    // Subscribe to /tf_static topic (static transforms)
    rosbridgeClient.subscribe('/tf_static', handleTFMessage, 'tf2_msgs/TFMessage');

    // Update state periodically
    updateInterval = setInterval(() => {
      updateState();
    }, 100); // Update UI at 10Hz

    setIsLoading(false);

    return () => {
      if (tfSubscriptionId) {
        rosbridgeClient.unsubscribe('/tf');
      }
      if (tfStaticSubscriptionId) {
        rosbridgeClient.unsubscribe('/tf_static');
      }
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      // Clear frames when unmounting
      framesRef.current.clear();
    };
  }, [enabled, rosbridgeClient, updateTransform, updateState]);

  return {
    tfTree,
    isLoading,
  };
}
