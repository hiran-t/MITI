'use client';

import { useState, useEffect, useRef } from 'react';
import { Radio, Globe, ChevronDown, Download, Loader2 } from 'lucide-react';
import { visualizationStyles, cn } from '@/styles';

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
    return mode === 'topic' ? <Radio className={visualizationStyles.urdf.dropdown.icon} /> : <Globe className={visualizationStyles.urdf.dropdown.icon} />;
  };

  const getModeLabel = () => {
    return mode === 'topic' ? 'ROS Topic' : 'URL';
  };

  const getModeColor = () => {
    return mode === 'topic' ? visualizationStyles.urdf.dropdown.iconTopic : visualizationStyles.urdf.dropdown.iconUrl;
  };

  return (
    <div className={visualizationStyles.urdf.dropdown.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={visualizationStyles.urdf.dropdown.trigger}
      >
        <span className={getModeColor()}>{getModeIcon()}</span>
        <span className={visualizationStyles.urdf.dropdown.label}>{getModeLabel()}</span>
        <ChevronDown className={cn(isOpen ? visualizationStyles.urdf.dropdown.chevronOpen : visualizationStyles.urdf.dropdown.chevron)} />
      </button>

      {isOpen && (
        <div className={visualizationStyles.urdf.dropdown.panel}>
          {/* Mode Selection Tabs */}
          <div className={visualizationStyles.urdf.tabs.container}>
            <button
              onClick={() => onModeChange('topic')}
              className={cn(
                visualizationStyles.urdf.tabs.button,
                mode === 'topic'
                  ? cn(visualizationStyles.urdf.tabs.buttonActive, visualizationStyles.urdf.tabs.borderTopic)
                  : visualizationStyles.urdf.tabs.buttonInactive
              )}
            >
              <Radio className={visualizationStyles.urdf.tabs.icon} />
              <span>ROS Topic</span>
            </button>
            
            <button
              onClick={() => onModeChange('url')}
              className={cn(
                visualizationStyles.urdf.tabs.button,
                mode === 'url'
                  ? cn(visualizationStyles.urdf.tabs.buttonActive, visualizationStyles.urdf.tabs.borderUrl)
                  : visualizationStyles.urdf.tabs.buttonInactive
              )}
            >
              <Globe className={visualizationStyles.urdf.tabs.icon} />
              <span>URL</span>
            </button>
          </div>

          {/* Configuration Panel */}
          <div className={visualizationStyles.urdf.form.container}>
            {mode === 'topic' && (
              <div className={visualizationStyles.urdf.form.fieldset}>
                <div>
                  <label className={visualizationStyles.urdf.form.label}>
                    Topic Name
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => onTopicChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={visualizationStyles.urdf.form.input}
                    placeholder="/robot_description"
                  />
                  <p className={visualizationStyles.urdf.form.hint}>
                    Listening for URDF on this topic...
                  </p>
                </div>
              </div>
            )}

            {mode === 'url' && (
              <div className={visualizationStyles.urdf.form.fieldset}>
                <div>
                  <label className={visualizationStyles.urdf.form.label}>
                    URDF URL
                  </label>
                  <input
                    type="text"
                    value={urdfUrl}
                    onChange={(e) => onUrdfUrlChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={visualizationStyles.urdf.form.input}
                    placeholder="http://192.168.10.27:8000/robot.urdf"
                  />
                </div>

                <div>
                  <label className={visualizationStyles.urdf.form.label}>
                    Mesh Base URL (optional)
                  </label>
                  <input
                    type="text"
                    value={meshBaseUrl}
                    onChange={(e) => onMeshBaseUrlChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={visualizationStyles.urdf.form.input}
                    placeholder="http://192.168.10.27:8000"
                  />
                  <p className={visualizationStyles.urdf.form.hint}>
                    Base URL for resolving package:// paths
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadUrl();
                  }}
                  disabled={isLoadingUrl || !urdfUrl}
                  className={visualizationStyles.urdf.form.loadButton}
                >
                  {isLoadingUrl ? (
                    <>
                      <Loader2 className={visualizationStyles.urdf.form.loadingIcon} />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <Download className={visualizationStyles.urdf.form.loadIcon} />
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
