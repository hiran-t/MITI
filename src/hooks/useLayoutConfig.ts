'use client';

import { useState, useEffect, useCallback } from 'react';
import type ReactGridLayout from 'react-grid-layout';
import {
  LayoutConfig,
  WidgetConfig,
  DEFAULT_LAYOUT,
  WIDGET_TYPES,
  WidgetType,
} from '@/types/widget';
import { DEFAULT_URDF_CONFIG } from '@/types/urdf-config';
import { CAMERA_TOPICS } from '@/constants/ros-topics';

const STORAGE_KEY = 'miti_layout_config';

/** Preserve widget settings while bringing legacy geometry into the 12-column grid. */
export function normalizeLayout(value: unknown): LayoutConfig {
  if (!value || typeof value !== 'object' || !('widgets' in value) || !Array.isArray(value.widgets))
    return DEFAULT_LAYOUT;
  const ids = new Set<string>();
  const widgets = value.widgets
    .filter((widget): widget is WidgetConfig => {
      if (
        !widget ||
        typeof widget !== 'object' ||
        typeof widget.i !== 'string' ||
        ids.has(widget.i) ||
        !WIDGET_TYPES.some(({ type }) => type === widget.type) ||
        typeof widget.title !== 'string'
      )
        return false;
      if (widget.type === 'camera-viewer' && typeof widget.props?.topic !== 'string') return false;
      ids.add(widget.i);
      return true;
    })
    .map((widget) => {
      const finite = (value: number | undefined, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
      const w = Math.max(1, Math.min(12, finite(widget.w, 4)));
      return {
        ...widget,
        w,
        x: Math.max(0, Math.min(12 - w, finite(widget.x, 0))),
        y: Math.max(0, finite(widget.y, 0)),
        h: Math.max(1, finite(widget.h, 8)),
        minW: Math.max(1, Math.min(w, finite(widget.minW, 1))),
        minH: Math.max(1, Math.min(Math.max(1, finite(widget.h, 8)), finite(widget.minH, 1))),
      };
    });
  return { widgets };
}

/**
 * Hook for managing widget layout configuration with add/remove support
 */
export function useLayoutConfig() {
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);

  const [hydrated, setHydrated] = useState(false);

  // Load layout from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const restored = stored ? normalizeLayout(JSON.parse(stored)) : DEFAULT_LAYOUT;
        let legacy = DEFAULT_URDF_CONFIG;
        try {
          const saved = JSON.parse(localStorage.getItem('miti_urdf_config') || 'null');
          if (saved && typeof saved === 'object') legacy = { ...legacy, ...saved };
        } catch {
          /* Keep defaults when legacy settings cannot be read. */
        }
        setLayout({
          widgets: restored.widgets.map((widget) =>
            widget.type === 'urdf-viewer' && !widget.props
              ? { ...widget, props: { ...legacy } }
              : widget
          ),
        });
      } catch (e) {
        console.error('Failed to read layout config:', e);
      } finally {
        setHydrated(true);
      }
    }
  }, []);

  // Save layout to localStorage whenever it changes
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      } catch (e) {
        console.error('Failed to save layout:', e);
      }
    }
  }, [layout, hydrated]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetConfig>) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.i === widgetId ? ({ ...w, ...updates } as WidgetConfig) : w
      ),
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

      const newW = widgetInfo.defaultSize.w;
      const newX = 0;
      const newY = Math.max(0, ...layout.widgets.map((widget) => widget.y + widget.h));

      const base = {
        i: newId,
        title: widgetInfo.label,
        x: newX,
        y: newY,
        w: newW,
        h: widgetInfo.defaultSize.h,
        minW: widgetInfo.minSize.minW,
        minH: widgetInfo.minSize.minH,
      };

      const newWidget: WidgetConfig =
        type === 'camera-viewer'
          ? { ...base, type, props: { topic: CAMERA_TOPICS.COLOR } }
          : type === 'button-switch'
            ? { ...base, type, props: {} }
            : { ...base, type };

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

  const updateLayout = useCallback((newLayout: readonly ReactGridLayout.Layout[]) => {
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
    hydrated,
    layout,
    updateWidget,
    addWidget,
    removeWidget,
    updateLayout,
    resetLayout,
    toggleLock,
  };
}
