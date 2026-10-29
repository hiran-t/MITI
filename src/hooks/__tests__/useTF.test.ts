import { act, renderHook } from '@testing-library/react';
import { useTF } from '../useTF';
import type { ROSBridge } from '@/lib/rosbridge/client';
test('static transforms survive age cleanup and cleanup unsubscribes only its own callbacks', () => {
  jest.useFakeTimers();
  const callbacks = new Map<string, (message: unknown) => void>();
  const client = {
    subscribe: jest.fn((topic: string, cb: (message: unknown) => void) => callbacks.set(topic, cb)),
    unsubscribe: jest.fn(),
  } as unknown as ROSBridge;
  const { result, unmount } = renderHook(() => useTF({ rosbridgeClient: client, maxAge: 1000 }));
  const packet = {
    transforms: [
      {
        header: { frame_id: 'map', stamp: { sec: 1, nanosec: 0 } },
        child_frame_id: 'camera',
        transform: { translation: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      },
    ],
  };
  act(() => {
    callbacks.get('/tf_static')!(packet);
    callbacks.get('/tf')!({
      ...packet,
      transforms: [{ ...packet.transforms[0], child_frame_id: 'robot' }],
    });
    jest.advanceTimersByTime(2000);
  });
  expect(result.current.tfTree.frames.has('camera')).toBe(true);
  expect(result.current.tfTree.frames.has('robot')).toBe(false);
  unmount();
  expect(client.unsubscribe).toHaveBeenCalledWith('/tf_static', callbacks.get('/tf_static'));
  expect(client.unsubscribe).toHaveBeenCalledWith('/tf', callbacks.get('/tf'));
  jest.useRealTimers();
});
