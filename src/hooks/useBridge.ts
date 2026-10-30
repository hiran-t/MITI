'use client';

import { useState, useEffect } from 'react';
import { BridgeClient, type StreamMode } from '@/lib/bridge/client';

export const BRIDGE_PORT = 8765;

/**
 * `NEXT_PUBLIC_BRIDGE_URL` when the build sets it; otherwise foxglove_bridge's port on the host
 * that served MITI, so opening `http://<miti-host>:3000` reaches a bridge running beside it.
 */
export function defaultBridgeUrl(location?: Pick<Location, 'protocol' | 'hostname'>): string {
  if (process.env.NEXT_PUBLIC_BRIDGE_URL) return process.env.NEXT_PUBLIC_BRIDGE_URL;
  const page = location ?? (typeof window === 'undefined' ? undefined : window.location);
  const hostname = page?.hostname || 'localhost';
  const host = hostname.includes(':') ? `[${hostname}]` : hostname;
  return `${page?.protocol === 'https:' ? 'wss' : 'ws'}://${host}:${BRIDGE_PORT}`;
}

/** Connection to foxglove_bridge; a new URL or stream mode replaces the client. */
export function useBridge(url?: string, streamMode: StreamMode = 'synchronized') {
  const bridgeUrl = url || defaultBridgeUrl();
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
