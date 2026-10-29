import { act, renderHook } from '@testing-library/react';
import { useTopic } from '../useTopic';
import type { BridgeClient } from '@/lib/bridge/client';

test('changing a widget source clears old data and unsubscribes only its callback', () => {
  let receive: (message: unknown) => void = () => {};
  const subscribe = jest.fn((_topic: string, callback: (message: unknown) => void) => {
    receive = callback;
  });
  const unsubscribe = jest.fn();
  const client = { subscribe, unsubscribe } as unknown as BridgeClient;
  const hook = renderHook(({ topic }) => useTopic(client, topic), {
    initialProps: { topic: '/a' },
  });
  const oldCallback = receive;
  act(() => receive({ data: 'old' }));
  expect(hook.result.current.data).toEqual({ data: 'old' });
  hook.rerender({ topic: '/b' });
  expect(unsubscribe).toHaveBeenCalledWith('/a', oldCallback);
  expect(hook.result.current.data).toBeNull();
  expect(hook.result.current.lastUpdate).toBeNull();
  act(() => receive({ data: 'new' }));
  expect(hook.result.current.data).toEqual({ data: 'new' });
});
