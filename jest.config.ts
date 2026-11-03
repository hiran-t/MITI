import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  roots: ['<rootDir>/src'],
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  transformIgnorePatterns: ['/node_modules/', '^.+\\.module\\.(css|sass|scss)$'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async.
// These packages ship untranspiled ES modules, so Jest transforms them: urdf-loader and the
// three.js loaders it imports, and the drag-and-drop backends react-mosaic-component uses. next/jest
// adds node_modules patterns of its own, which would still skip them, so they are replaced by one
// pattern that also keeps the exceptions next/jest makes for Next.js's own client code.
const ESM_PACKAGES = [
  'urdf-loader',
  'three/examples/jsm',
  'react-dnd[^/]*',
  'dnd-core',
  'dnd-multi-backend',
  'rdndmb-html5-to-touch',
  '@react-dnd',
  'geist',
  'next/dist/client',
  'next/dist/shared/lib',
  'next/src/client',
  'next/src/shared/lib',
];
const jestConfig = createJestConfig(config);
export default async () => {
  const resolved = await jestConfig();
  return {
    ...resolved,
    transformIgnorePatterns: [
      `/node_modules/(?!(${ESM_PACKAGES.join('|')})/)`,
      ...(resolved.transformIgnorePatterns ?? []).filter(
        (pattern) => !pattern.startsWith('/node_modules')
      ),
    ],
  };
};
