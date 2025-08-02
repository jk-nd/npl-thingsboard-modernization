/**
 * Copyright © 2016-2025 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Test setup configuration
jest.setTimeout(60000); // 60 second timeout for integration tests

// Global test configuration
const testConfig = {
  retryAttempts: 3,
  waitTime: 1000,
  maxDevicesPerTest: 20
};

// Make test config available globally
(global as any).testConfig = testConfig;

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

// Cleanup helper
export const cleanupHelper = {
  deviceIds: [] as string[],
  
  addDevice(deviceId: string) {
    this.deviceIds.push(deviceId);
  },
  
  async cleanup() {
    // This will be implemented by individual test suites
    console.log(`Cleanup helper: ${this.deviceIds.length} devices to clean`);
  }
};

// Test environment validation
beforeAll(async () => {
  console.log('🔧 Setting up NPL DeviceManagement Integration Tests...');
  
  // Check required environment variables
  const requiredEnvVars = [
    'TB_URL',
    'NPL_PROXY_URL', 
    'NPL_ENGINE_URL',
    'NPL_READ_MODEL_URL'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️ Environment variable ${envVar} not set, using default`);
    }
  }
  
  console.log('✅ Test environment setup completed');
});

afterAll(async () => {
  console.log('🧹 Tearing down NPL DeviceManagement Integration Tests...');
  await cleanupHelper.cleanup();
  console.log('✅ Test environment teardown completed');
});

export { testConfig }; 