'use client';

import { useState, useEffect } from 'react';
import { BridgeClient } from '@/lib/bridge/client';

export interface TopicOptions {
  /** Minimum ms between React updates; messages in between are dropped except the newest. */
  throttleRate?: number;
  /**
   * Deliver at most this many messages per second (Hz), dropping extras before they are decoded.
   * The robot still sends every message; foxglove_bridge cannot throttle per client.
   */
  maxRate?: number;
}

export function useTopic<T = unknown>(
  client: BridgeClient | null,
  topic: string,
  messageType?: string,
  options?: TopicOptions
): { data: T | null; lastUpdate: Date | null } {
  const [data, setData] = useState<T | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const throttleRate = options?.throttleRate ?? 0;
  const maxRate = options?.maxRate;

  useEffect(() => {
    setData(null);
    setLastUpdate(null);
    if (!client || !topic) return;

    // foxglove_bridge sends every message; throttle re-renders so heavy topics stay responsive.
    let lastEmit = 0;
    let pending: { message: unknown } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const emit = (message: unknown) => {
      lastEmit = Date.now();
      setData(message as T);
      setLastUpdate(new Date());
    };
    const callback = (message: unknown) => {
      const wait = throttleRate - (Date.now() - lastEmit);
      if (wait <= 0) return emit(message);
      pending = { message };
      timer ??= setTimeout(() => {
        timer = null;
        if (pending) emit(pending.message);
        pending = null;
      }, wait);
    };

    client.subscribe(topic, callback, messageType, { maxRate });

    return () => {
      if (timer) clearTimeout(timer);
      client.unsubscribe(topic, callback);
    };
  }, [client, topic, messageType, throttleRate, maxRate]);

  return {
    data,
    lastUpdate,
  };
}
