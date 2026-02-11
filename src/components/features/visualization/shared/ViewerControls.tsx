'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { visualizationStyles } from '@/styles';

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
    <div className={visualizationStyles.controls.container}>
      <button
        onClick={handleFullscreen}
        className={visualizationStyles.controls.button}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 className={visualizationStyles.controls.icon} />
        ) : (
          <Maximize2 className={visualizationStyles.controls.icon} />
        )}
      </button>
    </div>
  );
}
