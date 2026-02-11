/**
 * Layout configuration panel styles
 */

export const layoutConfigStyles = {
  // Config button (currently commented out in component)
  button: {
    base: 'p-2 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors',
    icon: 'w-4 h-4 text-gray-400',
  },

  // Modal/Panel
  modal: {
    backdrop: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
    container: 'bg-gray-900 border border-gray-800 rounded-lg shadow-2xl w-full max-w-md mx-4',
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
    item: 'w-full flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors text-left',
    itemIcon: 'text-2xl',
    itemContent: 'flex-1',
    itemTitle: 'text-sm text-gray-200',
    itemSize: 'text-xs text-gray-500',
    itemAction: 'w-4 h-4 text-blue-400',
  },

  // Instructions/Tips section
  tips: {
    container: 'p-3 bg-gradient-to-r from-lime-400/10 to-cyan-400/10 border border-cyan-400/30 rounded-lg',
    text: 'text-xs text-blue-300',
  },

  // Reset button
  reset: {
    button: 'w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-lime-400/20 to-cyan-400/20 hover:from-lime-400/30 hover:to-cyan-400/30 border border-cyan-400/30 rounded-lg transition-all',
    icon: 'w-4 h-4 text-blue-400',
    text: 'text-sm text-blue-400',
  },
} as const;
