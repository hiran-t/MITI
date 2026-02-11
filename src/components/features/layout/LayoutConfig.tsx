'use client';

import React, { useState } from 'react';
import { WIDGET_TYPES, WidgetType } from '@/types/widget';
import { Settings, Plus, RotateCcw, X } from 'lucide-react';
import { layoutConfigStyles } from '@/styles';

interface LayoutConfigProps {
  onAddWidget: (type: WidgetType) => void;
  onResetLayout: () => void;
}

export default function LayoutConfigPanel({
  onAddWidget,
  onResetLayout,
}: LayoutConfigProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Config Button */}
      {/* <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
        title="Layout Configuration"
      >
        <Settings className="w-4 h-4 text-gray-400" />
      </button> */}

      {/* Config Panel */}
      {isOpen && (
        <div className={layoutConfigStyles.modal.backdrop}>
          <div className={layoutConfigStyles.modal.container}>
            {/* Header */}
            <div className={layoutConfigStyles.modal.header}>
              <h3 className={layoutConfigStyles.modal.title}>Layout Configuration</h3>
              <button
                onClick={() => setIsOpen(false)}
                className={layoutConfigStyles.modal.closeButton}
              >
                <X className={layoutConfigStyles.modal.closeIcon} />
              </button>
            </div>

            {/* Content */}
            <div className={layoutConfigStyles.modal.content}>
              {/* Add Widget Section */}
              <div>
                <h4 className={layoutConfigStyles.widgetList.title}>Add Widget</h4>
                <div className={layoutConfigStyles.widgetList.container}>
                  {WIDGET_TYPES.map((widgetType) => (
                    <button
                      key={widgetType.type}
                      onClick={() => {
                        onAddWidget(widgetType.type);
                      }}
                      className={layoutConfigStyles.widgetList.item}
                    >
                      <span className={layoutConfigStyles.widgetList.itemIcon}>{widgetType.icon}</span>
                      <div className={layoutConfigStyles.widgetList.itemContent}>
                        <div className={layoutConfigStyles.widgetList.itemTitle}>{widgetType.label}</div>
                        <div className={layoutConfigStyles.widgetList.itemSize}>
                          Default: {widgetType.defaultSize.w}x{widgetType.defaultSize.h}
                        </div>
                      </div>
                      <Plus className={layoutConfigStyles.widgetList.itemAction} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className={layoutConfigStyles.tips.container}>
                <p className={layoutConfigStyles.tips.text}>
                  💡 <strong>Tips:</strong> Drag the header to move widgets. Click and drag corners to resize. Click X to remove.
                </p>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  onResetLayout();
                  setIsOpen(false);
                }}
                className={layoutConfigStyles.reset.button}
              >
                <RotateCcw className={layoutConfigStyles.reset.icon} />
                <span className={layoutConfigStyles.reset.text}>Reset to Default Layout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
