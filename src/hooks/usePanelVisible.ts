'use client';
import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * False while the panel is covered, e.g. by another panel expanded to fill the workspace. Hidden
 * panels keep their subscriptions and newest data but skip rendering until they are shown again.
 */
export const PanelVisibleContext = createContext(true);

export function usePanelVisible(): boolean {
  return useContext(PanelVisibleContext);
}

/**
 * The panel's visibility as a ref, for message callbacks, and a call to `onShown` whenever the
 * panel becomes visible again (to show what arrived while it was hidden).
 */
export function usePanelVisibleRef(onShown?: () => void) {
  const visible = usePanelVisible();
  const ref = useRef(visible);
  const shown = useRef(onShown);
  shown.current = onShown;
  useEffect(() => {
    const wasVisible = ref.current;
    ref.current = visible;
    if (visible && !wasVisible) shown.current?.();
  }, [visible]);
  return ref;
}
