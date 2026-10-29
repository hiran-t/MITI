/**
 * Common widget styles for consistent styling across all widget components
 */

export const widgetStyles = {
  // Widget container styles
  container:
    'panel-shell bg-gray-900 rounded-md border border-gray-800 overflow-hidden flex flex-col',

  // Widget header styles
  header: {
    base: 'drag-handle h-10 shrink-0 px-2 border-b border-gray-800 flex items-center justify-between cursor-move bg-gray-900 hover:bg-gray-800/40 transition-colors select-none',
    titleWrapper: 'flex min-w-0 items-center gap-2',
    title: 'text-xs font-medium flex items-center gap-2 truncate',
    indicator: 'w-2 h-2 bg-gradient-to-r from-lime-400 to-cyan-400 rounded-full',
    actions: 'flex items-center gap-1',
  },

  // Widget action button styles
  buttons: {
    base: 'p-1 rounded transition-colors pointer-events-auto',
    lock: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400',
    unlock: 'hover:bg-gray-700/50 text-gray-400',
    remove: 'hover:bg-red-500/20 text-gray-400 hover:text-red-400',
    icon: 'w-4 h-4',
  },

  // Widget content area styles
  content: {
    wrapper: 'flex-1 min-h-0 overflow-hidden p-1 react-grid-item-content',
    inner: 'h-full w-full min-h-0 overflow-hidden',
  },

  // Floating action button styles
  floatingButton: {
    base: 'fixed bottom-6 right-6 z-40 p-4 bg-violet-400 hover:bg-violet-300 rounded-full shadow-lg transition-all duration-200 hover:scale-110 group',
    icon: 'w-6 h-6 text-white',
  },

  // Widget menu/modal styles
  menu: {
    backdrop: 'fixed inset-0 z-30 bg-black/20 backdrop-blur-sm',
    container:
      'fixed bottom-24 right-6 z-50 bg-gray-900 border border-gray-800 rounded-md shadow-2xl p-2 min-w-[250px]',
    header: 'text-xs font-semibold text-gray-400 px-3 py-2 mb-1',
    item: 'w-full flex items-center gap-3 p-3 hover:bg-gray-800 rounded-md transition-colors text-left',
    itemIcon: 'text-2xl',
    itemContent: 'flex-1',
    itemTitle: 'text-sm text-gray-200 font-medium',
    itemSubtitle: 'text-xs text-gray-500',
    itemAction: 'w-4 h-4 text-blue-400',
  },

  // Widget type specific styles
  types: {
    unknown: 'text-gray-400',
  },
} as const;
