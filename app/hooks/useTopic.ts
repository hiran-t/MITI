'use client';

import { useState, useEffect } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';

export function useTopic<T = any>(
  client: ROSBridge | null,
  topic: string,
  messageType?: string
) {
  const [data, setData] = useState<T | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!client || !topic) return;

    const callback = (message: T) => {
      setData(message);
      setLastUpdate(new Date());
    };

    client.subscribe(topic, callback, messageType);

    return () => {
      client.unsubscribe(topic, callback);
    };
  }, [client, topic, messageType]);

  return {
    data,
    lastUpdate,
  };
}
