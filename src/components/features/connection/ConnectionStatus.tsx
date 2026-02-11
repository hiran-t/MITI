'use client';

import { Wifi, WifiOff } from 'lucide-react';
import ConnectionSettings from './ConnectionSettings';
import { connectionStyles } from '@/styles';

interface ConnectionStatusProps {
  connected: boolean;
  url: string;
  onUrlChange?: (url: string) => void;
}

export default function ConnectionStatus({ connected, url, onUrlChange }: ConnectionStatusProps) {
  return (
    <div className={connectionStyles.status.container}>
      <div className={connectionStyles.status.statusWrapper}>
        {connected ? (
          <>
            <Wifi className={connectionStyles.status.iconConnected} />
            <span className={connectionStyles.status.statusTextConnected}>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className={connectionStyles.status.iconDisconnected} />
            <span className={connectionStyles.status.statusTextDisconnected}>Disconnected</span>
          </>
        )}
      </div>
      <div className={connectionStyles.status.divider} />
      <span className={connectionStyles.status.url}>{url}</span>
      {connected && (
        <div className={connectionStyles.status.indicator} />
      )}
      {onUrlChange && (
        <>
          <div className={connectionStyles.status.divider} />
          <ConnectionSettings currentUrl={url} onUrlChange={onUrlChange} />
        </>
      )}
    </div>
  );
}
