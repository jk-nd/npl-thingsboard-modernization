module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/__tests__/**/*.test.ts'],
  testTimeout: 120000,
  rootDir: '.',
  modulePaths: ['<rootDir>/src']
};
