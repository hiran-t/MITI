'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, ChevronDown, Trash2, Clock, Plus, X } from 'lucide-react';

interface URDFPreset {
  name: string;
  urdfUrl: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
}

interface URDFSettingsProps {
  onLoadPreset: (preset: Omit<URDFPreset, 'name'>) => void;
  pointCloudTopics?: string[];
  onPointCloudTopicsChange?: (topics: string[]) => void;
}

const DEFAULT_PRESETS: URDFPreset[] = [
  {
    name: 'Local Robot Server',
    urdfUrl: 'http://192.168.31.200:8000/robot.urdf',
    meshBaseUrl: 'http://192.168.31.200:8000',
    packageMapping: {},
  },
];

const STORAGE_KEY_PRESETS = 'miti_urdf_presets';
const STORAGE_KEY_RECENT = 'miti_urdf_recent';

export default function URDFSettings({ 
  onLoadPreset, 
  pointCloudTopics = [],
  onPointCloudTopicsChange 
}: URDFSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<URDFPreset[]>(DEFAULT_PRESETS);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [newTopicInput, setNewTopicInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleLoadPreset = (preset: URDFPreset) => {
    onLoadPreset({
      urdfUrl: preset.urdfUrl,
      meshBaseUrl: preset.meshBaseUrl,
      packageMapping: preset.packageMapping,
    });
    setIsOpen(false);
  };

  const handleDeletePreset = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
    }
  };

  const handleClearRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentUrls([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_RECENT);
    }
  };

  const handleAddPointCloudTopic = () => {
    if (newTopicInput.trim() && onPointCloudTopicsChange) {
      const trimmed = newTopicInput.trim();
      if (!pointCloudTopics.includes(trimmed)) {
        onPointCloudTopicsChange([...pointCloudTopics, trimmed]);
      }
      setNewTopicInput('');
    }
  };

  const handleRemovePointCloudTopic = (topicToRemove: string) => {
    if (onPointCloudTopicsChange) {
      onPointCloudTopicsChange(pointCloudTopics.filter(t => t !== topicToRemove));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPointCloudTopic();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-800/50 rounded-lg transition-colors border border-gray-800 hover:border-gray-700"
        title="URDF Settings"
      >
        <Settings className="w-4 h-4 text-gray-400" />
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[32rem] overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50">
          {/* Point Cloud Topics Section */}
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">Point Cloud Topics</h3>
            
            {/* Add new topic input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTopicInput}
                onChange={(e) => setNewTopicInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., /camera/depth/points"
                className="flex-1 px-2 py-1.5 bg-gray-800 text-gray-200 text-xs rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleAddPointCloudTopic}
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title="Add topic"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Active topics list */}
            {pointCloudTopics.length > 0 ? (
              <div className="space-y-1.5">
                {pointCloudTopics.map((topic, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-800/50 rounded border border-gray-700"
                  >
                    <span className="text-xs text-gray-300 truncate flex-1">{topic}</span>
                    <button
                      onClick={() => handleRemovePointCloudTopic(topic)}
                      className="ml-2 p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                      title="Remove topic"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No point cloud topics added</p>
            )}
          </div>

          {/* Presets Section */}
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">Presets</h3>
            <div className="space-y-1.5">
              {presets.map((preset, index) => (
                <div
                  key={index}
                  className="group relative"
                >
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className="w-full text-left p-2 bg-gray-800/50 hover:bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-medium text-gray-200 truncate">{preset.name}</p>
                        <p className="text-xs text-gray-500 truncate">{preset.urdfUrl}</p>
                      </div>
                      {index >= DEFAULT_PRESETS.length && (
                        <button
                          onClick={(e) => handleDeletePreset(index, e)}
                          className="flex-shrink-0 p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent URLs Section */}
          {recentUrls.length > 0 && (
            <div className="p-3 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Recent URLs
                </h3>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1.5">
                {recentUrls.slice(0, 3).map((url, index) => (
                  <div
                    key={index}
                    className="p-2 bg-gray-800/50 rounded border border-gray-700"
                  >
                    <p className="text-xs text-gray-400 truncate">{url}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-3">
            <p className="text-xs text-gray-500">
              <strong className="text-blue-400">Tip:</strong> Enable CORS on your web server
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
