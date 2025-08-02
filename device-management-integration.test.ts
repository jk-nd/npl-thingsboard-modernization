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

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';

interface TestConfig {
  thingsBoardUrl: string;
  nplProxyUrl: string;
  nplEngineUrl: string;
  nplReadModelUrl: string;
  credentials: {
    username: string;
    password: string;
  };
}

interface Device {
  id?: string;
  name: string;
  type: string;
  label?: string;
  customerId?: string;
  tenantId?: string;
  createdTime?: number;
}

interface DeviceCredentials {
  id?: string;
  deviceId: string;
  credentialsType: string;
  credentialsId?: string;
  credentialsValue?: string;
}

class DeviceManagementIntegrationTest {
  private config: TestConfig;
  private authToken: string = '';
  private thingsBoardClient: AxiosInstance;
  private nplProxyClient: AxiosInstance;
  private nplEngineClient: AxiosInstance;
  private createdDevices: string[] = [];

  constructor() {
    this.config = {
      thingsBoardUrl: process.env.TB_URL || 'http://localhost:8082',
      nplProxyUrl: process.env.NPL_PROXY_URL || 'http://localhost:8081',
      nplEngineUrl: process.env.NPL_ENGINE_URL || 'http://localhost:12000',
      nplReadModelUrl: process.env.NPL_READ_MODEL_URL || 'http://localhost:5001',
      credentials: {
        username: process.env.TB_USERNAME || 'tenant@thingsboard.org',
        password: process.env.TB_PASSWORD || 'tenant'
      }
    };

    this.thingsBoardClient = axios.create({
      baseURL: this.config.thingsBoardUrl,
      timeout: 10000
    });

    this.nplProxyClient = axios.create({
      baseURL: this.config.nplProxyUrl,
      timeout: 10000
    });

    this.nplEngineClient = axios.create({
      baseURL: this.config.nplEngineUrl,
      timeout: 10000
    });
  }

  async setup(): Promise<void> {
    console.log('🔧 Setting up DeviceManagement Integration Tests...');
    
    // Authenticate with ThingsBoard
    const loginResponse = await this.thingsBoardClient.post('/api/auth/login', {
      username: this.config.credentials.username,
      password: this.config.credentials.password
    });

    this.authToken = loginResponse.data.token;
    
    // Set authorization headers for all clients
    const authHeader = `Bearer ${this.authToken}`;
    this.thingsBoardClient.defaults.headers.common['Authorization'] = authHeader;
    this.nplProxyClient.defaults.headers.common['Authorization'] = authHeader;
    this.nplEngineClient.defaults.headers.common['Authorization'] = authHeader;

    console.log('✅ Authentication successful');
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test devices...');
    
    for (const deviceId of this.createdDevices) {
      try {
        await this.thingsBoardClient.delete(`/api/device/${deviceId}`);
        console.log(`🗑️ Deleted device: ${deviceId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to delete device ${deviceId}:`, error);
      }
    }
    
    this.createdDevices = [];
    console.log('✅ Cleanup completed');
  }

  // ==================== READ OPERATION TESTS (GraphQL) ====================

  async testGetDeviceById(): Promise<void> {
    console.log('📖 Testing: getDeviceById via NPL GraphQL...');
    
    // First create a device via ThingsBoard directly
    const testDevice: Device = {
      name: 'test-device-get-by-id',
      type: 'sensor',
      label: 'Test device for getById'
    };

    const createResponse = await this.thingsBoardClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    this.createdDevices.push(createdDevice.id);

    // Test getting device via NPL proxy (should route to GraphQL)
    const nplResponse = await this.nplProxyClient.get(`/api/device/${createdDevice.id}`);
    
    // Test getting device via direct ThingsBoard
    const tbResponse = await this.thingsBoardClient.get(`/api/device/${createdDevice.id}`);

    // Verify both responses contain the device
    expect(nplResponse.status).toBe(200);
    expect(tbResponse.status).toBe(200);
    expect(nplResponse.data.name).toBe(testDevice.name);
    expect(tbResponse.data.name).toBe(testDevice.name);

    console.log('✅ getDeviceById test passed');
  }
}

// Jest test suite
describe('NPL DeviceManagement Integration', () => {
  let testSuite: DeviceManagementIntegrationTest;

  beforeAll(async () => {
    testSuite = new DeviceManagementIntegrationTest();
    await testSuite.setup();
  }, 30000);

  afterAll(async () => {
    if (testSuite) {
      await testSuite.cleanup();
    }
  }, 30000);

  test('should handle device read operations via GraphQL', async () => {
    await testSuite.testGetDeviceById();
  }, 60000);
});

// CLI runner for standalone execution
if (require.main === module) {
  const testSuite = new DeviceManagementIntegrationTest();
  testSuite.testGetDeviceById()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} 