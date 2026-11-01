'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { BUILTIN_SOURCE, usePanels, type RegisteredPanel } from '@/panels';
import PanelIcon from './PanelIcon';

export default function AddWidgetButton({ onAddWidget }: { onAddWidget: (type: string) => void }) {
  const panels = usePanels();
  const builtin = panels.filter((panel) => panel.source === BUILTIN_SOURCE);
  const fromWidgets = panels.filter((panel) => panel.source !== BUILTIN_SOURCE);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const item = ({ type, label, description }: RegisteredPanel) => (
    <button
      key={type}
      className="panel-picker-item"
      title={description}
      onClick={() => {
        onAddWidget(type);
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <PanelIcon type={type} />
      <span className="flex-1">{label}</span>
    </button>
  );
  return (
    <div className="relative" ref={container}>
      <button
        ref={trigger}
        className="workspace-icon"
        aria-label="Add panel"
        title="Add panel"
        aria-expanded={open}
        aria-controls="panel-picker"
        onClick={() => setOpen(!open)}
      >
        <Plus size={16} strokeWidth={1.75} />
      </button>
      {open && (
        <div id="panel-picker" className="panel-picker" aria-label="Add panel">
          <p className="panel-picker-heading">Add panel</p>
          {builtin.map(item)}
          {fromWidgets.length > 0 && <p className="panel-picker-heading">Widgets</p>}
          {fromWidgets.map(item)}
        </div>
      )}
    </div>
  );
}
