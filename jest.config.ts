import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/server/solaar', '<rootDir>/server/db', '<rootDir>/server/state'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        // Strip .js extensions for ESM-style imports in ts-jest (CJS mode)
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    collectCoverageFrom: [
        'server/solaar/**/*.ts',
        'server/db/**/*.ts',
        'server/state/**/*.ts',
        '!server/solaar/__tests__/**',
        '!server/solaar/index.ts',
        '!server/db/__tests__/**',
        '!server/state/__tests__/**',
    ],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
    // Only print coverage to terminal — don't generate the coverage/ folder
    coverageReporters: ['text', 'text-summary'],
};

export default config;
