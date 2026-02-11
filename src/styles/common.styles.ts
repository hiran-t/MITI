/**
 * Common component styles for reusable UI patterns
 */

export const commonStyles = {
  // Button styles
  button: {
    primary:
      'px-4 py-2 bg-gradient-to-r from-lime-400 to-cyan-400 hover:from-lime-500 hover:to-cyan-500 text-white rounded-lg transition-all duration-200',
    secondary: 'px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors',
    ghost: 'px-4 py-2 hover:bg-gray-800/50 text-gray-300 rounded-lg transition-colors',
    danger: 'px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors',
    icon: 'p-2 hover:bg-gray-800/50 rounded-lg transition-colors',
  },

  // Card styles
  card: {
    base: 'bg-gray-900/50 rounded-lg border border-gray-800',
    header: 'px-4 py-3 border-b border-gray-800',
    body: 'p-4',
    footer: 'px-4 py-3 border-t border-gray-800',
  },

  // Input styles
  input: {
    base: 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent',
    error: 'border-red-500 focus:ring-red-400',
    label: 'block text-sm font-medium text-gray-300 mb-1',
    hint: 'text-xs text-gray-500 mt-1',
  },

  // Status indicators
  status: {
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    neutral: 'text-gray-400',
  },

  // Badge styles
  badge: {
    base: 'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
    neutral: 'bg-gray-500/20 text-gray-400',
  },

  // Modal/Dialog styles
  modal: {
    backdrop: 'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
    container: 'fixed inset-0 z-50 flex items-center justify-center p-4',
    content:
      'bg-gray-900 rounded-lg border border-gray-800 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden',
    header: 'px-6 py-4 border-b border-gray-800 flex items-center justify-between',
    body: 'p-6 overflow-y-auto',
    footer: 'px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-2',
  },

  // Loading states
  loading: {
    spinner: 'animate-spin',
    skeleton: 'animate-pulse bg-gray-800 rounded',
  },

  // Text styles
  text: {
    heading: 'text-2xl font-bold text-white',
    subheading: 'text-lg font-semibold text-gray-200',
    body: 'text-sm text-gray-300',
    caption: 'text-xs text-gray-500',
    muted: 'text-gray-400',
  },

  // Layout helpers
  layout: {
    flexCenter: 'flex items-center justify-center',
    flexBetween: 'flex items-center justify-between',
    grid2: 'grid grid-cols-2 gap-4',
    grid3: 'grid grid-cols-3 gap-4',
    grid4: 'grid grid-cols-4 gap-4',
  },
} as const;

/**
 * Helper function to combine classes conditionally
 */
export const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter(Boolean).join(' ');
};
