'use client';

import { Wifi, WifiOff } from 'lucide-react';
import ConnectionSettings from './ConnectionSettings';

interface ConnectionStatusProps {
  connected: boolean;
  url: string;
  onUrlChange?: (url: string) => void;
}

export default function ConnectionStatus({ connected, url, onUrlChange }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/50 rounded-lg border border-gray-800">
      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <Wifi className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-green-500">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-red-500">Disconnected</span>
          </>
        )}
      </div>
      <div className="h-4 w-px bg-gray-700" />
      <span className="text-sm text-gray-400 flex-1">{url}</span>
      {connected && (
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      )}
      {onUrlChange && (
        <>
          <div className="h-4 w-px bg-gray-700" />
          <ConnectionSettings currentUrl={url} onUrlChange={onUrlChange} />
        </>
      )}
    </div>
  );
}
