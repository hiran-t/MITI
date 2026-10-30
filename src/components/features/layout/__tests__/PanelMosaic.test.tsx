import { fireEvent, render, screen } from '@testing-library/react';
import PanelMosaic from '../PanelMosaic';
import { DEFAULT_LAYOUT } from '@/types/widget';

jest.mock(
  '../WidgetContainer',
  () =>
    function Content({ widget }: { widget: { title: string } }) {
      return <div>Content of {widget.title}</div>;
    }
);

function renderMosaic(changed = jest.fn(), select = jest.fn(), remove = jest.fn()) {
  render(
    <PanelMosaic
      widgets={DEFAULT_LAYOUT.widgets}
      mosaic={DEFAULT_LAYOUT.mosaic ?? null}
      onMosaicChange={changed}
      onRemoveWidget={remove}
      onToggleLock={jest.fn()}
      client={null}
      topics={[]}
      topicsLoading={false}
      onRefreshTopics={jest.fn()}
      selectedWidgetId={null}
      onSelectWidget={select}
      settingsTarget={null}
      onCloseSettings={jest.fn()}
      onUpdateWidget={jest.fn()}
    />
  );
  return { changed, select, remove };
}

test('tiles every panel of the split tree', () => {
  renderMosaic();
  for (const widget of DEFAULT_LAYOUT.widgets)
    expect(screen.getByRole('region', { name: widget.title })).toHaveTextContent(widget.title);
});

test('expand and Escape keep panel content mounted and never change the layout', () => {
  const { changed } = renderMosaic();
  const content = screen.getByText('Content of 3D Scene');
  fireEvent.click(screen.getByRole('button', { name: 'Expand 3D Scene' }));
  expect(content.closest('.mosaic-window')).toHaveClass('panel-expanded');
  expect(screen.getByText('Content of 3D Scene')).toBe(content);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(content.closest('.mosaic-window')).not.toHaveClass('panel-expanded');
  expect(changed).not.toHaveBeenCalled();
});

test('header buttons select and remove panels', () => {
  const { select, remove } = renderMosaic();
  fireEvent.click(screen.getByRole('button', { name: 'Settings for Camera · Depth' }));
  expect(select).toHaveBeenCalledWith('camera-viewer-2');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Camera · Depth' }));
  expect(remove).toHaveBeenCalledWith('camera-viewer-2');
});
