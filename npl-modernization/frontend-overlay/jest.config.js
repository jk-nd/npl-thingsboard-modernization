module.exports = {
  preset: 'jest-preset-angular',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: [
    '<rootDir>/tests/ui/**/*.spec.ts',
    '<rootDir>/tests/ui/**/*.test.ts'
  ],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$'
    }
  },
  moduleFileExtensions: ['ts', 'html', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};


