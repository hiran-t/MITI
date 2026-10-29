/**
 * Topic-related component styles
 */

export const topicStyles = {
  // Topic list container
  list: {
    container: 'flex flex-col h-full',
    toolbar: 'flex items-center gap-2 mb-3',
    searchWrapper: 'relative flex-1',
    searchIcon: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400',
    searchInput:
      'w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-400 transition-colors',
    refreshButton:
      'p-2 bg-gray-900/50 border border-gray-800 rounded-md hover:border-gray-700 transition-colors disabled:opacity-50',
    refreshIcon: 'w-4 h-4 text-gray-400',
    refreshIconSpinning: 'w-4 h-4 text-gray-400 animate-spin',
    stats: 'flex items-center justify-between mb-3',
    statsText: 'text-sm text-gray-400',
    itemsContainer: 'flex-1 overflow-auto space-y-1',
    emptyState: 'text-center text-gray-500 py-8',
  },

  // Topic card container
  card: {
    base: 'bg-gray-900/50 rounded-md border border-gray-800 p-2 hover:border-gray-700 transition-colors',
    header: 'flex flex-wrap items-start gap-2 justify-between mb-2',
    content: 'w-full min-w-0',
  },

  // Topic info display
  info: {
    topic: 'text-sm font-mono text-white truncate',
    type: 'text-xs font-mono text-gray-400 mt-1 break-all',
  },

  // Subscribe button styles
  button: {
    base: 'px-2 py-1 text-xs font-medium rounded transition-colors',
    subscribed: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    unsubscribed: 'bg-violet-400/15 text-violet-300 hover:bg-violet-400/25',
  },

  // Message display section
  message: {
    container: 'mt-3 pt-3 border-t border-gray-800',
    stats: 'flex items-center justify-between text-xs text-gray-400 mb-2',
    json: 'mt-2 p-2 bg-gray-950 rounded text-xs font-mono text-gray-300 max-h-32 overflow-auto',
  },

  // Topic data display
  data: {
    container: 'bg-gray-950 rounded-md p-4 font-mono text-sm text-gray-300 overflow-auto max-h-96',
    emptyState: 'text-center text-gray-500 py-8',
  },
} as const;
