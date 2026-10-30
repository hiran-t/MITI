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
          {WIDGET_TYPES.map(({ type, label }) => (
            <button
              key={type}
              className="panel-picker-item"
              onClick={() => {
                onAddWidget(type);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <PanelIcon type={type} />
              <span className="flex-1">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
