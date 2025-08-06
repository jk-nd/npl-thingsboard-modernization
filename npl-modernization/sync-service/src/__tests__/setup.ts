import '@jest/globals';

declare global {
  var testConfig: {
    retryAttempts: number;
    waitTime: number;
    maxTenantsPerTest: number;
    maxDevicesPerTest: number;
  };
  var testUtils: {
    wait: (ms: number) => Promise<void>;
    retry: (fn: () => Promise<any>, maxAttempts?: number) => Promise<any>;
  };
}

// Global test configuration
const testConfig = {
  retryAttempts: 3,
  waitTime: 1000,
  maxTenantsPerTest: 10,
  maxDevicesPerTest: 20
};

// Make test config available globally
global.testConfig = testConfig;

// Setup console logging for tests
const originalConsole = console;
const testConsole = {
  ...originalConsole,
  log: (...args: any[]) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsole.log('[TEST]', ...args);
    }
  },
  error: (...args: any[]) => {
    originalConsole.error('[TEST ERROR]', ...args);
  },
  warn: (...args: any[]) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsole.warn('[TEST WARN]', ...args);
    }
  }
};

// Replace console for tests
global.console = testConsole;

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global test utilities
global.testUtils = {
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  retry: async (fn: () => Promise<any>, maxAttempts = 3) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
};
