import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import WidgetContainer from '@/components/features/layout/WidgetContainer';
import { definePanel, defineWidget, type PanelProps } from '@/sdk';
import { readWidgetManifest, refreshWidgets, removeWidget } from '../loader';
import type { WidgetConfig } from '@/types/widget';

function Layout({ initial }: { initial: WidgetConfig[] }) {
  const [widgets, setWidgets] = useState(initial);
  return (
    <>
      {widgets.map((widget) => (
        <WidgetContainer
          key={widget.i}
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
      ))}
      <pre data-testid="saved">{JSON.stringify(widgets.map((w) => w.props))}</pre>
    </>
  );
}

function Gauge({ config, updateConfig }: PanelProps<{ topic: string; max?: number }>) {
  return (
    <button onClick={() => updateConfig({ max: 5 })}>
      {config.topic} up to {config.max ?? '?'}
    </button>
  );
}

const acme = {
  id: 'acme',
  name: 'Acme Gauges',
  version: '1.0.0',
  main: 'index.js',
  miti: { apiVersion: 1 },
  installedAt: 5,
};

let listing: unknown;
beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => listing })) as jest.Mock;
});

test('a widget panel waits for the widget, keeps its settings while it is missing, and works once imported', async () => {
  render(
    <Layout
      initial={[
        {
          i: 'g',
          title: 'Gauge',
          type: 'acme/gauge',
          x: 0,
          y: 0,
          w: 4,
          h: 4,
          props: { topic: '/battery' },
        },
      ]}
    />
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading the widget acme');

  listing = { importAllowed: true, widgets: [], problems: [] };
  await act(() => refreshWidgets(jest.fn()));
  expect(screen.getByText('Widget not installed')).toBeInTheDocument();

  listing = { importAllowed: true, widgets: [acme], problems: [] };
  const importModule = jest.fn(async () => ({
    default: defineWidget({
      panels: [
        definePanel({
          type: 'acme/gauge',
          label: 'Gauge',
          component: Gauge,
          normalizeConfig: (stored) => ({ topic: '/default', ...(stored as object) }),
        }),
      ],
    }),
  }));
  await act(() => refreshWidgets(importModule));
  expect(importModule).toHaveBeenCalledWith('/api/widgets/files/acme/1.0.0/index.js?t=5');
  fireEvent.click(screen.getByRole('button', { name: '/battery up to ?' }));
  expect(screen.getByRole('button', { name: '/battery up to 5' })).toBeInTheDocument();
  expect(screen.getByTestId('saved')).toHaveTextContent('[{"topic":"/battery","max":5}]');

  // Listing again loads nothing new; removing the widget leaves the panel's settings in place.
  await act(() => refreshWidgets(importModule));
  expect(importModule).toHaveBeenCalledTimes(1);
  await act(() => removeWidget('acme'));
  expect(screen.getByText('Widget not installed')).toBeInTheDocument();
  expect(screen.getByTestId('saved')).toHaveTextContent('[{"topic":"/battery","max":5}]');
});

test('a widget whose code fails shows why in its panels', async () => {
  listing = { importAllowed: true, widgets: [{ ...acme, installedAt: 6 }], problems: [] };
  render(
    <Layout initial={[{ i: 'g', title: 'Gauge', type: 'acme/gauge', x: 0, y: 0, w: 4, h: 4 }]} />
  );
  await act(() => refreshWidgets(async () => ({ default: {} })));
  expect(screen.getByText('Widget failed to load')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'index.js must export default defineWidget({ panels: [...] })'
  );

  await act(() =>
    refreshWidgets(async () => ({
      default: { panels: [{ type: 'other/gauge', label: 'Gauge', component: Gauge }] },
    }))
  );
  expect(screen.getByRole('status')).toHaveTextContent('must start with "acme/"');
});

test('reads the manifest of a package before it is imported', async () => {
  const file = (entries: Record<string, string>) =>
    new Blob([
      zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)]))),
    ]);
  await expect(
    readWidgetManifest(file({ 'manifest.json': JSON.stringify(acme), 'index.js': '' }))
  ).resolves.toMatchObject({ id: 'acme', name: 'Acme Gauges', version: '1.0.0' });
  await expect(readWidgetManifest(new Blob(['not a zip']))).rejects.toThrow('not a widget package');
  await expect(
    readWidgetManifest(file({ 'manifest.json': JSON.stringify({ ...acme, id: 'A' }) }))
  ).rejects.toThrow('manifest.json: "id" must be lowercase');
});
