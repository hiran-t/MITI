/**
 * Common widget styles for consistent styling across all widget components
 */

export const widgetStyles = {
  // Widget container styles
  container: 'panel-shell',

  // Tab-style header: one tab (icon, title, close) plus actions on the tab strip.
  header: {
    base: 'drag-handle panel-tabbar cursor-move',
    titleWrapper: 'panel-tab',
    title: 'panel-tab-title truncate',
    actions: 'panel-tab-actions',
  },

  // Widget action button styles
  buttons: {
    base: 'panel-action',
    lock: 'is-locked',
    icon: 'w-3.5 h-3.5',
  },

  // Widget content area styles
  content: {
    wrapper: 'flex-1 min-h-0 overflow-hidden',
    inner: 'h-full w-full min-h-0 overflow-hidden',
  },

  // Floating action button styles
  floatingButton: {
    base: 'fixed bottom-6 right-6 z-40 p-4 bg-accent hover:bg-accent-hover rounded-full shadow-lg transition-all duration-200 hover:scale-110 group',
    icon: 'w-6 h-6 text-gray-950',
  },

  // Widget menu/modal styles
  menu: {
    backdrop: 'fixed inset-0 z-30 bg-black/20',
    container:
      'fixed bottom-24 right-6 z-50 bg-gray-900 border border-gray-800 rounded shadow-2xl p-2 min-w-[250px]',
    header: 'text-xs font-semibold text-gray-400 px-3 py-2 mb-1',
    item: 'w-full flex items-center gap-3 p-3 hover:bg-gray-800 rounded transition-colors text-left',
    itemIcon: 'text-2xl',
    itemContent: 'flex-1',
    itemTitle: 'text-sm text-gray-200 font-medium',
    itemSubtitle: 'text-xs text-gray-500',
    itemAction: 'w-4 h-4 text-accent',
  },

  // Widget type specific styles
  types: {
    unknown: 'text-gray-400',
  },
} as const;
