/**
 * Connection-related component styles
 */

export const connectionStyles = {
  // Connection status container
  status: {
    container: 'connection-status flex min-w-0 items-center gap-2',
    statusWrapper: 'flex items-center gap-2',
    icon: 'w-5 h-5',
    iconConnected: 'w-5 h-5 text-green-500',
    iconDisconnected: 'w-5 h-5 text-red-500',
    statusText: 'text-xs font-medium',
    statusTextConnected: 'text-xs font-medium text-green-500',
    statusTextDisconnected: 'text-xs font-medium text-red-500',
    divider: 'h-4 w-px bg-gray-700',
    url: 'connection-url text-xs font-mono text-gray-400 truncate max-w-[230px]',
    indicator: 'w-2 h-2 bg-green-500 rounded-full animate-pulse',
  },

  // Connection settings button
  settingsButton: {
    base: 'p-2 bg-gray-900/50 border border-gray-800 rounded-md hover:border-gray-700 transition-colors',
    icon: 'w-4 h-4 text-gray-400',
  },

  // Connection settings modal
  modal: {
    backdrop:
      'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4',
    container: 'bg-gray-900 border border-gray-800 rounded-md shadow-xl max-w-md w-full',
    header: 'flex items-center justify-between p-4 border-b border-gray-800',
    title: 'text-lg font-semibold text-white',
    closeButton: 'p-1 hover:bg-gray-800 rounded transition-colors',
    closeIcon: 'w-5 h-5 text-gray-400',
    content: 'p-4 space-y-4',
    footer: 'flex items-center justify-between p-4 border-t border-gray-800',
  },

  // Form inputs
  form: {
    label: 'block text-xs font-medium text-gray-300 mb-2',
    input:
      'w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-violet-400 transition-colors',
    hint: 'mt-1 text-xs text-gray-500',
  },

  // Examples section
  examples: {
    container: 'bg-gray-950 rounded-md p-3',
    title: 'text-xs font-medium text-gray-400 mb-2',
    list: 'space-y-1',
    link: 'block text-xs text-violet-300 hover:text-violet-200 transition-all',
  },

  // Footer buttons
  buttons: {
    reset: 'px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors',
    group: 'flex gap-2',
    cancel: 'px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors',
    save: 'px-4 py-1.5 text-sm bg-violet-400 hover:bg-violet-300 text-gray-900 font-medium rounded-md transition-all',
  },
} as const;
