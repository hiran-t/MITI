'use client';

import React, { useState } from 'react';
import { LayoutConfig, WidgetConfig } from '@/app/types/widget';
import { Settings, Eye, EyeOff, RotateCcw, X } from 'lucide-react';

interface LayoutConfigProps {
  layout: LayoutConfig;
  onToggleWidget: (widgetId: string) => void;
  onResetLayout: () => void;
}

export default function LayoutConfigPanel({
  layout,
  onToggleWidget,
  onResetLayout,
}: LayoutConfigProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Config Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
        title="Layout Configuration"
      >
        <Settings className="w-4 h-4 text-gray-400" />
      </button>

      {/* Config Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Layout Configuration</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Widget Visibility Toggles */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Widget Visibility</h4>
                <div className="space-y-2">
                  {layout.widgets.map((widget) => (
                    <button
                      key={widget.id}
                      onClick={() => onToggleWidget(widget.id)}
                      className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <span className="text-sm text-gray-200">{widget.title}</span>
                      {widget.visible ? (
                        <Eye className="w-4 h-4 text-blue-400" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  onResetLayout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400">Reset to Default Layout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
