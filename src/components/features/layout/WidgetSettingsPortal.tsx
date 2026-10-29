'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const WidgetSettingsContext = createContext<{
  target: HTMLElement | null;
  close: () => void;
}>({ target: null, close: () => {} });

/** Keep the viewer mounted; render only the selected widget's settings in the inspector. */
export default function WidgetSettingsPortal({ children }: { children: ReactNode }) {
  const { target } = useContext(WidgetSettingsContext);
  return target
    ? createPortal(<div onClick={(event) => event.stopPropagation()}>{children}</div>, target)
    : null;
}
export function useCloseWidgetSettings() {
  return useContext(WidgetSettingsContext).close;
}

export const SettingsSearchContext = createContext('');

/** Hide nonmatching groups without discarding in-progress edits. */
export function SettingsSection({
  title,
  keywords = '',
  children,
}: {
  title: string;
  keywords?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const query = useContext(SettingsSearchContext).trim().toLowerCase();
  useEffect(() => {
    if (query) setExpanded(true);
  }, [query]);
  const matches = !query || `${title} ${keywords}`.toLowerCase().includes(query);
  return (
    <details className="settings-section" open={expanded} hidden={!matches}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          setExpanded(!expanded);
        }}
      >
        {title}
      </summary>
      <div className="settings-section-body">{children}</div>
    </details>
  );
}
