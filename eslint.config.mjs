// ESLint 10 flat config: Next.js rules (core-web-vitals) and the Rules of Hooks, the same
// checks MITI ran with next/core-web-vitals before.
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const config = [
  {
    ignores: [
      '**/.next/**',
      '.claude/**',
      'out/**',
      'node_modules/**',
      '.pixi/**',
      'coverage/**',
      'ros/overlay/**',
      'next-env.d.ts',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default config;
