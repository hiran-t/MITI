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

test('a saved grid layout converts to splits; panels are added beside a panel and removed', () => {
  localStorage.setItem(
    key,
    JSON.stringify({
      widgets: [
        { i: 'left', type: 'topics', title: 'Left', x: 0, y: 0, w: 6, h: 8 },
        { i: 'right', type: 'topics', title: 'Right', x: 6, y: 0, w: 6, h: 8 },
      ],
    })
  );
  const { result } = renderHook(() => useLayoutConfig());
  expect(result.current.layout.mosaic).toEqual({
    direction: 'row',
    first: 'left',
    second: 'right',
    splitPercentage: 50,
  });
  act(() => result.current.addWidget('log', 'right'));
  expect(result.current.layout.widgets.at(-1)).toMatchObject({ i: 'log-1', type: 'log' });
  expect(result.current.layout.mosaic).toMatchObject({
    second: { direction: 'row', first: 'right', second: 'log-1' },
  });
  act(() => result.current.removeWidget('left'));
  expect(result.current.layout.mosaic).toEqual({
    direction: 'row',
    first: 'right',
    second: 'log-1',
    splitPercentage: 50,
  });
  act(() => result.current.updateMosaic({ direction: 'column', first: 'log-1', second: 'right' }));
  expect(JSON.parse(localStorage.getItem(key)!).mosaic).toEqual({
    direction: 'column',
    first: 'log-1',
    second: 'right',
  });
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
