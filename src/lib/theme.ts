/** Shared MITI brand colors for CSS, Tailwind and Three.js. */
export const MITI_CYAN = '#15FBFF';
export const MITI_CYAN_HOVER = '#7DFDFF';
export const MITI_CYAN_RGB = '21 251 255';

/**
 * UI chrome tokens (IDE-style dark theme). Emitted as `--miti-<name>` CSS variables by
 * tailwind.config.ts. The brand cyan above stays for the logo and 3D data, not for chrome.
 */
export const UI_TOKENS = {
  'bg-chrome': '#191a1c',
  'bg-panel': '#1e1f22',
  'bg-viewport': '#1a1b1e',
  'bg-input': '#26282b',
  'bg-hover': '#2b2d30',
  'bg-popover': '#2b2d30',
  border: '#2b2d30',
  'border-strong': '#393b40',
  text: '#cfd1d4',
  'text-strong': '#dfe1e4',
  'text-secondary': '#8c8f94',
  'text-muted': '#6b6e73',
  accent: '#2fb4c4',
  'accent-hover': '#4cc4d2',
  'accent-rgb': '47 180 196',
  'accent-muted': '#1d3a40',
  'accent-strong': '#13606b',
  'on-accent-strong': '#e6f7f9',
  ok: '#5bb98a',
  warn: '#d6a243',
  error: '#e2766f',
  'ok-rgb': '91 185 138',
  'warn-rgb': '214 162 67',
  'error-rgb': '226 118 111',
} as const;

/** Neutral ramp behind Tailwind's `gray-*` classes. */
export const GRAY_SCALE = {
  950: '#141517',
  900: '#191a1c',
  800: '#2b2d30',
  700: '#393b40',
  600: '#6b6e73',
  500: '#8c8f94',
  400: '#a8abb0',
  300: '#cfd1d4',
  200: '#dfe1e4',
  100: '#f0f1f2',
} as const;
