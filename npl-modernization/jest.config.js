module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  moduleDirectories: ['node_modules'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
        isolatedModules: true,
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/out-tsc/'
  ],
  transformIgnorePatterns: ['node_modules/(?!@angular|rxjs)'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json'
    }
  }
};