'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';

interface ViewerControlsProps {
  onFullscreen?: () => void;
  title: string;
}

export default function ViewerControls({ onFullscreen, title }: ViewerControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    onFullscreen?.();
  };

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-2">
      <button
        onClick={handleFullscreen}
        className="p-2 bg-gray-900/80 hover:bg-gray-800/80 rounded border border-gray-700 transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 text-gray-300" />
        ) : (
          <Maximize2 className="w-4 h-4 text-gray-300" />
        )}
      </button>
    </div>
  );
}
