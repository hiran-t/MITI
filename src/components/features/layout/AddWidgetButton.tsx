'use client';

import { useEffect, useRef, useState } from 'react';
import { WIDGET_TYPES, WidgetType } from '@/types/widget';
import { Plus } from 'lucide-react';
import PanelIcon from './PanelIcon';

export default function AddWidgetButton({
  onAddWidget,
}: {
  onAddWidget: (type: WidgetType) => void;
}) {
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
  return (
    <div className="relative" ref={container}>
      <button
        ref={trigger}
        className="workspace-button primary"
        aria-expanded={open}
        aria-controls="panel-picker"
        onClick={() => setOpen(!open)}
      >
        <Plus size={15} />
        Add panel
      </button>
      {open && (
        <div id="panel-picker" className="panel-picker" aria-label="Add panel">
          <p className="px-3 py-2 text-xs text-gray-400">VISUALIZATION PANELS</p>
          {WIDGET_TYPES.map(({ type, label }) => (
            <button
              key={type}
              className="flex w-full items-center gap-3 rounded px-3 py-3 text-left hover:bg-gray-800"
              onClick={() => {
                onAddWidget(type);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <PanelIcon type={type} />
              <span className="flex-1">{label}</span>
              <Plus size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
