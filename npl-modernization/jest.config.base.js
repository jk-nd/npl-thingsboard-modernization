module.exports = {
  rootDir: '.',
  testTimeout: 30000,
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleDirectories: ['node_modules'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/out-tsc/'
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
};
