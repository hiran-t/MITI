'use client';

import { useState } from 'react';
import { Radio, Globe } from 'lucide-react';

interface URDFSourceSelectorProps {
  mode: 'topic' | 'url';
  onModeChange: (mode: 'topic' | 'url') => void;
}

export default function URDFSourceSelector({ mode, onModeChange }: URDFSourceSelectorProps) {
  return (
    <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg border border-gray-700">
      <button
        onClick={() => onModeChange('topic')}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
          ${mode === 'topic'
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
          }
        `}
      >
        <Radio className="w-4 h-4" />
        <span>ROS Topic</span>
      </button>
      
      <button
        onClick={() => onModeChange('url')}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
          ${mode === 'url'
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
          }
        `}
      >
        <Globe className="w-4 h-4" />
        <span>URL</span>
      </button>
    </div>
  );
}
