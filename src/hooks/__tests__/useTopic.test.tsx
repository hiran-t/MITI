import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useTopic } from '../useTopic';
import { PanelVisibleContext } from '../usePanelVisible';
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

test('a hidden panel keeps only the newest message and shows it when visible again', () => {
  let receive: (message: unknown) => void = () => {};
  const client = {
    subscribe: jest.fn((_topic: string, callback: (message: unknown) => void) => {
      receive = callback;
    }),
    unsubscribe: jest.fn(),
  } as unknown as BridgeClient;
  let visible = false;
  let renders = 0;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PanelVisibleContext.Provider value={visible}>{children}</PanelVisibleContext.Provider>
  );
  const hook = renderHook(
    () => {
      renders += 1;
      return useTopic(client, '/a');
    },
    { wrapper }
  );
  const rendersWhileHidden = renders;
  act(() => {
    receive({ n: 1 });
    receive({ n: 2 });
  });
  expect(hook.result.current.data).toBeNull();
  expect(renders).toBe(rendersWhileHidden);
  visible = true;
  hook.rerender();
  expect(hook.result.current.data).toEqual({ n: 2 });
  expect(client.subscribe).toHaveBeenCalledTimes(1);
});
