'use client';
import { useState } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { SettingsSection } from '../../layout/WidgetSettingsPortal';
import {
  LAYER_TYPES,
  type LayerType,
  type SceneLayerConfig,
  type LayerStatus,
} from '@/types/scene';
import type { TopicInfo } from '@/lib/rosbridge/types';
export default function LayerSettings({
  layers,
  onChange,
  statuses,
  topics,
}: {
  layers: SceneLayerConfig[];
  onChange: (layers: SceneLayerConfig[]) => void;
  statuses: Record<string, LayerStatus>;
  topics: TopicInfo[];
}) {
  const [type, setType] = useState<LayerType>('pointcloud');
  const update = (id: string, patch: Partial<SceneLayerConfig>) =>
    onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <>
      <SettingsSection
        title="Add layer"
        keywords="topic laser scan point cloud markers map path odometry pose camera image"
      >
        <div className="flex gap-2">
          <select
            aria-label="Layer type"
            className="min-w-0 flex-1 rounded bg-gray-800 p-2"
            value={type}
            onChange={(e) => setType(e.target.value as LayerType)}
          >
            {Object.entries(LAYER_TYPES).map(([value, info]) => (
              <option key={value} value={value}>
                {info.label}
              </option>
            ))}
          </select>
          <button
            className="workspace-button"
            aria-label="Add visualization layer"
            onClick={() =>
              onChange([
                ...layers,
                {
                  id: crypto.randomUUID(),
                  type,
                  topic: '',
                  enabled: true,
                  size:
                    type === 'camera'
                      ? 1
                      : ['pose', 'poses', 'odometry'].includes(type)
                        ? 0.5
                        : 0.04,
                  opacity: 1,
                  color: '#a78bfa',
                  maxPoints: 100000,
                },
              ])
            }
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </SettingsSection>
      {layers.map((layer) => {
        const status = statuses[layer.id];
        return (
          <SettingsSection
            key={layer.id}
            title={`${LAYER_TYPES[layer.type]?.label ?? layer.type} · ${layer.topic || 'New layer'}`}
            keywords={`${layer.topic} color opacity size enabled`}
          >
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layer.enabled}
                  onChange={(e) => update(layer.id, { enabled: e.target.checked })}
                />
                Visible
              </label>
              <button
                className="workspace-icon"
                aria-label={`Remove layer ${layer.topic || LAYER_TYPES[layer.type].label}`}
                onClick={() => onChange(layers.filter((l) => l.id !== layer.id))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <label className="scene-field">
              Topic
              <input
                aria-label={`Topic for ${layer.id}`}
                list={`topics-${layer.id}`}
                value={layer.topic}
                onChange={(e) => update(layer.id, { topic: e.target.value })}
                placeholder="/topic"
              />
            </label>
            <datalist id={`topics-${layer.id}`}>
              {topics
                .filter(
                  (t) =>
                    t.type.replace('/msg/', '/') ===
                    LAYER_TYPES[layer.type].message.replace('/msg/', '/')
                )
                .map((t) => (
                  <option key={t.topic} value={t.topic} />
                ))}
            </datalist>
            <p className="my-2 break-all font-mono text-[10px] text-gray-400">
              {LAYER_TYPES[layer.type].message}
            </p>
            {!['map', 'marker', 'markers'].includes(layer.type) && (
              <label className="scene-field">
                Color
                <input
                  aria-label={`Color for ${layer.id}`}
                  type="color"
                  value={layer.color ?? '#a78bfa'}
                  onChange={(e) => update(layer.id, { color: e.target.value })}
                />
              </label>
            )}
            <label className="scene-field">
              Opacity
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={layer.opacity ?? 1}
                onChange={(e) => update(layer.id, { opacity: Number(e.target.value) })}
              />
            </label>
            {!['map', 'marker', 'markers'].includes(layer.type) && (
              <label className="scene-field">
                {layer.type === 'camera' ? 'Image distance (m)' : 'Size (m)'}
                <input
                  type="number"
                  min="0.001"
                  step="0.01"
                  value={layer.size ?? 0.04}
                  onChange={(e) => {
                    const size = Number(e.target.value);
                    if (Number.isFinite(size) && size > 0) update(layer.id, { size });
                  }}
                />
              </label>
            )}
            {!['map', 'camera'].includes(layer.type) && (
              <label className="scene-field">
                Point limit
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1000"
                  value={layer.maxPoints ?? 100000}
                  onChange={(e) => {
                    const maxPoints = Number(e.target.value);
                    if (Number.isInteger(maxPoints) && maxPoints > 0 && maxPoints <= 1000000)
                      update(layer.id, { maxPoints });
                  }}
                />
              </label>
            )}
            {layer.type === 'camera' && (
              <>
                <label className="scene-field">
                  Image topic
                  <input
                    value={layer.imageTopic ?? ''}
                    placeholder="/camera/image_rect"
                    onChange={(e) => update(layer.id, { imageTopic: e.target.value })}
                  />
                </label>
                <label className="scene-field">
                  Image format
                  <select
                    value={layer.imageMode ?? 'raw'}
                    onChange={(e) =>
                      update(layer.id, { imageMode: e.target.value as 'raw' | 'compressed' })
                    }
                  >
                    <option value="raw">Raw Image</option>
                    <option value="compressed">CompressedImage</option>
                  </select>
                </label>
                <p className="py-2 text-xs text-gray-400">
                  Use a rectified image with matching CameraInfo. Distortion correction is not
                  performed here.
                </p>
              </>
            )}
            <div
              role="status"
              className={`scene-layer-status ${status?.level === 'error' ? 'text-red-300' : status?.level === 'ok' ? 'text-emerald-300' : 'text-gray-400'}`}
            >
              {status?.level === 'error' ? (
                <AlertCircle size={13} />
              ) : status?.level === 'ok' ? (
                <CheckCircle2 size={13} />
              ) : (
                <Clock size={13} />
              )}
              <span>{status?.message ?? 'Waiting'}</span>
            </div>
          </SettingsSection>
        );
      })}
    </>
  );
}
