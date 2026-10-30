'use client';
import { useEffect, useRef, useState } from 'react';
import type { TFMessage, TFTree, TFFrame } from '@/types/tf-messages';
import type { BridgeClient } from '@/lib/bridge/client';
import { frameName, stampSeconds, transformMatrix } from '@/lib/scene/transforms';
import { usePanelVisibleRef } from './usePanelVisible';
const DEFAULT_TOPICS = ['/tf', '/tf_static'];
/** TF history kept per frame, in message time and samples. */
const HISTORY_SECONDS = 30;
const HISTORY_SAMPLES = 3000;
const TRIM_BATCH = 64;
interface UseTFOptions {
  client: BridgeClient | null;
  maxAge?: number;
  enabled?: boolean;
  tfTopics?: string[];
  staticTopics?: string[];
}
export function useTF({
  client,
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
  // A hidden panel keeps the tree current but publishes it only once it is visible again.
  const publishHeld = useRef<() => void>();
  const visible = usePanelVisibleRef(() => publishHeld.current?.());
  useEffect(() => {
    const frames = new Map<string, TFFrame>();
    // Publish at most once per animation frame, and only when frames changed: robots and the
    // camera move as smoothly as TF arrives, without re-rendering scenes for nothing.
    let scheduled: ReturnType<typeof requestAnimationFrame> | null = null;
    const publish = () => {
      scheduled = null;
      const roots = Array.from(frames.values())
        .map((f) => f.parent)
        .filter((p) => p && !frames.has(p));
      setTree({ frames: new Map(frames), rootFrame: roots[0] ?? null });
    };
    let held = false;
    const schedule = () => {
      if (!visible.current) held = true;
      else scheduled ??= requestAnimationFrame(publish);
    };
    publishHeld.current = () => {
      if (held) schedule();
      held = false;
    };
    setTree({ frames: new Map(), rootFrame: null });
    setLoading(true);
    if (!enabled || !client) return;
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
            // Appended in place: copying thousands of samples for every transform of every
            // message would dominate CPU. Published trees share the array and only read it.
            let history =
              previous?.parent === parent && !previous.isStatic ? (previous.history ?? []) : [];
            if (!isStatic) {
              const last = history[history.length - 1];
              if (last && time <= last.time) {
                // Rare: an out-of-order or repeated stamp.
                history = history.filter((s) => s.time !== time);
                history.push({ time, transform: item.transform });
                history.sort((a, b) => a.time - b.time);
              } else history.push({ time, transform: item.transform });
              // Long enough to place sensor data that arrives seconds late on a slow link;
              // trimmed in batches to keep each message cheap.
              const newest = history[history.length - 1].time;
              const keepFrom = history.findIndex((s) => s.time >= newest - HISTORY_SECONDS);
              const drop = Math.max(keepFrom, history.length - HISTORY_SAMPLES);
              if (drop >= TRIM_BATCH) history.splice(0, drop);
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
            schedule();
          } catch {
            /* Ignore invalid TF packets; consumers report missing transforms. */
          }
        }
        setLoading(false);
      };
      client.subscribe(topic, callback, 'tf2_msgs/msg/TFMessage', {
        retainTransforms: isStatic,
      });
      return { topic, callback };
    });
    const timer = setInterval(() => {
      const now = Date.now();
      frames.forEach((frame, name) => {
        if (!frame.isStatic && now - frame.timestamp > maxAge && frames.delete(name)) schedule();
      });
    }, 250);
    return () => {
      clearInterval(timer);
      if (scheduled !== null) cancelAnimationFrame(scheduled);
      subscriptions.forEach(({ topic, callback }) => client.unsubscribe(topic, callback));
    };
  }, [client, enabled, topicKey, staticKey, maxAge, visible]);
  return { tfTree, isLoading };
}
