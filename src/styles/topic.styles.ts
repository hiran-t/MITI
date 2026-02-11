/**
 * Topic-related component styles
 */

export const topicStyles = {
  // Topic list container
  list: {
    container: 'flex flex-col h-full',
    toolbar: 'flex items-center gap-3 mb-4',
    searchWrapper: 'relative flex-1',
    searchIcon: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400',
    searchInput: 'w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors',
    refreshButton: 'p-2 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors disabled:opacity-50',
    refreshIcon: 'w-4 h-4 text-gray-400',
    refreshIconSpinning: 'w-4 h-4 text-gray-400 animate-spin',
    stats: 'flex items-center justify-between mb-3',
    statsText: 'text-sm text-gray-400',
    itemsContainer: 'flex-1 overflow-auto space-y-3',
    emptyState: 'text-center text-gray-500 py-8',
  },

  // Topic card container
  card: {
    base: 'bg-gray-900/50 rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors',
    header: 'flex items-start justify-between mb-2',
    content: 'flex-1 min-w-0',
  },

  // Topic info display
  info: {
    topic: 'text-sm font-mono text-white truncate',
    type: 'text-xs text-gray-400 mt-1',
  },

  // Subscribe button styles
  button: {
    base: 'ml-2 px-3 py-1 text-xs font-medium rounded transition-colors',
    subscribed: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    unsubscribed: 'bg-gradient-to-r from-lime-400/20 to-cyan-400/20 text-cyan-300 hover:from-lime-400/30 hover:to-cyan-400/30',
  },

  // Message display section
  message: {
    container: 'mt-3 pt-3 border-t border-gray-800',
    stats: 'flex items-center justify-between text-xs text-gray-400 mb-2',
    json: 'mt-2 p-2 bg-gray-950 rounded text-xs font-mono text-gray-300 max-h-32 overflow-auto',
  },

  // Topic data display
  data: {
    container: 'bg-gray-950 rounded-lg p-4 font-mono text-sm text-gray-300 overflow-auto max-h-96',
    emptyState: 'text-center text-gray-500 py-8',
  },
} as const;
