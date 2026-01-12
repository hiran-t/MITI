'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutConfig, WidgetConfig, DEFAULT_LAYOUT } from '../types/widget';

const STORAGE_KEY = 'vizzy_layout_config';

/**
 * Hook for managing widget layout configuration
 */
export function useLayoutConfig() {
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);

  // Load layout from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setLayout(parsed);
        } catch (e) {
          console.error('Failed to parse layout config:', e);
        }
      }
    }
  }, []);

  // Save layout to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }
  }, [layout]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetConfig>) => {
    setLayout(prev => ({
      ...prev,
      widgets: prev.widgets.map(w =>
        w.id === widgetId ? { ...w, ...updates } : w
      ),
    }));
  }, []);

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setLayout(prev => ({
      ...prev,
      widgets: prev.widgets.map(w =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      ),
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  return {
    layout,
    updateWidget,
    toggleWidgetVisibility,
    resetLayout,
  };
}
