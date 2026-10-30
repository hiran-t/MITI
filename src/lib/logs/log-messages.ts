/**
 * Log messages from ROS 2 (`rcl_interfaces/msg/Log`, e.g. /rosout), ROS 1 (`rosgraph_msgs/Log`)
 * and Foxglove (`foxglove.Log`), normalised for the Log panel.
 */
export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number] | 'UNKNOWN';

/** Message types the Log panel understands. */
export const LOG_MESSAGE_TYPES = [
  'rcl_interfaces/msg/Log',
  'rosgraph_msgs/msg/Log',
  'foxglove.Log',
  'foxglove_msgs/msg/Log',
];

export interface LogEntry {
  /** Arrival order, unique within a panel. */
  id: number;
  /** Seconds, on the publisher's clock. */
  stamp: number;
  level: LogLevel;
  name: string;
  message: string;
  file: string;
  line: number;
  fn: string;
}

export interface LogFilter {
  minLevel: LogLevel;
  /** Each term matches a node name or message text, case-insensitively; any term may match. */
  searchTerms: string[];
  /** Node names that are hidden. */
  hiddenNames: string[];
}

const rank = (level: LogLevel) => (level === 'UNKNOWN' ? 0 : LOG_LEVELS.indexOf(level) + 1);

const ROS2_LEVELS: Record<number, LogLevel> = {
  10: 'DEBUG',
  20: 'INFO',
  30: 'WARN',
  40: 'ERROR',
  50: 'FATAL',
};
const ROS1_LEVELS: Record<number, LogLevel> = {
  1: 'DEBUG',
  2: 'INFO',
  4: 'WARN',
  8: 'ERROR',
  16: 'FATAL',
};
const FOXGLOVE_LEVELS: Record<number, LogLevel> = {
  1: 'DEBUG',
  2: 'INFO',
  3: 'WARN',
  4: 'ERROR',
  5: 'FATAL',
};

type Time = { sec?: number; nanosec?: number; nsec?: number };
const seconds = (time?: Time) => (time?.sec ?? 0) + (time?.nanosec ?? time?.nsec ?? 0) / 1e9;
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** A log entry from any supported message, or null when the message is not a log. */
export function toLogEntry(message: unknown, id: number): LogEntry | null {
  if (!message || typeof message !== 'object') return null;
  const m = message as Record<string, unknown>;
  const level = Number(m.level);
  if ('message' in m) {
    // foxglove.Log
    return {
      id,
      stamp: seconds(m.timestamp as Time),
      level: FOXGLOVE_LEVELS[level] ?? 'UNKNOWN',
      name: text(m.name),
      message: text(m.message),
      file: text(m.file),
      line: Number(m.line) || 0,
      fn: '',
    };
  }
  if (!('msg' in m)) return null;
  // ROS 1 messages carry a header; ROS 2 messages a top-level stamp.
  const ros1 = 'header' in m;
  return {
    id,
    stamp: seconds(ros1 ? (m.header as { stamp?: Time })?.stamp : (m.stamp as Time)),
    level: (ros1 ? ROS1_LEVELS : ROS2_LEVELS)[level] ?? 'UNKNOWN',
    name: text(m.name),
    message: text(m.msg),
    file: text(m.file),
    line: Number(m.line) || 0,
    fn: text(m.function),
  };
}

export function matchesLog(entry: LogEntry, filter: LogFilter): boolean {
  if (rank(entry.level) < rank(filter.minLevel) && entry.level !== 'UNKNOWN') return false;
  if (filter.hiddenNames.includes(entry.name)) return false;
  const terms = filter.searchTerms.map((term) => term.trim().toLowerCase()).filter(Boolean);
  if (!terms.length) return true;
  const name = entry.name.toLowerCase();
  const message = entry.message.toLowerCase();
  return terms.some((term) => name.includes(term) || message.includes(term));
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

/** Date, time and UTC offset of a stamp in the viewer's time zone. */
export function formatLogStamp(stamp: number): { date: string; time: string; zone: string } {
  const at = new Date(stamp * 1000);
  const offset = -at.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}.${pad(at.getMilliseconds(), 3)}`,
    zone: `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`,
  };
}
