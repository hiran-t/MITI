import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import WidgetContainer from '../WidgetContainer';
import type { WidgetConfig } from '@/types/widget';

jest.mock('../../visualization/urdf/URDFViewer', () => () => null);
jest.mock('../../visualization/pointcloud/PointCloudViewer', () => () => null);
jest.mock('../../visualization/state-machine/StateMachineMonitor', () => () => null);

function Harness() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    {
      i: 'a',
      title: 'Camera A',
      type: 'camera-viewer',
      x: 0,
      y: 0,
      w: 4,
      h: 8,
      props: { topic: '/a' },
    },
    {
      i: 'b',
      title: 'Camera B',
      type: 'camera-viewer',
      x: 4,
      y: 0,
      w: 4,
      h: 8,
      props: { topic: '/b' },
    },
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return (
    <>
      <button onClick={() => setSelected('a')}>Select A</button>
      <button onClick={() => setSelected('b')}>Select B</button>
      <button onClick={() => setSelected(null)}>Close inspector</button>
      {widgets.map((widget) => (
        <section key={widget.i} aria-label={widget.title}>
          <WidgetContainer
            widget={widget}
            client={null}
            topics={[]}
            topicsLoading={false}
            onRefreshTopics={jest.fn()}
            settingsTarget={selected === widget.i ? target : null}
            onCloseSettings={() => setSelected(null)}
            onUpdateWidget={(id, updates) =>
              setWidgets((prev) =>
                prev.map((item) =>
                  item.i === id ? ({ ...item, ...updates } as WidgetConfig) : item
                )
              )
            }
          />
        </section>
      ))}
      <aside aria-label="Inspector" ref={setTarget} />
    </>
  );
}

test('only selected camera settings appear in the sidebar; switching and editing preserves other viewers', () => {
  render(<Harness />);
  const inspector = screen.getByRole('complementary', { name: 'Inspector' });
  const originalA = screen.getByTitle('/a');
  fireEvent.click(screen.getByText('Select A'));
  expect(within(inspector).getAllByRole('textbox')).toHaveLength(1);
  expect(
    within(screen.getByRole('region', { name: 'Camera A' })).queryByRole('textbox')
  ).toBeNull();
  fireEvent.change(within(inspector).getByRole('textbox', { name: 'Image Topic' }), {
    target: { value: '/a-new' },
  });
  expect(screen.getByTitle('/a-new')).toBe(originalA);
  expect(within(inspector).getByRole('textbox', { name: 'Image Topic' })).toHaveValue('/a-new');
  expect(within(inspector).queryByText('Apply')).toBeNull();
  fireEvent.click(screen.getByText('Select B'));
  expect(within(inspector).getByRole('textbox', { name: 'Image Topic' })).toHaveValue('/b');
  fireEvent.change(within(inspector).getByRole('textbox', { name: 'Image Topic' }), {
    target: { value: '/b-new' },
  });
  expect(within(inspector).getByRole('textbox', { name: 'Image Topic' })).toHaveValue('/b-new');
  expect(screen.getByTitle('/a-new')).toBe(originalA);
  expect(screen.getByTitle('/b-new')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Select A'));
  expect(within(inspector).getByRole('textbox', { name: 'Image Topic' })).toHaveValue('/a-new');
  fireEvent.click(within(inspector).getByText('Depth Image'));
  expect(screen.getByTitle('/camera/depth/image_raw')).toBe(originalA);
  expect(screen.getByTitle('/b-new')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Close inspector'));
  expect(screen.getByTitle('/camera/depth/image_raw')).toBe(originalA);
});
