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
// three.js loaders it imports, and the drag-and-drop backends react-mosaic-component uses.
const jestConfig = createJestConfig(config);
export default async () => {
  const resolved = await jestConfig();
  return {
    ...resolved,
    transformIgnorePatterns: (resolved.transformIgnorePatterns ?? []).map((pattern) =>
      pattern === '/node_modules/'
        ? '/node_modules/(?!(urdf-loader|three/examples/jsm|react-dnd[^/]*|dnd-core|dnd-multi-backend|rdndmb-html5-to-touch|@react-dnd)/)'
        : pattern
    ),
  };
};
