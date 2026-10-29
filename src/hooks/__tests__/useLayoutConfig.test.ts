import { act, renderHook } from '@testing-library/react';
import { normalizeLayout, useLayoutConfig } from '../useLayoutConfig';
import { DEFAULT_LAYOUT } from '@/types/widget';

const key = 'miti_layout_config';
beforeEach(() => localStorage.clear());

test('loads saved layout before any storage write and preserves custom topics', () => {
  const saved = {
    widgets: [
      {
        i: 'custom-camera',
        type: 'camera-viewer',
        title: 'Inspection',
        x: 4,
        y: 2,
        w: 5,
        h: 9,
        props: { topic: '/custom/image' },
      },
    ],
  };
  localStorage.setItem(key, JSON.stringify(saved));
  const spy = jest.spyOn(Storage.prototype, 'setItem');
  const { result } = renderHook(() => useLayoutConfig());
  expect(result.current.layout.widgets[0]).toMatchObject(saved.widgets[0]);
  expect(
    spy.mock.calls
      .filter(([name]) => name === key)
      .every(([, value]) => JSON.parse(value).widgets[0].i === 'custom-camera')
  ).toBe(true);
  act(() => result.current.toggleLock('custom-camera'));
  expect(JSON.parse(localStorage.getItem(key)!).widgets[0].locked).toBe(true);
  spy.mockRestore();
});

test('clamps legacy geometry without losing topics or titles', () => {
  const layout = normalizeLayout({
    widgets: [
      {
        i: 'topics-1',
        type: 'topics',
        title: 'My topics',
        x: 50,
        y: -1,
        w: 1223,
        h: 2,
        locked: true,
      },
    ],
  });
  expect(layout.widgets[0]).toMatchObject({
    x: 0,
    y: 0,
    w: 12,
    h: 2,
    title: 'My topics',
    locked: true,
  });
});

test('empty saved layout stays empty; reset restores the new default', () => {
  localStorage.setItem(key, JSON.stringify({ widgets: [] }));
  const { result } = renderHook(() => useLayoutConfig());
  expect(result.current.layout.widgets).toEqual([]);
  act(() => result.current.resetLayout());
  expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
});

test('new panels are placed below all existing panels without overwriting them', () => {
  const { result } = renderHook(() => useLayoutConfig());
  act(() => result.current.addWidget('topics'));
  expect(result.current.layout.widgets.at(-1)).toMatchObject({ type: 'topics', y: 18 });
});

test('migrates shared URDF settings to independent widgets and keeps later edits isolated', () => {
  const scene = DEFAULT_LAYOUT.widgets[0];
  localStorage.setItem(key, JSON.stringify({ widgets: [scene, { ...scene, i: 'scene-b' }] }));
  localStorage.setItem(
    'miti_urdf_config',
    JSON.stringify({ topic: '/legacy/robot', mode: 'topic' })
  );
  const first = renderHook(() => useLayoutConfig());
  expect(first.result.current.layout.widgets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        i: scene.i,
        props: expect.objectContaining({ topic: '/legacy/robot' }),
      }),
      expect.objectContaining({
        i: 'scene-b',
        props: expect.objectContaining({ topic: '/legacy/robot' }),
      }),
    ])
  );
  act(() =>
    first.result.current.updateWidget(scene.i, {
      props: {
        mode: 'topic',
        topic: '/robot_a',
        urdfUrl: '',
        meshBaseUrl: '',
        packageMapping: {},
        showTF: false,
      },
    })
  );
  first.unmount();
  const restored = renderHook(() => useLayoutConfig());
  expect(restored.result.current.layout.widgets[0]).toMatchObject({
    props: { topic: '/robot_a', showTF: false },
  });
  expect(restored.result.current.layout.widgets[1]).toMatchObject({
    props: { topic: '/legacy/robot' },
  });
  expect(JSON.parse(localStorage.getItem('miti_urdf_config')!).topic).toBe('/legacy/robot');
});
