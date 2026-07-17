import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/tests/**/*.test.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: 'tests/tsconfig.json',
        }],
    },
    coverageDirectory: '<rootDir>/coverage',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/*.mock.ts',
        '!src/**/*.fixtures.ts',
    ],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/tests/',
        '/__mocks__/',
        '/fixtures/',
    ],
    coverageReporters: ['text', 'lcov'],
    coverageThreshold: {
        global: {
            lines: 80,
            branches: 75,
            functions: 85,
            statements: 80,
        },
    },
};

export default config;
