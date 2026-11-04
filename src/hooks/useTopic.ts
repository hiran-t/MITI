'use client';

import { useState, useEffect, useRef } from 'react';
import type { BridgeClient } from '@/lib/bridge/client';
import type { Transform } from '@/lib/bridge/types';
import { usePanelVisibleRef } from './usePanelVisible';

export interface TopicOptions {
  /** Minimum ms between React updates; messages in between are dropped except the newest. */
  throttleRate?: number;
  /**
   * Deliver at most this many messages per second (Hz), dropping extras before they are decoded.
   * miti_bridge sends only these; a bridge with only the base protocol sends every message.
   */
  maxRate?: number;
  /** Over miti_bridge, transform the messages on the robot (see `SubscribeOptions.transform`). */
  transform?: Transform;
}

export function useTopic<T = unknown>(
  client: Pick<BridgeClient, 'subscribe' | 'unsubscribe'> | null,
  topic: string,
  messageType?: string,
  options?: TopicOptions
): { data: T | null; lastUpdate: Date | null } {
  const [data, setData] = useState<T | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const throttleRate = options?.throttleRate ?? 0;
  const maxRate = options?.maxRate;
  // Compared by value: callers may build the object on every render.
  const transformKey = options?.transform ? JSON.stringify(options.transform) : '';
  // A hidden panel keeps only the newest message and shows it when it is visible again.
  const showHeld = useRef<(() => void) | undefined>(undefined);
  const visible = usePanelVisibleRef(() => showHeld.current?.());

  useEffect(() => {
    setData(null);
    setLastUpdate(null);
    if (!client || !topic) return;

    // Messages may come faster than panels render; throttle re-renders so heavy topics stay responsive.
    let lastEmit = 0;
    let pending: { message: unknown } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let held: { message: unknown } | null = null;
    const emit = (message: unknown) => {
      lastEmit = Date.now();
      setData(message as T);
      setLastUpdate(new Date());
    };
    const callback = (message: unknown) => {
      if (!visible.current) {
        held = { message };
        return;
      }
      const wait = throttleRate - (Date.now() - lastEmit);
      if (wait <= 0) return emit(message);
      pending = { message };
      timer ??= setTimeout(() => {
        timer = null;
        if (pending) emit(pending.message);
        pending = null;
      }, wait);
    };

    showHeld.current = () => {
      if (held) callback(held.message);
      held = null;
    };
    // The client drops frames this hook would throttle away before decoding them.
    client.subscribe(topic, callback, messageType, {
      maxRate,
      throttleMs: throttleRate || undefined,
      transform: transformKey ? (JSON.parse(transformKey) as Transform) : undefined,
    });

    return () => {
      if (timer) clearTimeout(timer);
      client.unsubscribe(topic, callback);
    };
  }, [client, topic, messageType, throttleRate, maxRate, transformKey, visible]);

  return {
    data,
    lastUpdate,
  };
}
