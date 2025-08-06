module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!node_modules/**',
    '!coverage/**'
  ],
  
  // Test timeouts
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Error handling
  bail: false,
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Test reporter
  reporters: [
    'default'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
}; 