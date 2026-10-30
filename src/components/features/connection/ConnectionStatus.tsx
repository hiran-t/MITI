'use client';

import { Unplug, ArrowLeftRight } from 'lucide-react';
import ConnectionSettings from './ConnectionSettings';
import { connectionStyles } from '@/styles';
import type { StreamMode } from '@/lib/bridge/client';

interface ConnectionStatusProps {
  connected: boolean;
  url: string;
  onUrlChange?: (url: string) => void;
  streamMode?: StreamMode;
  onStreamModeChange?: (mode: StreamMode) => void;
}

/** Status-bar connection box: state, bridge address and the settings dialog trigger. */
export default function ConnectionStatus({
  connected,
  url,
  onUrlChange,
  streamMode,
  onStreamModeChange,
}: ConnectionStatusProps) {
  const Icon = connected ? ArrowLeftRight : Unplug;
  return (
    <div
      className={`${connectionStyles.status.container} ${connected ? '' : 'is-disconnected'}`}
      title={connected ? `Connected to ${url}` : `Disconnected from ${url}`}
    >
      <Icon className={connectionStyles.status.icon} aria-hidden="true" />
      <span className="sr-only">{connected ? 'Connected' : 'Disconnected'}</span>
      <span className={connectionStyles.status.url}>{url}</span>
      {onUrlChange && (
        <ConnectionSettings
          currentUrl={url}
          onUrlChange={onUrlChange}
          currentMode={streamMode}
          onModeChange={onStreamModeChange}
          triggerClassName="connection-settings-button"
        />
      )}
    </div>
  );
}
