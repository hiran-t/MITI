'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowDown, Copy, Trash2, X } from 'lucide-react';
import WidgetSettingsPortal from '../layout/WidgetSettingsPortal';
import { SelectField, ToggleField, TreeField, TreeSection } from '../layout/SettingsTree';
import TopicInput from '../topic-viewer/TopicInput';
import type { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';
import {
  LOG_LEVELS,
  LOG_MESSAGE_TYPES,
  formatLogStamp,
  matchesLog,
  toLogEntry,
  type LogEntry,
  type LogLevel,
} from '@/lib/logs/log-messages';
import type { LogWidgetProps } from '@/types/widget';
import { LOG_NAME_COLORS } from '@/lib/theme';

/** Messages kept in memory; older ones are dropped. */
const MAX_LOGS = 10000;
/** Rows rendered at once; filtering still covers every kept message. */
const MAX_ROWS = 1000;
/** /rosout can carry hundreds of messages a second, so the list updates in batches. */
const FLUSH_MS = 200;
const FONT_SIZES = [10, 11, 12, 13, 14, 16];

const LEVEL_TONE: Record<LogLevel, string> = {
  DEBUG: 'text-gray-400',
  INFO: 'text-gray-300',
  WARN: 'text-warn',
  ERROR: 'text-danger',
  FATAL: 'text-danger',
  UNKNOWN: 'text-gray-400',
};

interface DisplayOptions {
  showLevel: boolean;
  showDate: boolean;
  showTime: boolean;
  showTimezone: boolean;
  showName: boolean;
  showSource: boolean;
}

function formatLine(entry: LogEntry, display: DisplayOptions): string {
  const { date, time, zone } = formatLogStamp(entry.stamp);
  const stamp = [display.showDate && date, display.showTime && time, display.showTimezone && zone]
    .filter(Boolean)
    .join(' ');
  return [
    display.showLevel && `[${entry.level}]`,
    stamp && `[${stamp}]`,
    display.showName && entry.name && `[${entry.name}]:`,
    entry.message,
    display.showSource && entry.file && `(${entry.file}:${entry.line})`,
  ]
    .filter(Boolean)
    .join(' ');
}

function LogRow({
  entry,
  display,
  nameColor,
}: {
  entry: LogEntry;
  display: DisplayOptions;
  nameColor?: string;
}) {
  const { date, time, zone } = formatLogStamp(entry.stamp);
  const stamp = [display.showDate && date, display.showTime && time, display.showTimezone && zone]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`log-row ${LEVEL_TONE[entry.level]}`}>
      {display.showLevel && <span className="log-level">[{entry.level}]</span>}
      {stamp && <span className="log-meta">[{stamp}]</span>}
      {display.showName && entry.name && (
        <span className="log-name" style={{ color: nameColor }}>
          [{entry.name}]:
        </span>
      )}
      <span className="log-message">{entry.message}</span>
      {display.showSource && entry.file && (
        <span className="log-meta">
          ({entry.file}:{entry.line})
        </span>
      )}
    </div>
  );
}

