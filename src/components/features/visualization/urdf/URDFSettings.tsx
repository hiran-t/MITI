'use client';

import { useState, useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Settings, Trash2, Clock, Plus, X } from 'lucide-react';
import { commonStyles, cn } from '@/styles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface URDFPreset {
  name: string;
  urdfUrl: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
}

interface URDFSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPreset: (preset: Omit<URDFPreset, 'name'>) => void;
  pointCloudTopics?: string[];
  onPointCloudTopicsChange?: (topics: string[]) => void;
  jointStatesTopic: string;
  onJointStatesTopicChange: (topic: string) => void;
  tfTopics: string[];
  onTfTopicsChange: (topics: string[]) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{children}</p>
  );
}

// ─── Topic chip list ──────────────────────────────────────────────────────────

interface TopicChipListProps {
  topics: string[];
  inputValue: string;
  placeholder: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (t: string) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
}

function TopicChipList({
  topics,
  inputValue,
  placeholder,
  onInputChange,
  onAdd,
  onRemove,
  onKeyDown,
}: TopicChipListProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(commonStyles.input.base, 'py-1.5 text-xs')}
        />
        <button
          onClick={onAdd}
          type="button"
          className="shrink-0 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-600"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {topics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 py-1 pl-2.5 pr-1.5 text-xs text-gray-300"
            >
              <span className="max-w-[180px] truncate">{t}</span>
              <button
                onClick={() => onRemove(t)}
                type="button"
                className="text-gray-500 transition-colors hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-gray-600">None added</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function URDFSettings({
  isOpen,
  onClose,
  onLoadPreset,
  pointCloudTopics = [],
  onPointCloudTopicsChange,
  jointStatesTopic,
  onJointStatesTopicChange,
  tfTopics,
  onTfTopicsChange,
}: URDFSettingsProps) {
  const [presets, setPresets] = useState<URDFPreset[]>(DEFAULT_PRESETS);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [newPointTopicInput, setNewPointTopicInput] = useState('');
  const [newTfTopicInput, setNewTfTopicInput] = useState('');

  // Load persisted data
  useEffect(() => {
    const savedPresets = localStorage.getItem(STORAGE_KEY_PRESETS);
    const savedRecent = localStorage.getItem(STORAGE_KEY_RECENT);

    if (savedPresets) {
      try {
        const parsed = JSON.parse(savedPresets) as URDFPreset[];
        setPresets(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PRESETS);
      } catch {
        setPresets(DEFAULT_PRESETS);
      }
    }
    if (savedRecent) {
      try {
        const parsed = JSON.parse(savedRecent) as string[];
        setRecentUrls(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRecentUrls([]);
      }
    }
  }, []);

  if (!isOpen) return null;

  // ── Presets ──
  const handleLoadPreset = (preset: URDFPreset) => {
    onLoadPreset({
      urdfUrl: preset.urdfUrl,
      meshBaseUrl: preset.meshBaseUrl,
      packageMapping: preset.packageMapping,
    });
    onClose();
  };

  const handleDeletePreset = (index: number, e: ReactMouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
  };

  const handleClearRecent = () => {
    setRecentUrls([]);
    localStorage.removeItem(STORAGE_KEY_RECENT);
  };

  // ── Point cloud topics ──
  const handleAddPointCloud = () => {
    const t = newPointTopicInput.trim();
    if (!t || pointCloudTopics.includes(t)) return;
    onPointCloudTopicsChange?.([...pointCloudTopics, t]);
    setNewPointTopicInput('');
  };

  // ── TF topics ──
  const handleAddTf = () => {
    const t = newTfTopicInput.trim();
    if (!t || tfTopics.includes(t)) return;
    onTfTopicsChange([...tfTopics, t]);
    setNewTfTopicInput('');
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-lg bg-gray-950/95 backdrop-blur-sm">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-800 px-4 py-3">
        <Settings className="h-3.5 w-3.5 text-gray-500" />
        <span className="flex-1 text-sm font-semibold text-gray-200">Scene Settings</span>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-800/50 hover:text-gray-300"
          aria-label="Close settings"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Joint States Topic */}
        <div>
          <SectionLabel>Joint States Topic</SectionLabel>
          <input
            type="text"
            value={jointStatesTopic}
            onChange={(e) => onJointStatesTopicChange(e.target.value)}
            placeholder="/robot_inbound/joint_states"
            className={cn(commonStyles.input.base, 'text-xs')}
          />
        </div>

        {/* TF Topics */}
        <div>
          <SectionLabel>TF Topics</SectionLabel>
          <TopicChipList
            topics={tfTopics}
            inputValue={newTfTopicInput}
            placeholder="/tf or /robot_inbound/tf"
            onInputChange={setNewTfTopicInput}
            onAdd={handleAddTf}
            onRemove={(t) => onTfTopicsChange(tfTopics.filter((x) => x !== t))}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTf()}
          />
        </div>

        {/* Point Cloud Topics */}
        <div>
          <SectionLabel>Point Cloud Topics</SectionLabel>
          <TopicChipList
            topics={pointCloudTopics}
            inputValue={newPointTopicInput}
            placeholder="/camera/depth/points"
            onInputChange={setNewPointTopicInput}
            onAdd={handleAddPointCloud}
            onRemove={(t) => onPointCloudTopicsChange?.(pointCloudTopics.filter((x) => x !== t))}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPointCloud()}
          />
        </div>

        {/* Presets */}
        <div>
          <SectionLabel>Presets</SectionLabel>
          <div className="space-y-1.5">
            {presets.map((preset, i) => (
              <div
                key={`${preset.name}-${i}`}
                className="group flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 transition-colors hover:border-gray-600 hover:bg-gray-800"
                onClick={() => handleLoadPreset(preset)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-200">{preset.name}</p>
                  <p className="truncate text-xs text-gray-500">{preset.urdfUrl}</p>
                </div>
                {i >= DEFAULT_PRESETS.length && (
                  <button
                    onClick={(e) => handleDeletePreset(i, e)}
                    type="button"
                    className="shrink-0 p-1 text-gray-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent URLs */}
        {recentUrls.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Recent URLs
                </span>
              </SectionLabel>
              <button
                onClick={handleClearRecent}
                type="button"
                className="-mt-2 text-xs text-gray-600 transition-colors hover:text-gray-400"
              >
                Clear
              </button>
            </div>
            <div className="space-y-1">
              {recentUrls.slice(0, 3).map((url, i) => (
                <p key={`${url}-${i}`} className="truncate px-1 text-xs text-gray-500">
                  {url}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tip */}
        <p className="text-xs text-gray-600">
          <span className="font-medium text-cyan-500">Tip:</span> Enable CORS on your web server to
          load remote URDF files.
        </p>
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 border-t border-gray-800 px-4 py-3">
        <button onClick={onClose} className={cn(commonStyles.button.primary, 'w-full text-sm')}>
          Apply
        </button>
      </div>
    </div>
  );
}
