'use client';

import { useState, useEffect } from 'react';
import { Settings, X, Save, Trash2, Clock } from 'lucide-react';

interface URDFPreset {
  name: string;
  urdfUrl: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
}

interface URDFSettingsProps {
  onLoadPreset: (preset: Omit<URDFPreset, 'name'>) => void;
}

const DEFAULT_PRESETS: URDFPreset[] = [
  {
    name: 'Local Robot Server',
    urdfUrl: 'http://192.168.10.27:8000/robot.urdf',
    meshBaseUrl: 'http://192.168.10.27:8000',
    packageMapping: {},
  },
];

const STORAGE_KEY_PRESETS = 'vizzy_urdf_presets';
const STORAGE_KEY_RECENT = 'vizzy_urdf_recent';

export default function URDFSettings({ onLoadPreset }: URDFSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<URDFPreset[]>(DEFAULT_PRESETS);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);

  // Load saved data from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPresets = localStorage.getItem(STORAGE_KEY_PRESETS);
      const savedRecent = localStorage.getItem(STORAGE_KEY_RECENT);
      
      if (savedPresets) {
        try {
          setPresets(JSON.parse(savedPresets));
        } catch (e) {
          console.error('Failed to load presets:', e);
        }
      }
      
      if (savedRecent) {
        try {
          setRecentUrls(JSON.parse(savedRecent));
        } catch (e) {
          console.error('Failed to load recent URLs:', e);
        }
      }
    }
  }, []);

  const handleLoadPreset = (preset: URDFPreset) => {
    onLoadPreset({
      urdfUrl: preset.urdfUrl,
      meshBaseUrl: preset.meshBaseUrl,
      packageMapping: preset.packageMapping,
    });
    setIsOpen(false);
  };

  const handleDeletePreset = (index: number) => {
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
    }
  };

  const handleClearRecent = () => {
    setRecentUrls([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_RECENT);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors border border-gray-800 hover:border-gray-700"
        title="URDF Settings"
      >
        <Settings className="w-4 h-4 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-200">URDF Settings</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Presets */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Save className="w-4 h-4" />
              Presets
            </h3>
            <div className="space-y-2">
              {presets.map((preset, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200">{preset.name}</p>
                    <p className="text-xs text-gray-500 truncate">{preset.urdfUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => handleLoadPreset(preset)}
                      className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                    >
                      Load
                    </button>
                    {index >= DEFAULT_PRESETS.length && (
                      <button
                        onClick={() => handleDeletePreset(index)}
                        className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent URLs */}
          {recentUrls.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent URLs
                </h3>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2">
                {recentUrls.slice(0, 5).map((url, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                  >
                    <p className="text-xs text-gray-400 truncate">{url}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-gray-400">
              <strong className="text-blue-400">Tip:</strong> When loading URDF from URL, ensure your web server has CORS enabled.
              See documentation for setup instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
