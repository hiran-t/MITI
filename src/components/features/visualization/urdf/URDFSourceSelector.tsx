'use client';

import { Radio, Globe, Download, Loader2 } from 'lucide-react';
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
  return (
    <div className="border-b border-gray-800">
      {/* Mode Selection Tabs */}
      <div className={visualizationStyles.urdf.tabs.container}>
        <button
          onClick={() => onModeChange('topic')}
          className={cn(
            visualizationStyles.urdf.tabs.button,
            mode === 'topic'
              ? cn(
                  visualizationStyles.urdf.tabs.buttonActive,
                  visualizationStyles.urdf.tabs.borderTopic
                )
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
              ? cn(
                  visualizationStyles.urdf.tabs.buttonActive,
                  visualizationStyles.urdf.tabs.borderUrl
                )
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
              <label className={visualizationStyles.urdf.form.label}>Topic Name</label>
              <input
                type="text"
                aria-label="Topic Name"
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className={visualizationStyles.urdf.form.input}
                placeholder="/robot_description"
              />
              <p className={visualizationStyles.urdf.form.hint}>
                ROS topic publishing the robot description.
              </p>
            </div>
          </div>
        )}

        {mode === 'url' && (
          <div className={visualizationStyles.urdf.form.fieldset}>
            <div>
              <label className={visualizationStyles.urdf.form.label}>URDF URL</label>
              <input
                type="text"
                aria-label="URDF URL"
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
                aria-label="Mesh Base URL"
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
                  <span>Reload URDF</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
