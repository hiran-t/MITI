'use client';

import { useState } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { useTopic } from '@/hooks/useTopic';
import { Activity, GitBranch, Clock, Settings, X, Loader2 } from 'lucide-react';
import { commonStyles } from '@/styles';
import { STATE_MACHINE_TOPICS } from '@/constants/ros-topics';

interface StateMachineMonitorProps {
  client: ROSBridge | null;
  smaccTopic?: string;
  btStatusTopic?: string;
}

// SMACC2 types
interface SMACC2State {
  name: string;
  is_active: boolean;
}

interface SMACC2Transition {
  from_state: string;
  to_state: string;
  timestamp: number;
}

interface SMACC2Status {
  machine_id: string;
  current_state: string;
  previous_state?: string;
  timestamp: number;
  is_running: boolean;
  states?: SMACC2State[];
  transition_history?: SMACC2Transition[];
}

// BehaviorTree types
type NodeStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILURE';

interface BTNode {
  id: string;
  name: string;
  type: string;
  status: NodeStatus;
  children?: BTNode[];
}

interface BTStatus {
  tree_id: string;
  root_node: BTNode;
  is_running: boolean;
  total_ticks: number;
  timestamp: number;
}

type TabType = 'smacc2' | 'behavior_tree';

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'smacc2', label: 'SMACC2', icon: <Activity className="h-3.5 w-3.5" /> },
  { id: 'behavior_tree', label: 'Behavior Tree', icon: <GitBranch className="h-3.5 w-3.5" /> },
];

// ─── BehaviorTree Node Component ────────────────────────────────────────────

const STATUS_STYLES: Record<NodeStatus, { dot: string; label: string; bg: string }> = {
  SUCCESS: {
    dot: 'bg-green-400',
    label: 'text-green-400',
    bg: 'border-green-500/30 bg-green-500/10',
  },
  FAILURE: { dot: 'bg-red-400', label: 'text-red-400', bg: 'border-red-500/30 bg-red-500/10' },
  RUNNING: {
    dot: 'bg-yellow-400 animate-pulse',
    label: 'text-yellow-400',
    bg: 'border-yellow-500/30 bg-yellow-500/10',
  },
  IDLE: { dot: 'bg-gray-500', label: 'text-gray-500', bg: 'border-gray-700 bg-gray-800/30' },
};

function BTNodeIcon({ type }: { type: string }) {
  switch (type) {
    case 'Sequence':
      return <span className="text-xs font-bold text-blue-400">→</span>;
    case 'Selector':
      return <span className="text-xs font-bold text-purple-400">?</span>;
    case 'Root':
      return <span className="text-xs font-bold text-cyan-400">⊙</span>;
    case 'Action':
      return <span className="text-xs font-bold text-orange-400">▶</span>;
    case 'Condition':
      return <span className="text-xs font-bold text-teal-400">◇</span>;
    case 'Decorator':
      return <span className="text-xs font-bold text-pink-400">∂</span>;
    default:
      return <span className="text-xs font-bold text-gray-400">•</span>;
  }
}

