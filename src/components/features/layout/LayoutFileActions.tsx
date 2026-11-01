'use client';

import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import type { LayoutConfig } from '@/types/widget';
import { layoutFromFile, layoutToFile, missingWidgets } from '@/lib/layout/layout-file';
import { useWidgets } from '@/panels/loader';

/**
 * Title bar buttons that save the layout as a file and open one, to move a layout to another
 * browser or deliver it with the widgets it needs.
 */
export default function LayoutFileActions({
  layout,
  onReplace,
}: {
  layout: LayoutConfig;
  onReplace: (layout: LayoutConfig) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { widgets } = useWidgets();

  const save = () => {
    const blob = new Blob([layoutToFile(layout, widgets)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `miti-layout-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const open = async (file: File) => {
    let read: ReturnType<typeof layoutFromFile>;
    try {
      read = layoutFromFile(await file.text());
    } catch (error) {
      window.alert(`Cannot open ${file.name}: ${(error as Error).message}.`);
      return;
    }
    const missing = missingWidgets(read.widgets, widgets);
    const needs = missing.length
      ? `\n\nIt uses widgets this MITI does not have; import them under Widgets to show their ` +
        `panels: ${missing.map((w) => `${w.name} ${w.version} (${w.id})`).join(', ')}.`
      : '';
    if (
      window.confirm(
        `Replace the current layout with ${file.name} (${read.layout.widgets.length} panels)?` +
          needs
      )
    )
      onReplace(read.layout);
  };

  return (
    <>
      <button
        aria-label="Export layout"
        title="Export layout to a file"
        className="workspace-icon"
        onClick={save}
      >
        <Download size={15} strokeWidth={1.75} />
      </button>
      <button
        aria-label="Import layout"
        title="Import layout from a file"
        className="workspace-icon"
        onClick={() => input.current?.click()}
      >
        <Upload size={15} strokeWidth={1.75} />
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-label="Layout file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) open(file);
        }}
      />
    </>
  );
}
