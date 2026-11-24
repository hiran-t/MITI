'use client';

import type { Ref } from 'react';
import { Box, CircleAlert, ListTree, Puzzle, Radio, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RegisteredSidebarView } from '@/panels/views';

export const SIDEBAR_TABS = ['Panel', 'Topics', 'Problems', 'Sources', 'Widgets'] as const;
type BuiltinTab = (typeof SIDEBAR_TABS)[number];
/** A built-in tab's name, or the id of a view a widget added. */
export type SidebarTab = string;

const TAB_META: Record<BuiltinTab, { icon: LucideIcon; label: string }> = {
  Panel: { icon: SlidersHorizontal, label: 'Panel settings' },
  Topics: { icon: ListTree, label: 'Topics' },
  Problems: { icon: CircleAlert, label: 'Problems' },
  Sources: { icon: Radio, label: 'Sources' },
  Widgets: { icon: Puzzle, label: 'Widgets' },
};

export const isBuiltinTab = (tab: SidebarTab): tab is BuiltinTab =>
  (SIDEBAR_TABS as readonly string[]).includes(tab);

export const sidebarViewLabel = (tab: SidebarTab, views: readonly RegisteredSidebarView[] = []) =>
  isBuiltinTab(tab) ? TAB_META[tab].label : (views.find((view) => view.id === tab)?.label ?? '');

interface ActivityBarProps {
  activeTab: SidebarTab;
  sidebarOpen: boolean;
  problemCount: number;
  /** Views widgets added, shown after the built-in tabs. */
  views?: readonly RegisteredSidebarView[];
  /** Receives the active tab's button so closing the sidebar can return focus to it. */
  activeRef: Ref<HTMLButtonElement>;
  /** Clicking the open view closes the sidebar; any other icon opens that view. */
  onSelect: (tab: SidebarTab) => void;
  onFocusTab: (tab: SidebarTab) => void;
}

/** VS Code-style rail of sidebar views on the far left of the workspace. */
export default function ActivityBar({
  activeTab,
  sidebarOpen,
  problemCount,
  views = [],
  activeRef,
  onSelect,
  onFocusTab,
}: ActivityBarProps) {
  const tabs = [
    ...SIDEBAR_TABS.map((tab) => ({ id: tab, ...TAB_META[tab] })),
    ...views.map((view) => ({ id: view.id, label: view.label, icon: view.icon ?? Box })),
  ];
  return (
    <nav
      className="activity-bar"
      role="tablist"
      aria-label="Workspace tools"
      aria-orientation="vertical"
    >
      {tabs.map(({ id, icon: Icon, label }, index) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            ref={selected ? activeRef : undefined}
            id={`sidebar-tab-${id}`}
            role="tab"
            aria-label={label}
            title={label}
            aria-selected={selected}
            aria-expanded={selected ? sidebarOpen : undefined}
            aria-controls={`sidebar-view-${id}`}
            tabIndex={selected ? 0 : -1}
            className={`activity-item ${selected && sidebarOpen ? 'is-open' : ''} ${
              index === SIDEBAR_TABS.length ? 'is-first-added' : ''
            }`}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              onFocusTab(tabs[next].id);
              document.getElementById(`sidebar-tab-${tabs[next].id}`)?.focus();
            }}
          >
            <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
            {id === 'Problems' && problemCount > 0 && (
              <span className="activity-badge">{problemCount}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
