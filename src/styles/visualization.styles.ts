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

  // Viewer controls
  controls: {
    container: 'absolute top-2 right-2 z-10 flex gap-2',
    button:
      'p-2 bg-gray-900/80 hover:bg-gray-800/80 rounded border border-gray-700 transition-colors',
    icon: 'w-4 h-4 text-gray-300',
  },

  // URDF source selector
  urdf: {
    dropdown: {
      container: 'relative',
      trigger:
        'flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-all text-sm font-medium',
      icon: 'w-4 h-4',
      iconTopic: 'text-accent',
      iconUrl: 'text-accent',
      label: 'text-gray-300',
      chevron: 'w-3.5 h-3.5 text-gray-400 transition-transform',
      chevronOpen: 'w-3.5 h-3.5 text-gray-400 transition-transform rotate-180',
      panel:
        'absolute left-0 top-full mt-1 w-80 max-w-[calc(100vw-56px)] bg-gray-900 border border-gray-800 rounded shadow-xl z-[60] overflow-hidden',
    },
    tabs: {
      container: 'flex border-b border-gray-800',
      button:
        'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
      buttonActive: 'bg-gray-800 text-white border-b-2',
      buttonInactive: 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50',
      borderTopic: 'border-accent',
      borderUrl: 'border-accent',
      icon: 'w-4 h-4',
    },
    form: {
      container: 'p-3',
      fieldset: 'space-y-3',
      label: 'block text-xs font-medium text-gray-400 mb-2',
      input:
        'w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-accent',
      hint: 'mt-1.5 text-xs text-gray-500',
      select:
        'w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-accent disabled:opacity-50',
      loadButton:
        'w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-gray-950 text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed',
      loadIcon: 'w-4 h-4',
      loadingIcon: 'w-4 h-4 animate-spin',
    },
  },

  // URDF Settings
  urdfSettings: {
    container: 'relative',
    triggerButton:
      'flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-800/50 rounded transition-colors border border-gray-800 hover:border-gray-700',
    triggerIcon: 'w-4 h-4 text-gray-400',
    triggerChevron: 'w-3 h-3 text-gray-400 transition-transform',
    triggerChevronOpen: 'w-3 h-3 text-gray-400 transition-transform rotate-180',
    dropdown:
      'absolute right-0 top-full mt-2 w-80 max-h-[32rem] overflow-y-auto bg-gray-900 border border-gray-800 rounded shadow-xl z-50',
    section: 'p-3 border-b border-gray-800',
    sectionTitle: 'text-xs font-semibold text-gray-400 mb-2',
    sectionTitleWithIcon: 'text-xs font-semibold text-gray-400 flex items-center gap-1.5',
    sectionHeader: 'flex items-center justify-between mb-2',
    // Point Cloud Topics
    topicInputContainer: 'flex gap-2 mb-2',
    topicInput:
      'flex-1 px-2 py-1.5 bg-gray-800 text-gray-200 text-xs rounded border border-gray-700 focus:border-accent focus:outline-none',
    addButton:
      'px-2 py-1.5 bg-accent hover:bg-accent-hover text-gray-950 rounded transition-colors',
    addIcon: 'w-4 h-4',
    topicList: 'space-y-1.5',
    topicItem:
      'flex items-center justify-between p-2 bg-gray-800/50 rounded border border-gray-700',
    topicName: 'text-xs text-gray-300 truncate flex-1',
    removeButton: 'ml-2 p-1 text-danger hover:bg-danger/20 rounded transition-colors flex-shrink-0',
    removeIcon: 'w-3.5 h-3.5',
    emptyState: 'text-xs text-gray-500 italic',
    // Presets
    presetsList: 'space-y-1.5',
    presetItem: 'group relative',
    presetButton:
      'w-full text-left p-2 bg-gray-800/50 hover:bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors',
    presetContent: 'flex items-center justify-between',
    presetInfo: 'flex-1 min-w-0 pr-2',
    presetName: 'text-sm font-medium text-gray-200 truncate',
    presetUrl: 'text-xs text-gray-500 truncate',
    deleteButton:
      'flex-shrink-0 p-1 text-danger hover:bg-danger/20 rounded transition-colors opacity-0 group-hover:opacity-100',
    deleteIcon: 'w-3.5 h-3.5',
    // Recent URLs
    recentList: 'space-y-1.5',
    recentItem: 'p-2 bg-gray-800/50 rounded border border-gray-700',
    recentUrl: 'text-xs text-gray-400 truncate',
    clearButton: 'text-xs text-gray-500 hover:text-gray-400 transition-colors',
    clockIcon: 'w-3 h-3',
    // Info
    infoText: 'text-xs text-gray-500',
    infoTip: 'text-accent',
    // Legacy (for backward compatibility)
    button:
      'p-2 bg-gray-900/90 hover:bg-gray-800/90 rounded border border-gray-700 transition-colors',
    icon: 'w-4 h-4 text-gray-300',
    panel:
      'absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-800 rounded shadow-xl overflow-hidden',
    header: 'flex items-center justify-between p-3 border-b border-gray-800',
    title: 'text-sm font-semibold text-white',
    closeButton: 'p-1 hover:bg-gray-800 rounded transition-colors',
    closeIcon: 'w-4 h-4 text-gray-400',
    content: 'p-3 space-y-4 max-h-96 overflow-y-auto',
    checkbox: {
      wrapper: 'flex items-center gap-2',
      input:
        'w-4 h-4 rounded border-gray-700 bg-gray-800 text-accent focus:ring-2 focus:ring-accent focus:ring-offset-0',
      label: 'text-sm text-gray-300',
    },
    slider: {
      wrapper: 'space-y-1',
      label: 'flex justify-between text-xs text-gray-400',
      input: 'w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer',
    },
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

  // Load status
  loadStatus: {
    // Full overlay status
    overlay: 'absolute inset-0 flex items-center justify-center bg-gray-950/90 z-20',
    modalContainer: 'max-w-md w-full mx-4',
    // Loading modal
    loadingCard: 'bg-gray-900/90 border border-gray-800 rounded p-6 relative',
    loadingHeader: 'flex items-center gap-3 mb-4',
    loadingSpinner: 'w-6 h-6 text-accent animate-spin',
    loadingTitle: 'text-lg font-semibold text-gray-200',
    progressInfo: 'flex justify-between text-sm text-gray-400 mb-2',
    progressBar: 'w-full bg-gray-800 rounded-full h-2 mb-2',
    progressFill: 'bg-accent h-2 rounded-full transition-all duration-300',
    currentFile: 'text-xs text-gray-500 truncate',
    loadingMessage: 'text-sm text-gray-400',
    // Error modal
    errorCard: 'bg-danger/10 border border-danger/30 rounded p-6 relative',
    errorHeader: 'flex items-center gap-3 mb-3',
    errorIcon: 'w-6 h-6 text-danger flex-shrink-0',
    errorTitle: 'text-lg font-semibold text-danger',
    errorMessage: 'text-sm text-gray-300 whitespace-pre-wrap pr-8',
    // Success modal
    successCard: 'bg-ok/10 border border-ok/30 rounded p-6 relative',
    successHeader: 'flex items-center gap-3',
    successIcon: 'w-6 h-6 text-ok',
    successTitle: 'text-lg font-semibold text-ok',
    // Close buttons
    closeButton: 'absolute top-3 right-3 p-1 hover:bg-gray-700 rounded transition-colors',
    closeIcon: 'w-5 h-5 text-gray-400',
    errorCloseButton: 'absolute top-3 right-3 p-1 hover:bg-danger/20 rounded transition-colors',
    errorCloseIcon: 'w-5 h-5 text-danger',
    successCloseButton: 'absolute top-3 right-3 p-1 hover:bg-ok/20 rounded transition-colors',
    successCloseIcon: 'w-5 h-5 text-ok',
    // Legacy inline status (for backward compatibility)
    inlineContainer: 'absolute bottom-3 left-3 right-3 z-10',
    inlineError: 'p-3 bg-danger/10 border border-danger/30 rounded',
    inlineErrorTitle: 'text-sm font-medium text-danger mb-1',
    inlineErrorMessage: 'text-xs text-danger',
    inlineLoading: 'flex items-center gap-3 p-3 bg-accent/10 border border-accent/30 rounded',
    inlineLoadingContent: 'flex-1',
  },
} as const;
