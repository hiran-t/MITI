'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutConfig, WidgetConfig, DEFAULT_LAYOUT } from '@/types/widget';
import { DEFAULT_URDF_CONFIG } from '@/types/urdf-config';
import { getPanel } from '@/panels';
import {
  addToMosaic,
  mosaicFromGrid,
  removeFromMosaic,
  syncMosaic,
  type MosaicTree,
} from '@/lib/layout/mosaic';

const STORAGE_KEY = 'miti_layout_config';

/** Grid size of a new panel, kept for MITI 2.x layouts; the split tree decides its real size. */
const NEW_PANEL_SIZE = { w: 4, h: 9 };

/**
 * Preserve widget settings, clamp legacy grid geometry, and make sure the split tree holds every
 * panel exactly once. Layouts saved before the split tree are converted from their grid. Panels of
 * a type MITI does not know, e.g. from a widget that is not installed, are kept with their settings.
 */
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
        typeof widget.type !== 'string' ||
        !widget.type ||
        typeof widget.title !== 'string'
      )
        return false;
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
  const stored = (value as { mosaic?: unknown }).mosaic;
  const mosaic =
    stored !== undefined
      ? (stored as MosaicTree | null)
      : mosaicFromGrid(widgets.map(({ i, x, y, w, h }) => ({ id: i, x, y, w, h })));
  return {
    widgets,
    mosaic: syncMosaic(
      mosaic,
      widgets.map((widget) => widget.i)
    ),
  };
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
          mosaic: restored.mosaic,
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

  /** Adds a panel beside `beside` (e.g. the selected panel), or beside the whole layout. */
  const addWidget = useCallback(
    (type: string, beside?: string | null) => {
      const panel = getPanel(type);
      if (!panel) return;

      // Generate a unique ID; a widget's panel types contain a slash, which ids leave out.
      const base = type.replace(/[^\w-]+/g, '-');
      const existingIds = layout.widgets.map((w) => w.i);
      let counter = 1;
      let newId = `${base}-${counter}`;
      while (existingIds.includes(newId)) {
        counter++;
        newId = `${base}-${counter}`;
      }

      const props = panel.defaultConfig?.();
      const newWidget: WidgetConfig = {
        i: newId,
        type,
        title: panel.label,
        x: 0,
        y: Math.max(0, ...layout.widgets.map((widget) => widget.y + widget.h)),
        ...NEW_PANEL_SIZE,
        minW: 1,
        minH: 1,
        ...(props !== undefined && { props }),
      };

      setLayout((prev) => ({
        widgets: [...prev.widgets, newWidget],
        mosaic: addToMosaic(prev.mosaic ?? null, newId, beside),
      }));
    },
    [layout.widgets]
  );

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      widgets: prev.widgets.filter((w) => w.i !== widgetId),
      mosaic: removeFromMosaic(prev.mosaic ?? null, widgetId),
    }));
  }, []);

  /** Moving or resizing panels changes only the split tree. */
  const updateMosaic = useCallback((mosaic: MosaicTree | null) => {
    setLayout((prev) => ({ ...prev, mosaic }));
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

  /** Replace the layout, e.g. with one read from a file. */
  const replaceLayout = useCallback((next: LayoutConfig) => {
    setLayout(normalizeLayout(next));
  }, []);

  return {
    hydrated,
    layout,
    updateWidget,
    addWidget,
    removeWidget,
    updateMosaic,
    resetLayout,
    replaceLayout,
    toggleLock,
  };
}
