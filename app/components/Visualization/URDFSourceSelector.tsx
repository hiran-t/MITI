'use client';

import { useState, useEffect, useRef } from 'react';
import { Radio, Globe, ChevronDown, Download, Loader2 } from 'lucide-react';

interface URDFSourceSelectorProps {
  mode: 'topic' | 'url';
  onModeChange: (mode: 'topic' | 'url') => void;
  // Topic mode props
  topic: string;
  onTopicChange: (topic: string) => void;
  // URL mode props
  urdfUrl: string;
  onUrdfUrlChange: (url: string) => void;
  meshBaseUrl: string;
  onMeshBaseUrlChange: (url: string) => void;
  onLoadUrl: () => void;
  isLoadingUrl: boolean;
}

export default function URDFSourceSelector({ 
  mode, 
  onModeChange,
  topic,
  onTopicChange,
  urdfUrl,
  onUrdfUrlChange,
  meshBaseUrl,
  onMeshBaseUrlChange,
  onLoadUrl,
  isLoadingUrl,
}: URDFSourceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const getModeIcon = () => {
    return mode === 'topic' ? <Radio className="w-4 h-4" /> : <Globe className="w-4 h-4" />;
  };

  const getModeLabel = () => {
    return mode === 'topic' ? 'ROS Topic' : 'URL';
  };

  const getModeColor = () => {
    return mode === 'topic' ? 'text-blue-400' : 'text-purple-400';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-all text-sm font-medium"
      >
        <span className={getModeColor()}>{getModeIcon()}</span>
        <span className="text-gray-300">{getModeLabel()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-[60] overflow-hidden">
          {/* Mode Selection Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => onModeChange('topic')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors
                ${mode === 'topic'
                  ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                }
              `}
            >
              <Radio className="w-4 h-4" />
              <span>ROS Topic</span>
            </button>
            
            <button
              onClick={() => onModeChange('url')}
              className={`
                flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors
                ${mode === 'url'
                  ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                }
              `}
            >
              <Globe className="w-4 h-4" />
              <span>URL</span>
            </button>
          </div>

          {/* Configuration Panel */}
          <div className="p-3">
            {mode === 'topic' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Topic Name
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => onTopicChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    placeholder="/robot_description"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Listening for URDF on this topic...
                  </p>
                </div>
              </div>
            )}

            {mode === 'url' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    URDF URL
                  </label>
                  <input
                    type="text"
                    value={urdfUrl}
                    onChange={(e) => onUrdfUrlChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                    placeholder="http://192.168.10.27:8000/robot.urdf"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Mesh Base URL (optional)
                  </label>
                  <input
                    type="text"
                    value={meshBaseUrl}
                    onChange={(e) => onMeshBaseUrlChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                    placeholder="http://192.168.10.27:8000"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Base URL for resolving package:// paths
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadUrl();
                  }}
                  disabled={isLoadingUrl || !urdfUrl}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isLoadingUrl ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Load URDF</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
