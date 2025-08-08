const baseConfig = require('./jest.config.base');

module.exports = {
  ...require('./jest.config.base'),
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/sync-service/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@services/(.*)$': '<rootDir>/sync-service/src/services/$1',
    '^@test/(.*)$': '<rootDir>/tests/$1'
  }
};
