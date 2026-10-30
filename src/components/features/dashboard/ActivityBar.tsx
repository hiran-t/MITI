'use client';

import type { Ref } from 'react';
import { AlertCircle, ListTree, Radio, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const SIDEBAR_TABS = ['Panel', 'Topics', 'Problems', 'Sources'] as const;
export type SidebarTab = (typeof SIDEBAR_TABS)[number];

const TAB_META: Record<SidebarTab, { icon: LucideIcon; label: string }> = {
  Panel: { icon: SlidersHorizontal, label: 'Panel settings' },
  Topics: { icon: ListTree, label: 'Topics' },
  Problems: { icon: AlertCircle, label: 'Problems' },
  Sources: { icon: Radio, label: 'Sources' },
};

export const sidebarViewLabel = (tab: SidebarTab) => TAB_META[tab].label;

interface ActivityBarProps {
  activeTab: SidebarTab;
  sidebarOpen: boolean;
  problemCount: number;
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
  activeRef,
  onSelect,
  onFocusTab,
}: ActivityBarProps) {
  return (
    <nav
      className="activity-bar"
      role="tablist"
      aria-label="Workspace tools"
      aria-orientation="vertical"
    >
      {SIDEBAR_TABS.map((tab, index) => {
        const { icon: Icon, label } = TAB_META[tab];
        const selected = activeTab === tab;
        return (
          <button
            key={tab}
            ref={selected ? activeRef : undefined}
            id={`sidebar-tab-${tab}`}
            role="tab"
            aria-label={label}
            title={label}
            aria-selected={selected}
            aria-expanded={selected ? sidebarOpen : undefined}
            aria-controls={`sidebar-view-${tab}`}
            tabIndex={selected ? 0 : -1}
            className={`activity-item ${selected && sidebarOpen ? 'is-open' : ''}`}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === 'ArrowDown') next = (index + 1) % SIDEBAR_TABS.length;
              else if (event.key === 'ArrowUp')
                next = (index + SIDEBAR_TABS.length - 1) % SIDEBAR_TABS.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = SIDEBAR_TABS.length - 1;
              else return;
              event.preventDefault();
              onFocusTab(SIDEBAR_TABS[next]);
              document.getElementById(`sidebar-tab-${SIDEBAR_TABS[next]}`)?.focus();
            }}
          >
            <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
            {tab === 'Problems' && problemCount > 0 && (
              <span className="activity-badge">{problemCount}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
