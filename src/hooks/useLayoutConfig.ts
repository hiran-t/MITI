'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LayoutConfig,
  WidgetConfig,
  DEFAULT_LAYOUT,
  WIDGET_TYPES,
  WidgetType,
} from '@/types/widget';

const STORAGE_KEY = 'miti_layout_config';

/**
 * Hook for managing widget layout configuration with add/remove support
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
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.i === widgetId ? { ...w, ...updates } : w)),
    }));
  }, []);

  const addWidget = useCallback(
    (type: WidgetType) => {
      const widgetInfo = WIDGET_TYPES.find((w) => w.type === type);
      if (!widgetInfo) return;

      // Generate unique ID
      const existingIds = layout.widgets.map((w) => w.i);
      let counter = 1;
      let newId = `${type}-${counter}`;
      while (existingIds.includes(newId)) {
        counter++;
        newId = `${type}-${counter}`;
      }

      // Find the rightmost position to place new widget horizontally
      let maxX = 0;
      let maxXY = { x: 0, y: 0, w: 0, h: 0 };

      layout.widgets.forEach((widget) => {
        const rightEdge = widget.x + widget.w;
        if (rightEdge > maxX) {
          maxX = rightEdge;
          maxXY = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
        }
      });

      // Place new widget to the right of the rightmost widget
      // If it would exceed grid width (12 cols), wrap to next row
      const newW = widgetInfo.defaultSize.w;
      let newX = maxX;
      let newY = maxXY.y;

      if (newX + newW > 12) {
        // Would exceed grid, place at start of next row
        newX = 0;
        newY = maxXY.y + maxXY.h;
      }

      const newWidget: WidgetConfig = {
        i: newId,
        type,
        title: widgetInfo.label,
        x: newX,
        y: newY,
        w: newW,
        h: widgetInfo.defaultSize.h,
        minW: widgetInfo.minSize.minW,
        minH: widgetInfo.minSize.minH,
      };

      setLayout((prev) => ({
        ...prev,
        widgets: [...prev.widgets, newWidget],
      }));
    },
    [layout.widgets]
  );

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.i !== widgetId),
    }));
  }, []);

  const updateLayout = useCallback((newLayout: readonly any[]) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((widget) => {
        const layoutItem = newLayout.find((l) => l.i === widget.i);
        if (layoutItem) {
          return {
            ...widget,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          };
        }
        return widget;
      }),
    }));
  }, []);

  const toggleLock = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.i === widgetId ? { ...w, locked: !w.locked } : w)),
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  return {
    layout,
    updateWidget,
    addWidget,
    removeWidget,
    updateLayout,
    resetLayout,
    toggleLock,
  };
}
