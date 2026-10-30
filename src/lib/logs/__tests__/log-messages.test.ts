import { formatLogStamp, matchesLog, toLogEntry, type LogEntry } from '../log-messages';

const ros2 = (level: number, name: string, msg: string) => ({
  stamp: { sec: 12, nanosec: 500000000 },
  level,
  name,
  msg,
  file: '/ws/src/node.cpp',
  function: 'tick',
  line: 42,
});

test('ROS 2, ROS 1 and Foxglove log messages are normalised', () => {
  expect(toLogEntry(ros2(30, 'pickplace_state_machine', 'gripper slow'), 1)).toEqual({
    id: 1,
    stamp: 12.5,
    level: 'WARN',
    name: 'pickplace_state_machine',
    message: 'gripper slow',
    file: '/ws/src/node.cpp',
    line: 42,
    fn: 'tick',
  });
  expect(
    toLogEntry({ header: { stamp: { sec: 3, nsec: 0 } }, level: 8, name: '/n', msg: 'x' }, 2)
  ).toMatchObject({ stamp: 3, level: 'ERROR', message: 'x' });
  expect(
    toLogEntry({ timestamp: { sec: 1, nsec: 0 }, level: 5, name: 'n', message: 'boom' }, 3)
  ).toMatchObject({ level: 'FATAL', message: 'boom' });
  expect(toLogEntry({ data: 'not a log' }, 4)).toBeNull();
  expect(toLogEntry(ros2(99, 'n', 'odd'), 5)?.level).toBe('UNKNOWN');
});

test('filters by minimum level, hidden nodes and search terms on name or message', () => {
  const logs = [
    ros2(10, 'planner', 'debug detail'),
    ros2(20, 'pickplace_state_machine', 'state PICK'),
    ros2(30, 'controller', 'gripper slow'),
    ros2(40, 'pickplace_state_machine', 'grasp failed'),
  ].map((m, i) => toLogEntry(m, i) as LogEntry);
  const shown = (filter: Partial<Parameters<typeof matchesLog>[1]>) =>
    logs
      .filter((log) =>
        matchesLog(log, { minLevel: 'DEBUG', searchTerms: [], hiddenNames: [], ...filter })
      )
      .map((log) => log.message);
  expect(shown({ minLevel: 'WARN' })).toEqual(['gripper slow', 'grasp failed']);
  expect(shown({ searchTerms: ['pickplace'] })).toEqual(['state PICK', 'grasp failed']);
  expect(shown({ searchTerms: ['GRIPPER', 'detail'] })).toEqual(['debug detail', 'gripper slow']);
  expect(shown({ hiddenNames: ['pickplace_state_machine'] })).toEqual([
    'debug detail',
    'gripper slow',
  ]);
});

test('stamps format as local date, time with milliseconds and UTC offset', () => {
  const { date, time, zone } = formatLogStamp(0.25);
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(time).toMatch(/^\d{2}:\d{2}:\d{2}\.250$/);
  expect(zone).toMatch(/^[+-]\d{2}:\d{2}$/);
});
