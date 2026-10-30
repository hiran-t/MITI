/**
 * Visualization component styles
 */

export const visualizationStyles = {
  // Common viewer container
  viewer: {
    container: 'relative w-full h-full bg-surface-viewport overflow-hidden',
    header:
      'absolute top-3 left-3 z-10 px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800',
    statusBar:
      'absolute top-3 right-3 z-10 px-3 py-1.5 bg-gray-900/90 rounded text-xs text-gray-400 border border-gray-800',
    contentCenter: 'w-full h-full flex items-center justify-center',
  },

  // Camera viewer specific
  camera: {
    headerBar: 'absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3',
    title:
      'flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800',
    titleIcon: 'w-4 h-4',
    select:
      'px-3 py-1.5 bg-gray-900/90 rounded text-xs text-gray-300 border border-gray-800 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed',
    statusIcon: 'w-3 h-3 animate-spin',
    statusTime: 'text-gray-500',
    emptyState: 'text-center text-gray-500',
    emptyIcon: 'w-12 h-12 mx-auto mb-2 opacity-50',
    emptyText: 'text-sm',
    emptySubtext: 'text-xs mt-1 text-gray-600',
    errorState: 'text-center text-danger',
    image: 'max-w-full max-h-full object-contain',
    loadingOverlay:
      'absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none',
    loadingSpinner: 'w-8 h-8 text-white animate-spin',
  },

  // Point cloud viewer specific
  pointcloud: {
    pointsInfo: 'ml-2 text-gray-500',
    centerContent: 'absolute inset-0 flex items-center justify-center',
    loadingContainer: 'text-center px-4 break-words',
    loadingSpinner: 'w-8 h-8 text-gray-600 animate-spin mx-auto mb-2',
    loadingText: 'text-sm text-gray-400',
    parsingBadge:
      'absolute bottom-3 right-3 px-2 py-1 bg-warn/20 rounded text-xs text-warn border border-warn/30',
  },

  // URDF Viewer
  urdfViewer: {
    container: 'relative w-full h-full bg-surface-viewport overflow-hidden',
    headerBar: 'absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-3',
    headerLeft: 'flex min-w-0 items-center gap-2 flex-1',
    badge:
      'hidden md:block px-3 py-1.5 bg-gray-900/90 rounded text-xs font-medium text-gray-300 border border-gray-800',
    badgeConnected: 'ml-2 text-ok',
    badgeLoaded: 'ml-2 text-accent',
    tfToggleButton: 'px-3 py-1.5 rounded text-xs font-medium border transition-colors',
    tfToggleActive: 'bg-accent/15 text-accent border-accent/40 hover:bg-accent/25',
    tfToggleInactive: 'bg-gray-800/90 text-gray-400 border-gray-700 hover:bg-gray-700/90',
    emptyState: 'absolute inset-0 flex items-center justify-center',
    emptyContent: 'text-center px-4 break-words',
    emptyIcon: 'w-8 h-8 text-gray-600 mx-auto mb-2',
    emptyIconSpin: 'w-8 h-8 text-gray-600 animate-spin mx-auto mb-2',
    emptyText: 'text-sm text-gray-400',
  },

  // Scene 3D
  scene: {
    canvas: 'bg-surface-viewport',
  },
} as const;
