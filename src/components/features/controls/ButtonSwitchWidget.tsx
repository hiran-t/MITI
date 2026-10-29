'use client';

import { useState, useCallback, useRef } from 'react';
import { Power, Radio, Zap, Loader2 } from 'lucide-react';
import WidgetSettingsPortal, { SettingsSection } from '../layout/WidgetSettingsPortal';
import type { BridgeClient } from '@/lib/bridge/client';
import type { ButtonSwitchWidgetProps, ButtonSwitchMode } from '@/types/widget';
import { commonStyles, cn } from '@/styles';
import TopicInput from '../topic-viewer/TopicInput';

// ─── Settings Panel ──────────────────────────────────────────────────────────
// Rendered in the selected widget inspector; runtime controls stay in the panel.

interface SettingsPanelProps {
  label: string;
  mode: ButtonSwitchMode;
  topic: string;
  messageType: string;
  onPayload: string;
  offPayload: string;
  service: string;
  onArgs: string;
  offArgs: string;
  onLabelChange: (v: string) => void;
  onModeChange: (v: ButtonSwitchMode) => void;
  onTopicChange: (v: string) => void;
  onMessageTypeChange: (v: string) => void;
  onPayloadChange: (v: string) => void;
  offPayloadChange: (v: string) => void;
  onServiceChange: (v: string) => void;
  onArgsChange: (v: string) => void;
  offArgsChange: (v: string) => void;
}

