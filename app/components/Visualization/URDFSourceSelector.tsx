'use client';

import { useState, useEffect, useRef } from 'react';
import { Radio, Globe, ChevronDown } from 'lucide-react';

interface URDFSourceSelectorProps {
  mode: 'topic' | 'url';
  onModeChange: (mode: 'topic' | 'url') => void;
}

export default function URDFSourceSelector({ mode, onModeChange }: URDFSourceSelectorProps) {
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
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-all text-sm font-medium"
      >
        <span className={getModeColor()}>{getModeIcon()}</span>
        <span className="text-gray-300">{getModeLabel()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-[60] overflow-hidden">
          <button
            onClick={() => {
              onModeChange('topic');
              setIsOpen(false);
            }}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors
              ${mode === 'topic'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-300 hover:bg-gray-800'
              }
            `}
          >
            <Radio className="w-4 h-4" />
            <span>ROS Topic</span>
          </button>
          
          <button
            onClick={() => {
              onModeChange('url');
              setIsOpen(false);
            }}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors
              ${mode === 'url'
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-gray-300 hover:bg-gray-800'
              }
            `}
          >
            <Globe className="w-4 h-4" />
            <span>URL</span>
          </button>
        </div>
      )}
    </div>
  );
}
