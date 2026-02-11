/**
 * Dashboard layout styles
 */

export const dashboardStyles = {
  // Main container
  container: 'min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col',
  wrapper: 'flex-1 flex flex-col max-w-[1920px] mx-auto w-full',

  // Header section
  header: {
    container: 'flex-shrink-0 p-3 border-b border-gray-800',
    toolbar: 'flex items-center justify-between gap-4',
    logoSection: 'flex items-center gap-2 ml-3',
    logo: 'h-9 w-auto',
    actionsSection: 'flex items-center gap-3',
    errorBanner: 'mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400',
  },

  // Main content area
  main: {
    container: 'flex-1 p-4 relative',
  },
} as const;
