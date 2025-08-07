module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testTimeout: 120000,
  rootDir: '.',
  modulePaths: ['<rootDir>/src']
};
