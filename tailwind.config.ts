import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import { GRAY_SCALE, MITI_CYAN, MITI_CYAN_HOVER, UI_TOKENS } from './src/lib/theme';

/** Tailwind color backed by an `--miti-*-rgb` variable, so `/50` opacity modifiers work. */
const rgbVar = (name: string) => `rgb(var(--miti-${name}-rgb) / <alpha-value>)`;

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: MITI_CYAN, hover: MITI_CYAN_HOVER },
        accent: { DEFAULT: rgbVar('accent'), hover: 'var(--miti-accent-hover)' },
        ok: rgbVar('ok'),
        warn: rgbVar('warn'),
        danger: rgbVar('error'),
        surface: {
          chrome: 'var(--miti-bg-chrome)',
          panel: 'var(--miti-bg-panel)',
          viewport: 'var(--miti-bg-viewport)',
          input: 'var(--miti-bg-input)',
        },
        gray: GRAY_SCALE,
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': Object.fromEntries(
          Object.entries(UI_TOKENS).map(([name, value]) => [`--miti-${name}`, value])
        ),
      });
    }),
  ],
};
export default config;
