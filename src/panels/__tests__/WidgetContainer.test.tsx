import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WidgetContainer from '@/components/features/layout/WidgetContainer';
import { registerPanels, unregisterPanels } from '@/panels';
import type { WidgetConfig } from '@/types/widget';

function Harness({ initial }: { initial: WidgetConfig[] }) {
  const [widgets, setWidgets] = useState(initial);
  return (
    <>
      {widgets.map((widget) => (
        <section key={widget.i} aria-label={widget.title}>
          <WidgetContainer
            widget={widget}
            client={null}
            topics={[]}
            topicsLoading={false}
            onRefreshTopics={jest.fn()}
            settingsTarget={null}
            onCloseSettings={jest.fn()}
            onUpdateWidget={(id, updates) =>
              setWidgets((all) => all.map((w) => (w.i === id ? { ...w, ...updates } : w)))
            }
          />
        </section>
      ))}
      <pre data-testid="saved">{JSON.stringify(widgets.map((w) => w.props))}</pre>
    </>
  );
}

const base = { x: 0, y: 0, w: 4, h: 4 };

afterEach(() => unregisterPanels('acme'));

test('a panel that throws shows its error and can be reloaded; other panels keep running', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  let fail = true;
  function Fragile() {
    if (fail) throw new Error('no detections topic');
    return <p>Working again</p>;
  }
  registerPanels('acme', [
    { type: 'acme/fragile', label: 'Fragile', component: Fragile },
    { type: 'acme/steady', label: 'Steady', component: () => <p>Steady output</p> },
  ]);
  render(
    <Harness
      initial={[
        { ...base, i: 'a', title: 'Fragile', type: 'acme/fragile' },
        { ...base, i: 'b', title: 'Steady', type: 'acme/steady' },
      ]}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('no detections topic');
  expect(screen.getByText('Steady output')).toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Reload panel' }));
  expect(screen.getByText('Working again')).toBeInTheDocument();
  error.mockRestore();
});
