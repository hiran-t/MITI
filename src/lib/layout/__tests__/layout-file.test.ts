import { DEFAULT_LAYOUT, type LayoutConfig } from '@/types/widget';
import { layoutFromFile, layoutToFile, missingWidgets } from '../layout-file';

const installed = [
  { id: 'acme.vision', name: 'Acme Vision', version: '1.2.0' },
  { id: 'acme.unused', name: 'Unused', version: '0.1.0' },
];
const layout: LayoutConfig = {
  widgets: [
    { i: 'log-1', type: 'log', title: 'Log', x: 0, y: 0, w: 4, h: 4, minW: 1, minH: 1 },
    {
      i: 'det-1',
      type: 'acme.vision/detections',
      title: 'Detections',
      x: 4,
      y: 0,
      w: 4,
      h: 4,
      minW: 1,
      minH: 1,
      props: { topic: '/det' },
    },
  ],
  mosaic: {
    type: 'split',
    direction: 'row',
    children: ['log-1', 'det-1'],
    splitPercentages: [40, 60],
  },
};

test('a saved layout reads back the same, listing only the widgets it uses', () => {
  const text = layoutToFile(layout, installed);
  expect(JSON.parse(text)).toMatchObject({ miti: 'layout', version: 2 });
  const read = layoutFromFile(text);
  expect(read.layout).toEqual(layout);
  expect(read.widgets).toEqual([{ id: 'acme.vision', name: 'Acme Vision', version: '1.2.0' }]);
  expect(missingWidgets(read.widgets, [])).toEqual(read.widgets);
  expect(missingWidgets(read.widgets, installed)).toEqual([]);
});

test('a version 1 file from MITI 3.4.5 opens with its binary tree converted', () => {
  const file = {
    miti: 'layout',
    version: 1,
    layout: {
      widgets: layout.widgets,
      mosaic: { direction: 'row', first: 'log-1', second: 'det-1', splitPercentage: 40 },
    },
    widgets: [{ id: 'acme.vision', name: 'Acme Vision', version: '1.2.0' }],
  };
  const read = layoutFromFile(JSON.stringify(file, null, 2));
  expect(read.layout).toEqual(layout);
  expect(read.widgets).toEqual(file.widgets);
  // Saved again, it is a version 2 file.
  expect(JSON.parse(layoutToFile(read.layout, installed))).toMatchObject({
    version: 2,
    layout: { mosaic: layout.mosaic },
  });
});

test('says what is wrong with a file that is not a layout', () => {
  expect(() => layoutFromFile('{')).toThrow('not JSON');
  expect(() => layoutFromFile(JSON.stringify(DEFAULT_LAYOUT))).toThrow('not a MITI layout');
  expect(() =>
    layoutFromFile(JSON.stringify({ miti: 'layout', version: 3, layout: DEFAULT_LAYOUT }))
  ).toThrow('The layout is version 3; this MITI reads versions 1 to 2');
});
