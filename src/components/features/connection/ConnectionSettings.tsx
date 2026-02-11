'use client';

import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { connectionStyles } from '@/styles';

interface ConnectionSettingsProps {
  currentUrl: string;
  onUrlChange: (url: string) => void;
}

export default function ConnectionSettings({ currentUrl, onUrlChange }: ConnectionSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl);

  useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl]);

  const handleSave = () => {
    onUrlChange(url);
    setIsOpen(false);
  };

  const handleReset = () => {
    const defaultUrl = process.env.NEXT_PUBLIC_ROSBRIDGE_URL || 'ws://localhost:9090';
    setUrl(defaultUrl);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={connectionStyles.settingsButton.base}
        title="Connection Settings"
      >
        <Settings className={connectionStyles.settingsButton.icon} />
      </button>
    );
  }

  return (
    <div className={connectionStyles.modal.backdrop}>
      <div className={connectionStyles.modal.container}>
        {/* Header */}
        <div className={connectionStyles.modal.header}>
          <h3 className={connectionStyles.modal.title}>Connection Settings</h3>
          <button onClick={() => setIsOpen(false)} className={connectionStyles.modal.closeButton}>
            <X className={connectionStyles.modal.closeIcon} />
          </button>
        </div>

        {/* Content */}
        <div className={connectionStyles.modal.content}>
          <div>
            <label htmlFor="rosbridge-url" className={connectionStyles.form.label}>
              Rosbridge Server URL
            </label>
            <input
              id="rosbridge-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://192.168.10.27:9090"
              className={connectionStyles.form.input}
            />
            <p className={connectionStyles.form.hint}>
              Enter the WebSocket URL of your rosbridge server
            </p>
          </div>

          {/* Examples */}
          <div className={connectionStyles.examples.container}>
            <p className={connectionStyles.examples.title}>Examples:</p>
            <div className={connectionStyles.examples.list}>
              <button
                onClick={() => setUrl('ws://localhost:9090')}
                className={connectionStyles.examples.link}
              >
                ws://localhost:9090
              </button>
              <button
                onClick={() => setUrl('ws://192.168.10.27:9090')}
                className={connectionStyles.examples.link}
              >
                ws://192.168.10.27:9090
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={connectionStyles.modal.footer}>
          <button onClick={handleReset} className={connectionStyles.buttons.reset}>
            Reset to Default
          </button>
          <div className={connectionStyles.buttons.group}>
            <button onClick={() => setIsOpen(false)} className={connectionStyles.buttons.cancel}>
              Cancel
            </button>
            <button onClick={handleSave} className={connectionStyles.buttons.save}>
              Save & Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
