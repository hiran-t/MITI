/**
 * Connection-related component styles
 */

export const connectionStyles = {
  // Connection status container
  status: {
    container: 'connection-status',
    icon: 'h-3.5 w-3.5 shrink-0',
    url: 'connection-url',
  },

  // Connection settings button
  settingsButton: {
    base: 'p-1.5 rounded border border-gray-700 hover:bg-gray-800 transition-colors',
    icon: 'w-4 h-4 text-gray-400',
  },

  // Connection settings modal
  modal: {
    backdrop: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 text-[13px]',
    container: 'bg-gray-900 border border-gray-700 rounded shadow-xl max-w-md w-full text-gray-300',
    header: 'flex items-center justify-between px-4 py-3 border-b border-gray-800',
    title: 'text-sm font-medium text-gray-200',
    closeButton: 'p-1 hover:bg-gray-800 rounded transition-colors',
    closeIcon: 'w-5 h-5 text-gray-400',
    content: 'p-4 space-y-4',
    footer: 'flex items-center justify-between px-4 py-3 border-t border-gray-800',
  },

  // Form inputs
  form: {
    label: 'block text-xs text-gray-400 mb-1.5',
    input:
      'w-full h-8 px-2.5 bg-gray-950 border border-gray-700 rounded text-gray-200 font-mono text-xs placeholder-gray-600 focus:outline-none focus:border-accent transition-colors',
    hint: 'mt-1 text-xs text-gray-500',
  },

  // ROS network of the bridge beside MITI
  network: {
    section: 'space-y-2 border-t border-gray-800 pt-4',
    title: 'flex items-baseline justify-between gap-2 text-xs font-medium text-gray-300',
    meta: 'font-normal text-gray-500',
    row: 'flex items-end gap-2',
    state: 'min-w-0 flex-1 truncate text-xs',
    log: 'ml-1.5 font-mono text-gray-500',
    error: 'text-xs text-danger',
  },

  // Examples section
  examples: {
    container: 'bg-gray-950 rounded p-3',
    title: 'text-xs font-medium text-gray-400 mb-2',
    list: 'space-y-1',
    link: 'block font-mono text-xs text-accent hover:text-accent-hover transition-colors',
  },

  // Footer buttons
  buttons: {
    reset: 'px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors',
    group: 'flex gap-2',
    cancel:
      'px-3 py-1.5 text-xs text-gray-300 border border-gray-700 rounded hover:bg-gray-800 transition-colors',
    apply:
      'shrink-0 px-3 py-1.5 text-xs text-gray-200 border border-gray-700 rounded hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent',
    save: 'px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-gray-950 font-medium rounded transition-colors',
  },
} as const;
