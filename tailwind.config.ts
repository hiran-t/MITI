import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#111216',
          900: '#191B22',
          800: '#2B2E39',
          700: '#3C4050',
          600: '#747B8F',
          500: '#969DB0',
          400: '#ADB3C3',
          300: '#C6CBD7',
          200: '#E8EAF0',
          100: '#F3F4F7',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
};
export default config;
