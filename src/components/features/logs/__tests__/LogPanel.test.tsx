import { act, fireEvent, render, screen } from '@testing-library/react';
import LogPanel from '../LogPanel';
import type { BridgeClient } from '@/lib/bridge/client';
import type { LogWidgetProps } from '@/types/widget';

const log = (level: number, name: string, msg: string) => ({
  stamp: { sec: 100, nanosec: 0 },
  level,
  name,
  msg,
  file: 'node.cpp',
  function: 'run',
  line: 7,
});

function setup(props: LogWidgetProps = {}) {
  let receive: (message: unknown) => void = () => {};
  const client = {
    subscribe: jest.fn((_topic: string, callback: (message: unknown) => void) => {
      receive = callback;
    }),
    unsubscribe: jest.fn(),
  } as unknown as BridgeClient;
  const onConfigChange = jest.fn();
  const view = render(<LogPanel client={client} props={props} onConfigChange={onConfigChange} />);
  const send = (...messages: unknown[]) =>
    act(() => {
      messages.forEach((message) => receive(message));
      jest.advanceTimersByTime(200);
    });
  return { client, onConfigChange, send, view };
}

const rows = () => Array.from(document.querySelectorAll('.log-row')).map((row) => row.textContent);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('subscribes to /rosout and shows messages in batches with level and node name', () => {
  const { client, send } = setup();
  expect(client.subscribe).toHaveBeenCalledWith('/rosout', expect.any(Function));
  expect(screen.getByText('Waiting for messages on /rosout')).toBeInTheDocument();
  send(log(20, 'pickplace_state_machine', 'state PICK'), { data: 'not a log' });
  expect(rows()).toHaveLength(1);
  expect(rows()[0]).toContain('[INFO]');
  expect(rows()[0]).toContain('[pickplace_state_machine]:');
  expect(rows()[0]).toContain('state PICK');
});

test('filters by minimum level and by typed text, and Enter turns the text into a chip', () => {
  const { send, onConfigChange } = setup({ minLevel: 'INFO' });
  send(
    log(10, 'planner', 'debug detail'),
    log(30, 'controller', 'gripper slow'),
    log(20, 'a', 'ok')
  );
  expect(rows().map((row) => row?.includes('debug detail'))).not.toContain(true);
  expect(rows()).toHaveLength(2);
  const filter = screen.getByLabelText('Filter messages');
  fireEvent.change(filter, { target: { value: 'gripper' } });
  expect(rows()).toHaveLength(1);
  fireEvent.keyDown(filter, { key: 'Enter' });
  expect(onConfigChange).toHaveBeenCalledWith({ searchTerms: ['gripper'] });
});

test('chips and hidden node names from the settings apply, and chips can be removed', () => {
  const { send, onConfigChange } = setup({
    searchTerms: ['pickplace'],
    hiddenNames: ['controller'],
  });
  send(
    log(20, 'pickplace_state_machine', 'state PICK'),
    log(40, 'controller', 'pickplace aborted'),
    log(20, 'planner', 'plan ready')
  );
  expect(rows()).toHaveLength(1);
  expect(rows()[0]).toContain('state PICK');
  fireEvent.click(screen.getByLabelText('Remove filter pickplace'));
  expect(onConfigChange).toHaveBeenCalledWith({ searchTerms: [] });
});

test('copy writes the shown lines in their displayed format', () => {
  const writeText = jest.fn();
  Object.assign(navigator, { clipboard: { writeText } });
  const { send } = setup({ showTime: false, showSource: true });
  send(log(40, 'controller', 'grasp failed'));
  fireEvent.click(screen.getByLabelText('Copy shown logs'));
  expect(writeText).toHaveBeenCalledWith('[ERROR] [controller]: grasp failed (node.cpp:7)');
});
