'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, X } from 'lucide-react';
import { connectionStyles } from '@/styles';
import { defaultBridgeUrl } from '@/hooks/useBridge';
import BridgeNetworkSettings from './BridgeNetworkSettings';
import type { StreamMode } from '@/lib/bridge/client';

interface ConnectionSettingsProps {
  currentUrl: string;
  onUrlChange: (url: string) => void;
  currentMode?: StreamMode;
  onModeChange?: (mode: StreamMode) => void;
  /** Overrides the trigger button's look, e.g. inside the status bar. */
  triggerClassName?: string;
}

const STREAM_MODES: { value: StreamMode; label: string; hint: string }[] = [
  {
    value: 'synchronized',
    label: 'Synchronized (like Foxglove)',
    hint: 'One connection: cameras, TF and the 3D scene show the same moment.',
  },
  {
    value: 'separate',
    label: 'Prioritize robot motion',
    hint: 'Images and point clouds on their own connections: the robot stays real-time on a slow link, but cameras lag behind it.',
  },
];

export default function ConnectionSettings({
  currentUrl,
  onUrlChange,
  currentMode = 'synchronized',
  onModeChange,
  triggerClassName,
}: ConnectionSettingsProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl);
  const [mode, setMode] = useState(currentMode);

  useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl]);
  useEffect(() => {
    setMode(currentMode);
  }, [currentMode]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector('input')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
      if (event.key === 'Tab') {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button, input, select');
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [isOpen]);

  const handleSave = () => {
    onUrlChange(url);
    onModeChange?.(mode);
    setIsOpen(false);
  };

  const handleReset = () => {
    setUrl(defaultBridgeUrl());
    setMode('synchronized');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={triggerClassName ?? connectionStyles.settingsButton.base}
        title="Connection settings"
        aria-label="Connection settings"
      >
        <Settings className={triggerClassName ? 'h-4 w-4' : connectionStyles.settingsButton.icon} />
      </button>
    );
  }

  return (
    <div className={connectionStyles.modal.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connection settings"
        className={connectionStyles.modal.container}
      >
        {/* Header */}
        <div className={connectionStyles.modal.header}>
          <h3 className={connectionStyles.modal.title}>Connection settings</h3>
          <button
            aria-label="Close connection settings"
            onClick={() => setIsOpen(false)}
            className={connectionStyles.modal.closeButton}
          >
            <X className={connectionStyles.modal.closeIcon} />
          </button>
        </div>

        {/* Content */}
        <div className={connectionStyles.modal.content}>
          <div>
            <label htmlFor="bridge-url" className={connectionStyles.form.label}>
              foxglove_bridge URL
            </label>
            <input
              id="bridge-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://<robot-ip>:8765"
              className={connectionStyles.form.input}
            />
            <p className={connectionStyles.form.hint}>
              WebSocket address of foxglove_bridge on the robot (default port 8765)
            </p>
          </div>

          {onModeChange && (
            <div>
              <label htmlFor="stream-mode" className={connectionStyles.form.label}>
                Streaming
              </label>
              <select
                id="stream-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as StreamMode)}
                className={connectionStyles.form.input}
              >
                {STREAM_MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={connectionStyles.form.hint}>
                {STREAM_MODES.find((option) => option.value === mode)?.hint}
              </p>
            </div>
          )}

          {/* Examples */}
          <div className={connectionStyles.examples.container}>
            <p className={connectionStyles.examples.title}>Examples:</p>
            <div className={connectionStyles.examples.list}>
              <button
                onClick={() => setUrl('ws://localhost:8765')}
                className={connectionStyles.examples.link}
              >
                ws://localhost:8765
              </button>
            </div>
          </div>

          <BridgeNetworkSettings />
        </div>

        {/* Footer */}
        <div className={connectionStyles.modal.footer}>
          <button onClick={handleReset} className={connectionStyles.buttons.reset}>
            Reset to default
          </button>
          <div className={connectionStyles.buttons.group}>
            <button onClick={() => setIsOpen(false)} className={connectionStyles.buttons.cancel}>
              Cancel
            </button>
            <button onClick={handleSave} className={connectionStyles.buttons.save}>
              Save and reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