function SettingsPanel({
  label,
  mode,
  topic,
  messageType,
  onPayload,
  offPayload,
  service,
  onArgs,
  offArgs,
  onLabelChange,
  onModeChange,
  onTopicChange,
  onMessageTypeChange,
  onPayloadChange,
  offPayloadChange,
  onServiceChange,
  onArgsChange,
  offArgsChange,
}: SettingsPanelProps) {
  return (
    <div className="flex flex-col">
      {/* ── Header ── */}

      {/* ── Body ── */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Label */}
        <div>
          <label className={commonStyles.input.label}>Button Label</label>
          <input
            type="text"
            aria-label="Button Label"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            className={commonStyles.input.base}
            placeholder="My Switch"
          />
        </div>

        {/* Mode pill selector */}
        <div>
          <label className={commonStyles.input.label}>Action Mode</label>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-gray-700 bg-gray-800/60 p-1">
            {(
              [
                { id: 'topic' as const, icon: Radio, label: 'Publish Topic' },
                { id: 'service' as const, icon: Zap, label: 'Call Service' },
              ] as const
            ).map(({ id, icon: Icon, label: modeLabel }) => (
              <button
                key={id}
                onClick={() => onModeChange(id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all',
                  mode === id
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                <Icon className="h-3 w-3" />
                {modeLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Topic mode */}
        {mode === 'topic' && (
          <>
            <div>
              <label className={commonStyles.input.label}>Topic</label>
              <TopicInput
                aria-label="Topic"
                value={topic}
                onCommit={onTopicChange}
                className={commonStyles.input.base}
                placeholder="/cmd_vel"
              />
            </div>
            <div>
              <label className={commonStyles.input.label}>Message Type</label>
              <input
                type="text"
                aria-label="Message Type"
                value={messageType}
                onChange={(e) => onMessageTypeChange(e.target.value)}
                className={commonStyles.input.base}
                placeholder="std_msgs/Bool"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={commonStyles.input.label}>ON Payload</label>
                <textarea
                  aria-label="ON Payload"
                  value={onPayload}
                  onChange={(e) => onPayloadChange(e.target.value)}
                  className={cn(commonStyles.input.base, 'h-16 resize-none font-mono text-xs')}
                  placeholder='{"data": true}'
                />
              </div>
              <div>
                <label className={commonStyles.input.label}>OFF Payload</label>
                <textarea
                  aria-label="OFF Payload"
                  value={offPayload}
                  onChange={(e) => offPayloadChange(e.target.value)}
                  className={cn(commonStyles.input.base, 'h-16 resize-none font-mono text-xs')}
                  placeholder='{"data": false}'
                />
              </div>
            </div>
          </>
        )}

        {/* Service mode */}
        {mode === 'service' && (
          <>
            <div>
              <label className={commonStyles.input.label}>Service</label>
              <input
                type="text"
                aria-label="Service"
                value={service}
                onChange={(e) => onServiceChange(e.target.value)}
                className={commonStyles.input.base}
                placeholder="/set_bool"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={commonStyles.input.label}>ON Args</label>
                <textarea
                  aria-label="ON Args"
                  value={onArgs}
                  onChange={(e) => onArgsChange(e.target.value)}
                  className={cn(commonStyles.input.base, 'h-16 resize-none font-mono text-xs')}
                  placeholder='{"data": true}'
                />
              </div>
              <div>
                <label className={commonStyles.input.label}>OFF Args</label>
                <textarea
                  aria-label="OFF Args"
                  value={offArgs}
                  onChange={(e) => offArgsChange(e.target.value)}
                  className={cn(commonStyles.input.base, 'h-16 resize-none font-mono text-xs')}
                  placeholder='{"data": false}'
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

interface ButtonSwitchWidgetComponentProps {
  client: BridgeClient | null;
  props?: ButtonSwitchWidgetProps;
  onConfigChange: (config: Partial<ButtonSwitchWidgetProps>) => void;
}

export default function ButtonSwitchWidget({
  client,
  props,
  onConfigChange,
}: ButtonSwitchWidgetComponentProps) {
  // ── Config ──
  const label = props?.label ?? 'Switch';
  const mode = props?.mode ?? 'topic';
  const topic = props?.topic ?? '';
  const messageType = props?.messageType ?? 'std_msgs/Bool';
  const onPayload = props?.onPayload ?? '{"data": true}';
  const offPayload = props?.offPayload ?? '{"data": false}';
  const service = props?.service ?? '';
  const onArgs = props?.onArgs ?? '{"data": true}';
  const offArgs = props?.offArgs ?? '{"data": false}';

  // ── Runtime ──
  const [isOn, setIsOn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const advertisedTopics = useRef<Set<string>>(new Set());

  const showFeedback = useCallback((ok: boolean, text: string) => {
    setFeedback({ ok, text });
    const id = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(id);
  }, []);

  const handleToggle = useCallback(async () => {
    if (!client || isSending) return;
    const nextState = !isOn;
    setIsSending(true);
    try {
      if (mode === 'topic') {
        if (!topic) throw new Error('No topic configured');
        const key = `${topic}::${messageType}`;
        if (!advertisedTopics.current.has(key)) {
          client.advertise(topic, messageType);
          advertisedTopics.current.add(key);
        }
        client.publish(topic, JSON.parse(nextState ? onPayload : offPayload) as unknown);
        setIsOn(nextState);
        showFeedback(true, nextState ? 'Published ON' : 'Published OFF');
      } else {
        if (!service) throw new Error('No service configured');
        await client.callService(service, JSON.parse(nextState ? onArgs : offArgs) as unknown);
        setIsOn(nextState);
        showFeedback(true, nextState ? 'Service → ON' : 'Service → OFF');
      }
    } catch (err) {
      showFeedback(false, (err as Error).message);
    } finally {
      setIsSending(false);
    }
  }, [
    client,
    isSending,
    isOn,
    mode,
    topic,
    messageType,
    onPayload,
    offPayload,
    service,
    onArgs,
    offArgs,
    showFeedback,
  ]);

  const connected = client?.isConnected() ?? false;
  const target = mode === 'topic' ? topic : service;

  // ── Toggle button visual state ──
  const btnState = !connected ? 'disconnected' : isSending ? 'sending' : isOn ? 'on' : 'off';

  const btnClass = {
    disconnected: 'border-gray-800 bg-gray-900/40 text-gray-600 cursor-not-allowed',
    sending: 'border-yellow-500/50 bg-yellow-500/8 text-yellow-400 animate-pulse cursor-wait',
    on: 'border-lime-400/60 bg-lime-400/8 text-lime-300 hover:bg-lime-400/12 active:scale-[0.98]',
    off: 'border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-600 hover:bg-gray-800/60 active:scale-[0.98]',
  }[btnState];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* ── Label ── */}
      <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-3">
        <span className="truncate text-xs font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>

      {/* ── Toggle button (fills remaining space) ── */}
      <div className="min-h-0 flex-1 px-3 pb-2">
        <button
          onClick={handleToggle}
          disabled={!connected || isSending}
          title={
            !connected ? 'Not connected to ROS' : isOn ? 'Click to turn OFF' : 'Click to turn ON'
          }
          className={cn(
            'h-full w-full rounded-xl border-2 transition-all duration-200',
            'flex flex-col items-center justify-center gap-2',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900',
            btnClass
          )}
        >
          {isSending ? (
            <Loader2 className="h-7 w-7 animate-spin opacity-70" />
          ) : (
            <Power
              className={cn(
                'h-7 w-7 transition-all duration-200',
                isOn && connected && 'drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]'
              )}
              strokeWidth={isOn ? 2.5 : 1.5}
            />
          )}
          <span
            className={cn(
              'text-xl font-bold tabular-nums tracking-widest transition-all duration-200',
              isOn && connected ? 'text-lime-300' : 'text-current'
            )}
          >
            {isSending ? '···' : isOn ? 'ON' : 'OFF'}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium opacity-50">
            {mode === 'topic' ? <Radio className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {mode === 'topic' ? 'topic' : 'service'}
          </span>
        </button>
      </div>

      {/* ── Status row ── */}
      <div className="flex shrink-0 items-center gap-2 px-3 pb-3">
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            connected ? 'bg-lime-400' : 'bg-gray-600'
          )}
        />
        <span className="truncate text-xs text-gray-600">
          {connected
            ? target || (mode === 'topic' ? 'no topic set' : 'no service set')
            : 'disconnected'}
        </span>
      </div>

      {/* ── Feedback toast ── */}
      {feedback && (
        <div
          className={cn(
            'pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2',
            'whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium',
            feedback.ok
              ? 'border-lime-400/25 bg-lime-400/15 text-lime-300'
              : 'border-red-400/25 bg-red-400/15 text-red-300'
          )}
        >
          {feedback.text}
        </div>
      )}

      {/* ── Sidebar settings ── */}
      <WidgetSettingsPortal>
        <SettingsSection
          title="General"
          keywords="button label action mode topic service message type ON OFF payload args"
        >
          <SettingsPanel
            label={label}
            mode={mode}
            topic={topic}
            messageType={messageType}
            onPayload={onPayload}
            offPayload={offPayload}
            service={service}
            onArgs={onArgs}
            offArgs={offArgs}
            onLabelChange={(label) => onConfigChange({ label })}
            onModeChange={(mode) => onConfigChange({ mode })}
            onTopicChange={(topic) => onConfigChange({ topic })}
            onMessageTypeChange={(messageType) => onConfigChange({ messageType })}
            onPayloadChange={(onPayload) => onConfigChange({ onPayload })}
            offPayloadChange={(offPayload) => onConfigChange({ offPayload })}
            onServiceChange={(service) => onConfigChange({ service })}
            onArgsChange={(onArgs) => onConfigChange({ onArgs })}
            offArgsChange={(offArgs) => onConfigChange({ offArgs })}
          />
        </SettingsSection>
      </WidgetSettingsPortal>
    </div>
  );
}
