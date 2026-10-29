import { fireEvent, render, screen } from '@testing-library/react';
import DraggableGridLayout from '../DraggableGridLayout';
import type { WidgetConfig } from '@/types/widget';
import { DEFAULT_LAYOUT } from '@/types/widget';

jest.mock(
  'next/dynamic',
  () => () =>
    function Grid({ children, layout }: { children: React.ReactNode; layout: unknown }) {
      return (
        <div data-testid="grid" data-layout={JSON.stringify(layout)}>
          {children}
        </div>
      );
    }
);
jest.mock(
  '../WidgetContainer',
  () =>
    function Content() {
      return <div>Viewer content</div>;
    }
);
beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  global.ResizeObserver = jest
    .fn()
    .mockImplementation(() => ({ observe: jest.fn(), disconnect: jest.fn() }));
});

function renderGrid(widgets: WidgetConfig[], changed = jest.fn()) {
  render(
    <DraggableGridLayout
      widgets={widgets}
      onLayoutChange={changed}
      onRemoveWidget={jest.fn()}
      onToggleLock={jest.fn()}
      client={null}
      topics={[]}
      topicsLoading={false}
      onRefreshTopics={jest.fn()}
      selectedWidgetId={null}
      onSelectWidget={jest.fn()}
      settingsTarget={null}
      onCloseSettings={jest.fn()}
      onUpdateWidget={jest.fn()}
    />
  );
  return changed;
}

test('expand and Escape preserve panel content and never persist layout changes', () => {
  const changed = renderGrid(DEFAULT_LAYOUT.widgets.slice(0, 1));
  const content = screen.getByText('Viewer content');
  fireEvent.click(screen.getByRole('button', { name: 'Expand 3D Scene' }));
  expect(screen.getByRole('region')).toHaveClass('panel-expanded');
  expect(screen.getByText('Viewer content')).toBe(content);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('region')).not.toHaveClass('panel-expanded');
  expect(changed).not.toHaveBeenCalled();
});

test('mobile stacks panels of different heights without overlap or changing saved geometry', () => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  const saved = JSON.stringify(DEFAULT_LAYOUT);
  const changed = renderGrid(DEFAULT_LAYOUT.widgets);
  const displayed = JSON.parse(screen.getByTestId('grid').getAttribute('data-layout')!);
  expect(displayed[0].y).toBe(0);
  displayed.forEach((panel: { x: number; w: number; y: number }, index: number) => {
    expect(panel.x).toBe(0);
    expect(panel.w).toBe(12);
    if (index > 0) expect(panel.y).toBe(displayed[index - 1].y + displayed[index - 1].h);
  });
  expect(JSON.stringify(DEFAULT_LAYOUT)).toBe(saved);
  expect(changed).not.toHaveBeenCalled();
});
