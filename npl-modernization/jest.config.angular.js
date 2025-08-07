const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,
  preset: 'jest-preset-angular',
  testEnvironment: 'jsdom',
  moduleDirectories: [
    '<rootDir>/frontend-overlay/node_modules',
    'node_modules'
  ],
  testMatch: [
    '<rootDir>/tests/ui/**/*.test.ts',
    '<rootDir>/tests/ui/**/*.spec.ts'
  ],
  transform: {
    '^.+\\.(ts|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.html$',
        isolatedModules: true
      }
    ]
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/angular-setup.ts'
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@angular/(.*)$': '<rootDir>/frontend-overlay/node_modules/@angular/$1',
    '^rxjs(.*)$': '<rootDir>/frontend-overlay/node_modules/rxjs$1'
  }
};
