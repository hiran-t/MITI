'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, ChevronDown, Trash2, Clock, Plus, X } from 'lucide-react';
import { visualizationStyles, cn } from '@/styles';

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
  onPointCloudTopicsChange,
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
      onPointCloudTopicsChange(pointCloudTopics.filter((t) => t !== topicToRemove));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPointCloudTopic();
    }
  };

  return (
    <div className={visualizationStyles.urdfSettings.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={visualizationStyles.urdfSettings.triggerButton}
        title="URDF Settings"
      >
        <Settings className={visualizationStyles.urdfSettings.triggerIcon} />
        <ChevronDown
          className={cn(
            isOpen
              ? visualizationStyles.urdfSettings.triggerChevronOpen
              : visualizationStyles.urdfSettings.triggerChevron
          )}
        />
      </button>

      {isOpen && (
        <div className={visualizationStyles.urdfSettings.dropdown}>
          {/* Point Cloud Topics Section */}
          <div className={visualizationStyles.urdfSettings.section}>
            <h3 className={visualizationStyles.urdfSettings.sectionTitle}>Point Cloud Topics</h3>

            {/* Add new topic input */}
            <div className={visualizationStyles.urdfSettings.topicInputContainer}>
              <input
                type="text"
                value={newTopicInput}
                onChange={(e) => setNewTopicInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., /camera/depth/points"
                className={visualizationStyles.urdfSettings.topicInput}
              />
              <button
                onClick={handleAddPointCloudTopic}
                className={visualizationStyles.urdfSettings.addButton}
                title="Add topic"
              >
                <Plus className={visualizationStyles.urdfSettings.addIcon} />
              </button>
            </div>

            {/* Active topics list */}
            {pointCloudTopics.length > 0 ? (
              <div className={visualizationStyles.urdfSettings.topicList}>
                {pointCloudTopics.map((topic, index) => (
                  <div key={index} className={visualizationStyles.urdfSettings.topicItem}>
                    <span className={visualizationStyles.urdfSettings.topicName}>{topic}</span>
                    <button
                      onClick={() => handleRemovePointCloudTopic(topic)}
                      className={visualizationStyles.urdfSettings.removeButton}
                      title="Remove topic"
                    >
                      <X className={visualizationStyles.urdfSettings.removeIcon} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={visualizationStyles.urdfSettings.emptyState}>
                No point cloud topics added
              </p>
            )}
          </div>

          {/* Presets Section */}
          <div className={visualizationStyles.urdfSettings.section}>
            <h3 className={visualizationStyles.urdfSettings.sectionTitle}>Presets</h3>
            <div className={visualizationStyles.urdfSettings.presetsList}>
              {presets.map((preset, index) => (
                <div key={index} className={visualizationStyles.urdfSettings.presetItem}>
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className={visualizationStyles.urdfSettings.presetButton}
                  >
                    <div className={visualizationStyles.urdfSettings.presetContent}>
                      <div className={visualizationStyles.urdfSettings.presetInfo}>
                        <p className={visualizationStyles.urdfSettings.presetName}>{preset.name}</p>
                        <p className={visualizationStyles.urdfSettings.presetUrl}>
                          {preset.urdfUrl}
                        </p>
                      </div>
                      {index >= DEFAULT_PRESETS.length && (
                        <button
                          onClick={(e) => handleDeletePreset(index, e)}
                          className={visualizationStyles.urdfSettings.deleteButton}
                          title="Delete preset"
                        >
                          <Trash2 className={visualizationStyles.urdfSettings.deleteIcon} />
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
            <div className={visualizationStyles.urdfSettings.section}>
              <div className={visualizationStyles.urdfSettings.sectionHeader}>
                <h3 className={visualizationStyles.urdfSettings.sectionTitleWithIcon}>
                  <Clock className={visualizationStyles.urdfSettings.clockIcon} />
                  Recent URLs
                </h3>
                <button
                  onClick={handleClearRecent}
                  className={visualizationStyles.urdfSettings.clearButton}
                >
                  Clear
                </button>
              </div>
              <div className={visualizationStyles.urdfSettings.recentList}>
                {recentUrls.slice(0, 3).map((url, index) => (
                  <div key={index} className={visualizationStyles.urdfSettings.recentItem}>
                    <p className={visualizationStyles.urdfSettings.recentUrl}>{url}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className={visualizationStyles.urdfSettings.section}>
            <p className={visualizationStyles.urdfSettings.infoText}>
              <strong className={visualizationStyles.urdfSettings.infoTip}>Tip:</strong> Enable CORS
              on your web server
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
