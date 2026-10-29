'use client';

import { useState, useEffect } from 'react';
import { BridgeClient, type StreamMode } from '@/lib/bridge/client';

export const DEFAULT_BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'ws://localhost:8765';

/** Connection to foxglove_bridge; a new URL or stream mode replaces the client. */
export function useBridge(url?: string, streamMode: StreamMode = 'synchronized') {
  const bridgeUrl = url || DEFAULT_BRIDGE_URL;
  const [client, setClient] = useState<BridgeClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const next = new BridgeClient(bridgeUrl, { streamMode });
    setClient(next);
    setConnected(false);
    setError(null);

    const unsubConnection = next.onConnection(() => {
      setConnected(true);
      setError(null);
    });
    const unsubDisconnection = next.onDisconnection(() => setConnected(false));
    const unsubError = next.onError((err) => setError(err));

    next.connect().catch((err) => setError(err));

    return () => {
      unsubConnection();
      unsubDisconnection();
      unsubError();
      next.disconnect();
    };
  }, [bridgeUrl, streamMode]);

  return { client, connected, error };
}
