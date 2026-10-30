/**
 * Topic-related component styles
 */

export const topicStyles = {
  // Topic list container
  list: {
    container: 'flex flex-col h-full',
    toolbar: 'flex items-center gap-1 mb-2',
    searchWrapper: 'relative flex-1',
    searchIcon: 'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500',
    searchInput:
      'w-full h-7 pl-8 pr-3 bg-surface-input border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors',
    refreshButton:
      'p-1.5 rounded text-gray-400 hover:bg-gray-800 transition-colors disabled:opacity-50',
    refreshIcon: 'w-4 h-4 text-gray-400',
    refreshIconSpinning: 'w-4 h-4 text-gray-400 animate-spin',
    stats: 'flex items-center justify-between mb-1.5 px-0.5',
    statsText: 'text-[11px] text-gray-500',
    itemsContainer: 'flex-1 overflow-auto border-t border-gray-800',
    emptyState: 'text-center text-gray-500 py-8',
  },

  // Topic card container
  card: {
    base: 'border-b border-gray-800 px-2 py-1.5 hover:bg-gray-800/50 transition-colors',
    header: 'flex items-center gap-2 justify-between',
    content: 'flex-1 min-w-0',
  },

  // Topic info display
  info: {
    topic: 'text-xs font-mono text-gray-200 truncate',
    type: 'text-[11px] font-mono text-gray-500 mt-0.5 break-all',
  },

  // Subscribe button styles
  button: {
    base: 'shrink-0 px-2 py-0.5 text-[11px] rounded border transition-colors',
    subscribed: 'border-danger/40 text-danger hover:bg-danger/15',
    unsubscribed: 'border-gray-700 text-gray-300 hover:border-accent hover:text-accent',
  },

  // Message display section
  message: {
    container: 'mt-3 pt-3 border-t border-gray-800',
    stats: 'flex items-center justify-between text-xs text-gray-400 mb-2',
    json: 'mt-2 p-2 bg-gray-950 rounded text-xs font-mono text-gray-300 max-h-32 overflow-auto',
  },
} as const;
