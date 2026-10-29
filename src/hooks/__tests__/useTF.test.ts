import { act, renderHook } from '@testing-library/react';
import { Vector3 } from 'three';
import { useTF } from '../useTF';
import { lookupTransform } from '@/lib/scene/transforms';
import type { BridgeClient } from '@/lib/bridge/client';
test('static transforms survive age cleanup and cleanup unsubscribes only its own callbacks', () => {
  jest.useFakeTimers();
  const callbacks = new Map<string, (message: unknown) => void>();
  const client = {
    subscribe: jest.fn((topic: string, cb: (message: unknown) => void) => callbacks.set(topic, cb)),
    unsubscribe: jest.fn(),
  } as unknown as BridgeClient;
  const { result, unmount } = renderHook(() => useTF({ client, maxAge: 1000 }));
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

test('the TF tree is only republished when frames change', () => {
  jest.useFakeTimers();
  const callbacks = new Map<string, (message: unknown) => void>();
  const client = {
    subscribe: jest.fn((topic: string, cb: (message: unknown) => void) => callbacks.set(topic, cb)),
    unsubscribe: jest.fn(),
  } as unknown as BridgeClient;
  const { result } = renderHook(() => useTF({ client }));
  act(() => {
    callbacks.get('/tf')!({
      transforms: [
        {
          header: { frame_id: 'map', stamp: { sec: 1, nanosec: 0 } },
          child_frame_id: 'robot',
          transform: { translation: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
        },
      ],
    });
    jest.advanceTimersByTime(100);
  });
  const tree = result.current.tfTree;
  expect(tree.frames.has('robot')).toBe(true);
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(result.current.tfTree).toBe(tree);
  jest.useRealTimers();
});

test('the TF tree follows each TF message within an animation frame, not on a 100 ms tick', () => {
  jest.useFakeTimers();
  const callbacks = new Map<string, (message: unknown) => void>();
  const client = {
    subscribe: jest.fn((topic: string, cb: (message: unknown) => void) => callbacks.set(topic, cb)),
    unsubscribe: jest.fn(),
  } as unknown as BridgeClient;
  const { result } = renderHook(() => useTF({ client }));
  const send = (x: number, sec: number) =>
    act(() => {
      callbacks.get('/tf')!({
        transforms: [
          {
            header: { frame_id: 'odom', stamp: { sec, nanosec: 0 } },
            child_frame_id: 'pelvis',
            transform: { translation: { x, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
          },
        ],
      });
      jest.advanceTimersByTime(33);
    });
  const seen: number[] = [];
  for (let i = 1; i <= 3; i++) {
    send(i, i);
    seen.push(result.current.tfTree.frames.get('pelvis')!.transform.translation.x);
  }
  expect(seen).toEqual([1, 2, 3]);
  jest.useRealTimers();
});

test('TF history reaches back far enough to place data that arrives seconds late', () => {
  jest.useFakeTimers();
  const callbacks = new Map<string, (message: unknown) => void>();
  const client = {
    subscribe: jest.fn((topic: string, cb: (message: unknown) => void) => callbacks.set(topic, cb)),
    unsubscribe: jest.fn(),
  } as unknown as BridgeClient;
  const { result } = renderHook(() => useTF({ client }));
  // 50 s of odom → pelvis at 20 Hz; x equals the stamp in seconds.
  act(() => {
    for (let i = 0; i <= 1000; i++) {
      const stamp = i * 0.05;
      callbacks.get('/tf')!({
        transforms: [
          {
            header: {
              frame_id: 'odom',
              stamp: { sec: Math.floor(stamp), nanosec: Math.round((stamp % 1) * 1e9) },
            },
            child_frame_id: 'pelvis',
            transform: {
              translation: { x: stamp, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
            },
          },
        ],
      });
    }
    jest.advanceTimersByTime(20);
  });
  const x = (time: number) =>
    new Vector3().setFromMatrixPosition(
      lookupTransform(result.current.tfTree, 'odom', 'pelvis', time)
    ).x;
  expect(x(30)).toBeCloseTo(30, 5); // 20 s behind the newest transform
  expect(() => x(10)).toThrow('TF history unavailable');
  jest.useRealTimers();
});
