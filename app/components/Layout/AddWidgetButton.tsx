'use client';

import React, { useState } from 'react';
import { WIDGET_TYPES, WidgetType } from '@/app/types/widget';
import { Plus, X } from 'lucide-react';

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
        className="fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-r from-lime-400 to-cyan-400 hover:from-lime-500 hover:to-cyan-500 rounded-full shadow-lg transition-all duration-200 hover:scale-110 group"
        title="Add Widget"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Plus className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Widget Type Selector Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="fixed bottom-24 right-6 z-50 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl p-2 min-w-[250px]">
            <div className="text-xs font-semibold text-gray-400 px-3 py-2 mb-1">
              Add Widget
            </div>
            {WIDGET_TYPES.map((widgetType) => (
              <button
                key={widgetType.type}
                onClick={() => {
                  onAddWidget(widgetType.type);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors text-left"
              >
                <span className="text-2xl">{widgetType.icon}</span>
                <div className="flex-1">
                  <div className="text-sm text-gray-200 font-medium">{widgetType.label}</div>
                  <div className="text-xs text-gray-500">
                    {widgetType.defaultSize.w}×{widgetType.defaultSize.h}
                  </div>
                </div>
                <Plus className="w-4 h-4 text-blue-400" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