export default function LogPanel({
  client,
  topics = [],
  props = {},
  onConfigChange,
}: {
  client: BridgeClient | null;
  topics?: TopicInfo[];
  props?: LogWidgetProps;
  onConfigChange: (updates: Partial<LogWidgetProps>) => void;
}) {
  const {
    topic = '/rosout',
    minLevel = 'DEBUG',
    searchTerms = [],
    hiddenNames = [],
    fontSize = 12,
    showLevel = true,
    showDate = false,
    showTime = true,
    showTimezone = false,
    showName = true,
    showSource = false,
  } = props;
  const display = { showLevel, showDate, showTime, showTimezone, showName, showSource };
  const buffer = useRef<LogEntry[]>([]);
  const nextId = useRef(0);
  // Each node keeps the color it got when it first logged, so its lines are easy to follow.
  const nameColors = useRef(new Map<string, string>());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const namesListId = useId();

  useEffect(() => {
    buffer.current = [];
    setLogs([]);
    setNames([]);
    nameColors.current = new Map();
    if (!client || !topic) return;
    const seen = new Set<string>();
    let dirty = false;
    const callback = (message: unknown) => {
      const entry = toLogEntry(message, nextId.current++);
      if (!entry) return;
      buffer.current.push(entry);
      if (buffer.current.length > MAX_LOGS * 1.1) buffer.current = buffer.current.slice(-MAX_LOGS);
      if (entry.name && !seen.has(entry.name)) {
        seen.add(entry.name);
        const colors = nameColors.current;
        colors.set(entry.name, LOG_NAME_COLORS[colors.size % LOG_NAME_COLORS.length]);
        setNames(Array.from(seen).sort());
      }
      dirty = true;
    };
    const timer = setInterval(() => {
      if (!dirty) return;
      dirty = false;
      setLogs(buffer.current.slice(-MAX_LOGS));
    }, FLUSH_MS);
    client.subscribe(topic, callback);
    return () => {
      clearInterval(timer);
      client.unsubscribe(topic, callback);
    };
  }, [client, topic]);

  // A term being typed filters live, like a committed chip.
  const terms = useMemo(
    () => (draft.trim() ? [...searchTerms, draft.trim()] : searchTerms),
    [searchTerms, draft]
  );
  const filtered = useMemo(
    () => logs.filter((entry) => matchesLog(entry, { minLevel, searchTerms: terms, hiddenNames })),
    [logs, minLevel, terms, hiddenNames]
  );
  const rows = filtered.slice(-MAX_ROWS);

  // Stay at the newest message unless the user has scrolled up to read.
  useLayoutEffect(() => {
    if (following && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [rows, following]);

  const addTerm = (term: string) => {
    const value = term.trim();
    if (value && !searchTerms.includes(value))
      onConfigChange({ searchTerms: [...searchTerms, value] });
    setDraft('');
  };
  const onFilterKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') addTerm(draft);
    else if (event.key === 'Backspace' && !draft && searchTerms.length)
      onConfigChange({ searchTerms: searchTerms.slice(0, -1) });
    else if (event.key === 'Escape') {
      event.stopPropagation();
      setDraft('');
    }
  };

  const published = topics.some((t) => t.topic === topic);
  const topicError = topics.length > 0 && !published ? `${topic} is not published` : undefined;

  return (
    <div className="log-panel" style={{ fontSize }}>
      <div className="log-filter">
        <div className="log-filter-field">
          {searchTerms.map((term) => (
            <span key={term} className="log-chip">
              {term}
              <button
                type="button"
                aria-label={`Remove filter ${term}`}
                onClick={() =>
                  onConfigChange({ searchTerms: searchTerms.filter((t) => t !== term) })
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            aria-label="Filter messages"
            list={namesListId}
            value={draft}
            placeholder={searchTerms.length ? '' : 'Filter messages'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onFilterKey}
            onBlur={() => draft.trim() && names.includes(draft.trim()) && addTerm(draft)}
          />
          <datalist id={namesListId}>
            {names.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <button
          type="button"
          className="log-tool"
          aria-label="Copy shown logs"
          title="Copy shown logs"
          onClick={() =>
            navigator.clipboard?.writeText(
              rows.map((entry) => formatLine(entry, display)).join('\n')
            )
          }
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="log-tool"
          aria-label="Clear logs"
          title="Clear logs"
          onClick={() => {
            buffer.current = [];
            setLogs([]);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div
        ref={listRef}
        className="log-list"
        role="log"
        aria-label={`Log messages from ${topic}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
      >
        {rows.length === 0 ? (
          <p className="log-empty">
            {!client
              ? 'Not connected to ROS'
              : topicError
                ? topicError
                : logs.length
                  ? `No messages match the filter (${logs.length} received)`
                  : `Waiting for messages on ${topic}`}
          </p>
        ) : (
          <>
            {filtered.length > rows.length && (
              <p className="log-empty">
                Showing the latest {rows.length} of {filtered.length} matching messages
              </p>
            )}
            {rows.map((entry) => (
              <LogRow
                key={entry.id}
                entry={entry}
                display={display}
                nameColor={nameColors.current.get(entry.name)}
              />
            ))}
          </>
        )}
      </div>
      {!following && rows.length > 0 && (
        <button type="button" className="log-follow" onClick={() => setFollowing(true)}>
          <ArrowDown size={13} /> Latest
        </button>
      )}

      <WidgetSettingsPortal>
        <TreeSection title="General" keywords="topic rosout log level">
          <TreeField label="Topic" error={topicError}>
            <TopicInput
              aria-label="Log topic"
              value={topic}
              onCommit={(next) => onConfigChange({ topic: next })}
              topics={topics}
              messageType={LOG_MESSAGE_TYPES}
              placeholder="/rosout"
            />
          </TreeField>
          <SelectField
            label="Log level"
            value={minLevel === 'UNKNOWN' ? 'DEBUG' : minLevel}
            options={LOG_LEVELS.map((level) => ({ value: level, label: `>= ${level}` }))}
            onChange={(level) => onConfigChange({ minLevel: level })}
          />
        </TreeSection>
        <TreeSection
          title="Namespaces"
          keywords={`node names ${names.join(' ')}`}
          defaultOpen={false}
          actions={[
            { label: 'Show all', onSelect: () => onConfigChange({ hiddenNames: [] }) },
            { label: 'Hide all', onSelect: () => onConfigChange({ hiddenNames: names }) },
          ]}
        >
          {names.length === 0 && (
            <p className="px-4 py-2 text-xs text-gray-400">Node names appear as logs arrive.</p>
          )}
          {names.map((name) => (
            <TreeSection
              key={name}
              title={name}
              depth={1}
              visible={!hiddenNames.includes(name)}
              onVisibleChange={(visible) =>
                onConfigChange({
                  hiddenNames: visible
                    ? hiddenNames.filter((hidden) => hidden !== name)
                    : [...hiddenNames, name],
                })
              }
            />
          ))}
        </TreeSection>
        <TreeSection
          title="Display"
          keywords="font size level date time timezone name source location"
        >
          <SelectField
            label="Font size"
            value={String(fontSize)}
            options={FONT_SIZES.map((size) => ({ value: String(size), label: `${size} px` }))}
            onChange={(size) => onConfigChange({ fontSize: Number(size) })}
          />
          <ToggleField
            label="Level"
            value={showLevel}
            onChange={(value) => onConfigChange({ showLevel: value })}
          />
          <ToggleField
            label="Date"
            value={showDate}
            onChange={(value) => onConfigChange({ showDate: value })}
          />
          <ToggleField
            label="Time"
            value={showTime}
            onChange={(value) => onConfigChange({ showTime: value })}
          />
          <ToggleField
            label="Timezone"
            value={showTimezone}
            onChange={(value) => onConfigChange({ showTimezone: value })}
          />
          <ToggleField
            label="Name"
            value={showName}
            onChange={(value) => onConfigChange({ showName: value })}
          />
          <ToggleField
            label="Source location"
            value={showSource}
            onChange={(value) => onConfigChange({ showSource: value })}
          />
        </TreeSection>
      </WidgetSettingsPortal>
    </div>
  );
}