function BTNodeRow({ node, depth = 0 }: { node: BTNode; depth?: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const status = (node.status?.toUpperCase() as NodeStatus) || 'IDLE';
  const style = STATUS_STYLES[status] || STATUS_STYLES.IDLE;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`mb-0.5 flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs transition-opacity hover:opacity-90 ${style.bg}`}
        style={{ marginLeft: `${depth * 16}px` }}
        onClick={() => hasChildren && setCollapsed(!collapsed)}
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${style.dot}`} />
        <BTNodeIcon type={node.type} />
        <span className="flex-1 truncate font-medium text-gray-200">{node.name}</span>
        <span className={`flex-shrink-0 text-xs ${style.label}`}>{status}</span>
        <span className="flex-shrink-0 text-xs text-gray-600">[{node.type}]</span>
        {hasChildren && (
          <span className="flex-shrink-0 text-xs text-gray-500">{collapsed ? '▶' : '▼'}</span>
        )}
      </div>
      {!collapsed &&
        hasChildren &&
        node.children?.map((child) => <BTNodeRow key={child.id} node={child} depth={depth + 1} />)}
    </div>
  );
}

// ─── Shared Empty Pane ───────────────────────────────────────────────────────

function EmptyPane({
  icon,
  message,
  sub,
}: {
  icon: React.ReactNode;
  message: string;
  sub?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-500">
      {icon}
      <p className="text-sm">{message}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  );
}

// ─── SMACC2 Tab ─────────────────────────────────────────────────────────────

function SMACC2Tab({ client, topic }: { client: ROSBridge | null; topic: string }) {
  const { data, lastUpdate } = useTopic<SMACC2Status>(client, topic);

  if (!client) {
    return (
      <EmptyPane
        icon={<Activity className="h-10 w-10 opacity-30" />}
        message="Not connected to ROS"
      />
    );
  }

  if (!data) {
    return (
      <EmptyPane
        icon={<Loader2 className="h-8 w-8 animate-spin opacity-40" />}
        message="Waiting for data..."
        sub={topic}
      />
    );
  }

  const history = data.transition_history || [];
  const states = data.states || [];

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Status header */}
      <div
        className={`flex flex-shrink-0 items-center gap-2 rounded-lg border px-3 py-2 ${data.is_running ? 'border-green-500/40 bg-green-500/10' : 'border-gray-700 bg-gray-800/50'}`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${data.is_running ? 'animate-pulse bg-green-400' : 'bg-gray-600'}`}
        />
        <span className="text-xs text-gray-400">Machine ID:</span>
        <span className="truncate text-sm font-semibold text-gray-200">
          {data.machine_id || '—'}
        </span>
        <span
          className={`ml-auto rounded px-2 py-0.5 text-xs font-medium ${data.is_running ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}
        >
          {data.is_running ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>

      {/* Current / Previous state */}
      <div className="grid flex-shrink-0 grid-cols-2 gap-2">
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
          <p className="mb-1 text-xs text-gray-500">Current State</p>
          <p className="truncate text-sm font-bold text-cyan-300">{data.current_state || '—'}</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-2">
          <p className="mb-1 text-xs text-gray-500">Previous State</p>
          <p className="truncate text-sm font-medium text-gray-400">{data.previous_state || '—'}</p>
        </div>
      </div>

      {/* States list */}
      {states.length > 0 && (
        <div className="flex-shrink-0">
          <p className="mb-1.5 text-xs font-medium text-gray-500">All States</p>
          <div className="flex flex-wrap gap-1.5">
            {states.map((s, i) => (
              <span
                key={i}
                className={`rounded border px-2 py-0.5 text-xs ${
                  s.is_active
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-500'
                }`}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Transition history */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="mb-1.5 flex-shrink-0 text-xs font-medium text-gray-500">
          Transition History{' '}
          {history.length > 0 && <span className="text-gray-600">({history.length})</span>}
        </p>
        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-xs italic text-gray-600">No transitions yet</p>
          ) : (
            history.map((_, i) => {
              const t = history[history.length - 1 - i];
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded border border-gray-800 bg-gray-800/40 px-2 py-1.5 text-xs"
                >
                  <span className="truncate text-gray-400">{t.from_state}</span>
                  <span className="flex-shrink-0 text-gray-600">→</span>
                  <span className="truncate font-medium text-cyan-400">{t.to_state}</span>
                  {t.timestamp && (
                    <span className="ml-auto flex-shrink-0 tabular-nums text-gray-600">
                      {new Date(t.timestamp / 1e6).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-shrink-0 items-center gap-2 text-xs text-gray-600">
        <Clock className="h-3 w-3" />
        {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
      </div>
    </div>
  );
}

// ─── BehaviorTree Tab ────────────────────────────────────────────────────────

function BehaviorTreeTab({ client, topic }: { client: ROSBridge | null; topic: string }) {
  const { data, lastUpdate } = useTopic<BTStatus>(client, topic);

  if (!client) {
    return (
      <EmptyPane
        icon={<GitBranch className="h-10 w-10 opacity-30" />}
        message="Not connected to ROS"
      />
    );
  }

  if (!data) {
    return (
      <EmptyPane
        icon={<Loader2 className="h-8 w-8 animate-spin opacity-40" />}
        message="Waiting for data..."
        sub={topic}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Stats bar */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <div
          className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 ${data.is_running ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-gray-700 bg-gray-800/50'}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${data.is_running ? 'animate-pulse bg-yellow-400' : 'bg-gray-600'}`}
          />
          <span className="truncate text-xs text-gray-400">
            Tree: <span className="font-medium text-gray-300">{data.tree_id || '—'}</span>
          </span>
        </div>
        <div className="flex-shrink-0 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-400">
          <span className="font-medium tabular-nums text-gray-300">{data.total_ticks ?? 0}</span>{' '}
          ticks
        </div>
        <div
          className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${data.is_running ? 'border-yellow-500/40 text-yellow-400' : 'border-gray-700 text-gray-500'}`}
        >
          {data.is_running ? 'RUNNING' : 'IDLE'}
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-shrink-0 items-center gap-3 px-1">
        {(['SUCCESS', 'FAILURE', 'RUNNING', 'IDLE'] as NodeStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[s].dot}`} />
            <span className={`text-xs ${STATUS_STYLES[s].label}`}>{s}</span>
          </div>
        ))}
      </div>

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {data.root_node ? (
          <BTNodeRow node={data.root_node} depth={0} />
        ) : (
          <p className="text-xs italic text-gray-600">No tree data</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-shrink-0 items-center gap-2 text-xs text-gray-600">
        <Clock className="h-3 w-3" />
        {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
      </div>
    </div>
  );
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

function SettingsPanel({
  smaccTopic,
  btTopic,
  onSmaccTopicChange,
  onBtTopicChange,
  onClose,
}: {
  smaccTopic: string;
  btTopic: string;
  onSmaccTopicChange: (t: string) => void;
  onBtTopicChange: (t: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-lg bg-gray-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-800 px-4 py-3">
        <Settings className="h-3.5 w-3.5 text-gray-500" />
        <span className="flex-1 text-sm font-semibold text-gray-200">Configure Topics</span>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-800/50 hover:text-gray-300"
          aria-label="Close settings"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className={commonStyles.input.label}>SMACC2 Status Topic</label>
          <input
            type="text"
            value={smaccTopic}
            onChange={(e) => onSmaccTopicChange(e.target.value)}
            className={commonStyles.input.base}
            placeholder="/smacc2/status"
          />
        </div>
        <div>
          <label className={commonStyles.input.label}>BehaviorTree Status Topic</label>
          <input
            type="text"
            value={btTopic}
            onChange={(e) => onBtTopicChange(e.target.value)}
            className={commonStyles.input.base}
            placeholder="/behavior_tree/execution_status"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-800 px-4 py-3">
        <button onClick={onClose} className={`w-full ${commonStyles.button.primary} text-sm`}>
          Apply
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StateMachineMonitor({
  client,
  smaccTopic: initialSmaccTopic = STATE_MACHINE_TOPICS.SMACC2,
  btStatusTopic: initialBtTopic = STATE_MACHINE_TOPICS.BEHAVIOR_TREE,
}: StateMachineMonitorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('smacc2');
  const [smaccTopic, setSmaccTopic] = useState(initialSmaccTopic);
  const [btTopic, setBtTopic] = useState(initialBtTopic);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-gray-800 bg-gray-900/60 px-3 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setShowSettings(true)}
          className="ml-auto rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-800/50 hover:text-gray-300"
          aria-label="Configure topics"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-3">
        {activeTab === 'smacc2' && <SMACC2Tab client={client} topic={smaccTopic} />}
        {activeTab === 'behavior_tree' && <BehaviorTreeTab client={client} topic={btTopic} />}
      </div>

      {/* Settings overlay */}
      {showSettings && (
        <SettingsPanel
          smaccTopic={smaccTopic}
          btTopic={btTopic}
          onSmaccTopicChange={setSmaccTopic}
          onBtTopicChange={setBtTopic}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
