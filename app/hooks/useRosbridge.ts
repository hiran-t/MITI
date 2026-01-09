'use client';

import { useState, useEffect, useRef } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';

export function useRosbridge(url?: string) {
  const rosbridgeUrl = url || process.env.NEXT_PUBLIC_ROSBRIDGE_URL || 'ws://localhost:9090';
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<ROSBridge | null>(null);

  useEffect(() => {
    const client = new ROSBridge(rosbridgeUrl);
    clientRef.current = client;

    const unsubConnection = client.onConnection(() => {
      setConnected(true);
      setError(null);
    });

    const unsubDisconnection = client.onDisconnection(() => {
      setConnected(false);
    });

    const unsubError = client.onError((err) => {
      setError(err);
    });

    client.connect().catch((err) => {
      setError(err);
    });

    return () => {
      unsubConnection();
      unsubDisconnection();
      unsubError();
      client.disconnect();
    };
  }, [rosbridgeUrl]);

  return {
    client: clientRef.current,
    connected,
    error,
  };
}
