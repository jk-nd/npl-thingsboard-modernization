const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,
  testEnvironment: 'node',
  silent: true,
  testMatch: [
    '<rootDir>/tests/sync-service/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.json'
    }]
  },
  moduleNameMapper: {
    '^@services/(.*)$': '<rootDir>/sync-service/src/services/$1',
    '^@test/(.*)$': '<rootDir>/tests/$1'
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/node-setup.ts'
  ]
};
