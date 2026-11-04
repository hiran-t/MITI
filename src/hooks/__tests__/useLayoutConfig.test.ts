import { act, renderHook } from '@testing-library/react';
import { normalizeLayout, useLayoutConfig } from '../useLayoutConfig';
import { DEFAULT_LAYOUT } from '@/types/widget';
import { registerPanels, unregisterPanels } from '@/panels';

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
    type: 'split',
    direction: 'row',
    children: ['left', 'right'],
    splitPercentages: [50, 50],
  });
  act(() => result.current.addWidget('log', 'right'));
  expect(result.current.layout.widgets.at(-1)).toMatchObject({ i: 'log-1', type: 'log' });
  expect(result.current.layout.mosaic).toMatchObject({
    children: ['left', { type: 'split', direction: 'row', children: ['right', 'log-1'] }],
  });
  act(() => result.current.removeWidget('left'));
  expect(result.current.layout.mosaic).toEqual({
    type: 'split',
    direction: 'row',
    children: ['right', 'log-1'],
    splitPercentages: [50, 50],
  });
  const moved = {
    type: 'split' as const,
    direction: 'column' as const,
    children: ['log-1', 'right'],
    splitPercentages: [35, 65],
  };
  act(() => result.current.updateMosaic(moved));
  expect(JSON.parse(localStorage.getItem(key)!).mosaic).toEqual(moved);
});

test('a layout saved by MITI 3.4.5 opens unchanged and is saved back as an n-ary tree', () => {
  const widgets = ['scene', 'log', 'cam'].map((i) => ({
    i,
    type: 'topics',
    title: i,
    x: 0,
    y: 0,
    w: 4,
    h: 8,
    minW: 1,
    minH: 1,
  }));
  localStorage.setItem(
    key,
    JSON.stringify({
      widgets,
      mosaic: {
        direction: 'row',
        first: 'scene',
        second: { direction: 'column', first: 'log', second: 'cam', splitPercentage: 30 },
        splitPercentage: 64,
      },
    })
  );
  const { result } = renderHook(() => useLayoutConfig());
  const nary = {
    type: 'split',
    direction: 'row',
    children: [
      'scene',
      { type: 'split', direction: 'column', children: ['log', 'cam'], splitPercentages: [30, 70] },
    ],
    splitPercentages: [64, 36],
  };
  expect(result.current.layout).toEqual({ widgets, mosaic: nary });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ widgets, mosaic: nary });
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

test("keeps panels of widgets that are not installed, and adds a widget's panel with its defaults", () => {
  const layout = normalizeLayout({
    widgets: [
      { i: 'g', type: 'acme.vision/detections', title: 'Detections', props: { topic: '/det' } },
      { i: 'x', type: '', title: 'No type' },
    ],
  });
  expect(layout.widgets).toEqual([
    expect.objectContaining({ i: 'g', type: 'acme.vision/detections', props: { topic: '/det' } }),
  ]);

  registerPanels('acme.vision', [
    {
      type: 'acme.vision/detections',
      label: 'Detections',
      component: () => null,
      defaultConfig: () => ({ topic: '/detections' }),
    },
  ]);
  localStorage.setItem(key, JSON.stringify({ widgets: [] }));
  const { result } = renderHook(() => useLayoutConfig());
  act(() => result.current.addWidget('acme.vision/detections'));
  expect(result.current.layout.widgets).toEqual([
    expect.objectContaining({
      i: 'acme-vision-detections-1',
      type: 'acme.vision/detections',
      title: 'Detections',
      props: { topic: '/detections' },
    }),
  ]);
  unregisterPanels('acme.vision');
});
