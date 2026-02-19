'use client';

import { useState, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  jointStatesTopic: string;
  onJointStatesTopicChange: (topic: string) => void;
  tfTopics: string[];
  onTfTopicsChange: (topics: string[]) => void;
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
  jointStatesTopic,
  onJointStatesTopicChange,
  tfTopics,
  onTfTopicsChange,
}: URDFSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<URDFPreset[]>(DEFAULT_PRESETS);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [newPointTopicInput, setNewPointTopicInput] = useState('');
  const [newTfTopicInput, setNewTfTopicInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved data from localStorage
  useEffect(() => {
    const savedPresets = localStorage.getItem(STORAGE_KEY_PRESETS);
    const savedRecent = localStorage.getItem(STORAGE_KEY_RECENT);

    if (savedPresets) {
      try {
        const parsed = JSON.parse(savedPresets) as URDFPreset[];
        // fallback กันกรณี stored เป็น empty / malformed
        setPresets(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PRESETS);
      } catch (e) {
        console.error('Failed to load presets:', e);
        setPresets(DEFAULT_PRESETS);
      }
    }

    if (savedRecent) {
      try {
        const parsed = JSON.parse(savedRecent) as string[];
        setRecentUrls(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to load recent URLs:', e);
        setRecentUrls([]);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (!isOpen) return;

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLoadPreset = (preset: URDFPreset) => {
    onLoadPreset({
      urdfUrl: preset.urdfUrl,
      meshBaseUrl: preset.meshBaseUrl,
      packageMapping: preset.packageMapping,
    });
    setIsOpen(false);
  };

  const handleDeletePreset = (index: number, e: ReactMouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
  };

  const handleClearRecent = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setRecentUrls([]);
    localStorage.removeItem(STORAGE_KEY_RECENT);
  };

  // PointCloud topics
  const handleAddPointCloudTopic = () => {
    if (!onPointCloudTopicsChange) return;

    const trimmed = newPointTopicInput.trim();
    if (!trimmed) return;

    if (!pointCloudTopics.includes(trimmed)) {
      onPointCloudTopicsChange([...pointCloudTopics, trimmed]);
    }
    setNewPointTopicInput('');
  };

  const handleRemovePointCloudTopic = (topicToRemove: string) => {
    if (!onPointCloudTopicsChange) return;
    onPointCloudTopicsChange(pointCloudTopics.filter((t) => t !== topicToRemove));
  };

  const handlePointCloudKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddPointCloudTopic();
  };

  // TF topics
  const handleAddTfTopic = () => {
    const trimmed = newTfTopicInput.trim();
    if (!trimmed) return;

    if (!tfTopics.includes(trimmed)) {
      onTfTopicsChange([...tfTopics, trimmed]);
    }
    setNewTfTopicInput('');
  };

  const handleTfKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddTfTopic();
  };

  return (
    <div className={visualizationStyles.urdfSettings.container} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={visualizationStyles.urdfSettings.triggerButton}
        title="URDF Settings"
        type="button"
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
          {/* Joint States Topic Section */}
          <div className={visualizationStyles.urdfSettings.section}>
            <h3 className={visualizationStyles.urdfSettings.sectionTitle}>Joint States Topic</h3>
            <input
              type="text"
              value={jointStatesTopic}
              onChange={(e) => onJointStatesTopicChange(e.target.value)}
              placeholder="e.g., /robot_inbound/joint_states"
              className={visualizationStyles.urdfSettings.topicInput}
              style={{ width: 255 }}
            />
          </div>

          {/* TF Topics Section */}
          <div className={visualizationStyles.urdfSettings.section}>
            <h3 className={visualizationStyles.urdfSettings.sectionTitle}>TF Topics</h3>
            <div className={visualizationStyles.urdfSettings.topicInputContainer}>
              <input
                type="text"
                value={newTfTopicInput}
                onChange={(e) => setNewTfTopicInput(e.target.value)}
                onKeyDown={handleTfKeyDown}
                placeholder="e.g., /robot_inbound/tf"
                className={visualizationStyles.urdfSettings.topicInput}
              />
              <button
                onClick={handleAddTfTopic}
                className={visualizationStyles.urdfSettings.addButton}
                title="Add TF topic"
                type="button"
              >
                <Plus className={visualizationStyles.urdfSettings.addIcon} />
              </button>
            </div>

            {tfTopics.length > 0 ? (
              <div className={visualizationStyles.urdfSettings.topicList}>
                {tfTopics.map((topic) => (
                  <div key={topic} className={visualizationStyles.urdfSettings.topicItem}>
                    <span className={visualizationStyles.urdfSettings.topicName}>{topic}</span>
                    <button
                      onClick={() => onTfTopicsChange(tfTopics.filter((t) => t !== topic))}
                      className={visualizationStyles.urdfSettings.removeButton}
                      title="Remove TF topic"
                      type="button"
                    >
                      <X className={visualizationStyles.urdfSettings.removeIcon} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={visualizationStyles.urdfSettings.emptyState}>No TF topics added</p>
            )}
          </div>

          {/* Point Cloud Topics Section */}
          <div className={visualizationStyles.urdfSettings.section}>
            <h3 className={visualizationStyles.urdfSettings.sectionTitle}>Point Cloud Topics</h3>

            <div className={visualizationStyles.urdfSettings.topicInputContainer}>
              <input
                type="text"
                value={newPointTopicInput}
                onChange={(e) => setNewPointTopicInput(e.target.value)}
                onKeyDown={handlePointCloudKeyDown}
                placeholder="e.g., /camera/depth/points"
                className={visualizationStyles.urdfSettings.topicInput}
              />
              <button
                onClick={handleAddPointCloudTopic}
                className={visualizationStyles.urdfSettings.addButton}
                title="Add topic"
                type="button"
              >
                <Plus className={visualizationStyles.urdfSettings.addIcon} />
              </button>
            </div>

            {pointCloudTopics.length > 0 ? (
              <div className={visualizationStyles.urdfSettings.topicList}>
                {pointCloudTopics.map((topic) => (
                  <div key={topic} className={visualizationStyles.urdfSettings.topicItem}>
                    <span className={visualizationStyles.urdfSettings.topicName}>{topic}</span>
                    <button
                      onClick={() => handleRemovePointCloudTopic(topic)}
                      className={visualizationStyles.urdfSettings.removeButton}
                      title="Remove topic"
                      type="button"
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
                <div
                  key={`${preset.name}-${index}`}
                  className={visualizationStyles.urdfSettings.presetItem}
                >
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className={visualizationStyles.urdfSettings.presetButton}
                    type="button"
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
                          type="button"
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
                  type="button"
                >
                  Clear
                </button>
              </div>

              <div className={visualizationStyles.urdfSettings.recentList}>
                {recentUrls.slice(0, 3).map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className={visualizationStyles.urdfSettings.recentItem}
                  >
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
