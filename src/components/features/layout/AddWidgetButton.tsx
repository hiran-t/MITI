'use client';

import React, { useState } from 'react';
import { WIDGET_TYPES, WidgetType } from '@/types/widget';
import { Plus, X } from 'lucide-react';
import { widgetStyles } from '@/styles';

interface AddWidgetButtonProps {
  onAddWidget: (type: WidgetType) => void;
}

export default function AddWidgetButton({ onAddWidget }: AddWidgetButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Add Widget Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={widgetStyles.floatingButton.base}
        title="Add Widget"
      >
        {isOpen ? (
          <X className={widgetStyles.floatingButton.icon} />
        ) : (
          <Plus className={widgetStyles.floatingButton.icon} />
        )}
      </button>

      {/* Widget Type Selector Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className={widgetStyles.menu.backdrop} onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div className={widgetStyles.menu.container}>
            <div className={widgetStyles.menu.header}>Add Widget</div>
            {WIDGET_TYPES.map((widgetType) => (
              <button
                key={widgetType.type}
                onClick={() => {
                  onAddWidget(widgetType.type);
                  setIsOpen(false);
                }}
                className={widgetStyles.menu.item}
              >
                <span className={widgetStyles.menu.itemIcon}>{widgetType.icon}</span>
                <div className={widgetStyles.menu.itemContent}>
                  <div className={widgetStyles.menu.itemTitle}>{widgetType.label}</div>
                  <div className={widgetStyles.menu.itemSubtitle}>
                    {widgetType.defaultSize.w}×{widgetType.defaultSize.h}
                  </div>
                </div>
                <Plus className={widgetStyles.menu.itemAction} />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
