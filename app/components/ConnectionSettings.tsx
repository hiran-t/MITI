'use client';

import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';

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
        className="p-2 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
        title="Connection Settings"
      >
        <Settings className="w-4 h-4 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Connection Settings</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label htmlFor="rosbridge-url" className="block text-sm font-medium text-gray-300 mb-2">
              Rosbridge Server URL
            </label>
            <input
              id="rosbridge-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://192.168.10.27:9090"
              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the WebSocket URL of your rosbridge server
            </p>
          </div>

          {/* Examples */}
          <div className="bg-gray-950 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-400 mb-2">Examples:</p>
            <div className="space-y-1">
              <button
                onClick={() => setUrl('ws://localhost:9090')}
                className="block text-xs text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-cyan-400 hover:from-lime-300 hover:to-cyan-300 transition-all"
              >
                ws://localhost:9090
              </button>
              <button
                onClick={() => setUrl('ws://192.168.10.27:9090')}
                className="block text-xs text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-cyan-400 hover:from-lime-300 hover:to-cyan-300 transition-all"
              >
                ws://192.168.10.27:9090
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-gradient-to-r from-lime-400 to-cyan-400 hover:from-lime-500 hover:to-cyan-500 text-gray-900 font-medium rounded-lg transition-all"
            >
              Save & Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
