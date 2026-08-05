/** @type {import('jest').Config} */

process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.TRANSACTION_TABLE_NAME = process.env.TRANSACTION_TABLE_NAME || 'TransaccionesBancariasDev';
process.env.S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'transacciones-reportes-303040220363';
process.env.PORT = process.env.PORT || '3000';

const config = {
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

module.exports = config;
