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
  mosaic: { direction: 'row', first: 'log-1', second: 'det-1' },
};

test('a saved layout reads back the same, listing only the widgets it uses', () => {
  const read = layoutFromFile(layoutToFile(layout, installed));
  expect(read.layout).toEqual(layout);
  expect(read.widgets).toEqual([{ id: 'acme.vision', name: 'Acme Vision', version: '1.2.0' }]);
  expect(missingWidgets(read.widgets, [])).toEqual(read.widgets);
  expect(missingWidgets(read.widgets, installed)).toEqual([]);
});

test('says what is wrong with a file that is not a layout', () => {
  expect(() => layoutFromFile('{')).toThrow('not JSON');
  expect(() => layoutFromFile(JSON.stringify(DEFAULT_LAYOUT))).toThrow('not a MITI layout');
  expect(() =>
    layoutFromFile(JSON.stringify({ miti: 'layout', version: 2, layout: DEFAULT_LAYOUT }))
  ).toThrow('version 2');
});
