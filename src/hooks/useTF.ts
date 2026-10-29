'use client';
import { useEffect, useState } from 'react';
import type { TFMessage, TFTree, TFFrame } from '@/types/tf-messages';
import type { ROSBridge } from '@/lib/rosbridge/client';
import { frameName, stampSeconds, transformMatrix } from '@/lib/scene/transforms';
const DEFAULT_TOPICS = ['/tf', '/tf_static'];
interface UseTFOptions {
  rosbridgeClient: ROSBridge | null;
  maxAge?: number;
  enabled?: boolean;
  tfTopics?: string[];
  staticTopics?: string[];
}
export function useTF({
  rosbridgeClient,
  maxAge = 30000,
  enabled = true,
  tfTopics = DEFAULT_TOPICS,
  staticTopics,
}: UseTFOptions): { tfTree: TFTree; isLoading: boolean } {
  const [tfTree, setTree] = useState<TFTree>({ frames: new Map(), rootFrame: null });
  const [isLoading, setLoading] = useState(true);
  // Topic identity, rather than array identity, controls subscriptions.
  const staticKey = JSON.stringify(
    staticTopics ?? tfTopics.filter((topic) => topic.includes('static'))
  );
  const topicKey = JSON.stringify(tfTopics);
  useEffect(() => {
    const frames = new Map<string, TFFrame>();
    setTree({ frames: new Map(), rootFrame: null });
    setLoading(true);
    if (!enabled || !rosbridgeClient) return;
    const staticList: string[] = JSON.parse(staticKey);
    const topics: string[] = Array.from(
      new Set<string>([...JSON.parse(topicKey), ...staticList])
    ).filter(Boolean);
    const subscriptions = topics.map((topic) => {
      const isStatic = staticList.includes(topic);
      const callback = (data: unknown) => {
        const msg = data as TFMessage;
        if (!Array.isArray(msg?.transforms)) return;
        for (const item of msg.transforms) {
          try {
            transformMatrix(item.transform);
            const name = frameName(item.child_frame_id),
              parent = frameName(item.header.frame_id);
            if (!name || !parent || name === parent) continue;
            const previous = frames.get(name),
              time = stampSeconds(item.header.stamp);
            let history =
              previous?.parent === parent && !previous.isStatic
                ? [...(previous.history ?? [])]
                : [];
            if (!isStatic) {
              history = history.filter((s) => s.time !== time);
              history.push({ time, transform: item.transform });
              history.sort((a, b) => a.time - b.time);
              const newest = history[history.length - 1].time;
              history = history.filter((s) => s.time >= newest - 30).slice(-300);
            }
            frames.set(name, {
              name,
              parent,
              transform: isStatic ? item.transform : history[history.length - 1].transform,
              timestamp: Date.now(),
              children: [],
              isStatic,
              history,
            });
          } catch {
            /* Ignore invalid TF packets; consumers report missing transforms. */
          }
        }
        setLoading(false);
      };
      rosbridgeClient.subscribe(topic, callback, 'tf2_msgs/msg/TFMessage', {
        retainTransforms: isStatic,
      });
      return { topic, callback };
    });
    const timer = setInterval(() => {
      const now = Date.now();
      frames.forEach((frame, name) => {
        if (!frame.isStatic && now - frame.timestamp > maxAge) frames.delete(name);
      });
      const roots = Array.from(frames.values())
        .map((f) => f.parent)
        .filter((p) => p && !frames.has(p));
      setTree({ frames: new Map(frames), rootFrame: roots[0] ?? null });
    }, 100);
    return () => {
      clearInterval(timer);
      subscriptions.forEach(({ topic, callback }) => rosbridgeClient.unsubscribe(topic, callback));
    };
  }, [rosbridgeClient, enabled, topicKey, staticKey, maxAge]);
  return { tfTree, isLoading };
}
