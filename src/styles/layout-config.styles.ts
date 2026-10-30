/**
 * Layout configuration panel styles
 */

export const layoutConfigStyles = {
  // Config button (currently commented out in component)
  button: {
    base: 'p-2 bg-gray-900/50 border border-gray-800 rounded hover:border-gray-700 transition-colors',
    icon: 'w-4 h-4 text-gray-400',
  },

  // Modal/Panel
  modal: {
    backdrop: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
    container: 'bg-gray-900 border border-gray-800 rounded shadow-2xl w-full max-w-md mx-4',
    header: 'flex items-center justify-between p-4 border-b border-gray-800',
    title: 'text-lg font-semibold',
    closeButton: 'p-1 hover:bg-gray-800 rounded transition-colors',
    closeIcon: 'w-5 h-5 text-gray-400',
    content: 'p-4 space-y-4',
  },

  // Widget list section
  widgetList: {
    title: 'text-sm font-medium text-gray-300 mb-3',
    container: 'space-y-2',
    item: 'w-full flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded transition-colors text-left',
    itemIcon: 'text-2xl',
    itemContent: 'flex-1',
    itemTitle: 'text-sm text-gray-200',
    itemSize: 'text-xs text-gray-500',
    itemAction: 'w-4 h-4 text-accent',
  },

  // Instructions/Tips section
  tips: {
    container: 'p-3 bg-gradient-to-r from-ok/10 to-accent/10 border border-accent/30 rounded',
    text: 'text-xs text-accent',
  },

  // Reset button
  reset: {
    button:
      'w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-ok/20 to-accent/20 hover:from-ok/30 hover:to-accent/30 border border-accent/30 rounded transition-all',
    icon: 'w-4 h-4 text-accent',
    text: 'text-sm text-accent',
  },
} as const;
