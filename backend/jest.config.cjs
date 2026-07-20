/**
 * Jest config for the TypeScript backend.
 *
 * The source uses NodeNext-style imports with explicit '.js' suffixes
 * (e.g. `import { config } from '../config/index.js'`). For tests we
 * compile to CommonJS via ts-jest and strip the '.js' suffix from
 * relative imports so Jest resolves the underlying '.ts' files.
 */

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
        },
      },
    ],
  },
  clearMocks: true,
};
