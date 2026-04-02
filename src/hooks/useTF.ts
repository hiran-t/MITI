/**
 * Hook for managing TF (Transform) data from ROS
 * Subscribes to /tf and /tf_static topics and maintains the TF tree
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { TFMessage, TFFrame, TFTree, TFTransformStamped } from '@/types/tf-messages';
import { ROSBridge } from '@/lib/rosbridge/client';
import { TF_TOPICS } from '@/constants/ros-topics';

interface UseTFOptions {
  rosbridgeClient: ROSBridge | null;
  maxAge?: number;
  enabled?: boolean;
  tfTopics?: string[];
}

export function useTF({
  rosbridgeClient,
  maxAge = 10000,
  enabled = true,
  tfTopics = [TF_TOPICS.DYNAMIC, TF_TOPICS.STATIC],
}: UseTFOptions): { tfTree: TFTree; isLoading: boolean } {
  const [tfTree, setTfTree] = useState<TFTree>({
    frames: new Map(),
    rootFrame: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const framesRef = useRef<Map<string, TFFrame>>(new Map());

  const updateTransform = useCallback((transformStamped: TFTransformStamped) => {
    const parentFrame = transformStamped.header.frame_id;
    const childFrame = transformStamped.child_frame_id;
    const timestamp = Date.now();

    const existingFrame = framesRef.current.get(childFrame);
    const updatedFrame: TFFrame = {
      name: childFrame,
      parent: parentFrame,
      transform: transformStamped.transform,
      timestamp,
      children: existingFrame?.children || [],
    };

    framesRef.current.set(childFrame, updatedFrame);

    if (parentFrame) {
      const parentFrameData = framesRef.current.get(parentFrame);
      if (parentFrameData) {
        if (!parentFrameData.children.includes(childFrame)) {
          parentFrameData.children.push(childFrame);
        }
      } else {
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

  const findRootFrame = useCallback(() => {
    const frames = Array.from(framesRef.current.entries());
    for (const [frameName, frame] of frames) {
      if (!frame.parent) {
        return frameName;
      }
    }
    return null;
  }, []);

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

    let updateInterval: NodeJS.Timeout;
    const frames = framesRef.current;

    const handleTFMessage = (message: unknown) => {
      const msg = message as TFMessage;
      if (msg.transforms && Array.isArray(msg.transforms)) {
        msg.transforms.forEach(updateTransform);
      }
    };

    tfTopics.forEach((topic) => {
      const throttle = topic.includes('static') ? undefined : { throttle_rate: 100 };
      rosbridgeClient.subscribe(topic, handleTFMessage, 'tf2_msgs/TFMessage', throttle);
    });

    updateInterval = setInterval(() => {
      updateState();
    }, 100);

    setIsLoading(false);

    return () => {
      tfTopics.forEach((topic) => {
        rosbridgeClient.unsubscribe(topic);
      });
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      frames.clear();
    };
  }, [enabled, rosbridgeClient, updateTransform, updateState, tfTopics]);

  return {
    tfTree,
    isLoading,
  };
}
