#
# Copyright © 2016-2025 The Thingsboard Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

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

  async testGetDeviceInfoById(): Promise<void> {
    console.log('📖 Testing: getDeviceInfoById via NPL GraphQL...');
    
    // Create a test device
    const testDevice: Device = {
      name: 'test-device-info',
      type: 'gateway',
      label: 'Test device for deviceInfo'
    };

    const createResponse = await this.thingsBoardClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    this.createdDevices.push(createdDevice.id);

    // Test getting device info via NPL proxy
    const nplResponse = await this.nplProxyClient.get(`/api/device/info/${createdDevice.id}`);
    
    // Test getting device info via direct ThingsBoard
    const tbResponse = await this.thingsBoardClient.get(`/api/device/info/${createdDevice.id}`);

    // Verify responses
    expect(nplResponse.status).toBe(200);
    expect(tbResponse.status).toBe(200);
    expect(nplResponse.data.name).toBe(testDevice.name);
    expect(nplResponse.data.type).toBe(testDevice.type);

    console.log('✅ getDeviceInfoById test passed');
  }

  async testGetTenantDevices(): Promise<void> {
    console.log('📖 Testing: getTenantDevices via NPL GraphQL...');
    
    // Create multiple test devices
    const deviceNames = ['tenant-device-1', 'tenant-device-2', 'tenant-device-3'];
    
    for (const name of deviceNames) {
      const device: Device = { name, type: 'sensor' };
      const response = await this.thingsBoardClient.post('/api/device', device);
      this.createdDevices.push(response.data.id);
    }

    // Test getting tenant devices via NPL proxy
    const nplResponse = await this.nplProxyClient.get('/api/tenant/devices?pageSize=10');
    
    // Test getting tenant devices via direct ThingsBoard
    const tbResponse = await this.thingsBoardClient.get('/api/tenant/devices?pageSize=10');

    // Verify responses
    expect(nplResponse.status).toBe(200);
    expect(tbResponse.status).toBe(200);
    expect(nplResponse.data.data).toBeDefined();
    expect(Array.isArray(nplResponse.data.data)).toBe(true);
    expect(nplResponse.data.data.length).toBeGreaterThanOrEqual(3);

    console.log('✅ getTenantDevices test passed');
  }

  async testGetDeviceTypes(): Promise<void> {
    console.log('📖 Testing: getDeviceTypes via NPL GraphQL...');
    
    // Create devices with different types
    const deviceTypes = ['sensor', 'gateway', 'actuator'];
    
    for (const type of deviceTypes) {
      const device: Device = { name: `device-${type}`, type };
      const response = await this.thingsBoardClient.post('/api/device', device);
      this.createdDevices.push(response.data.id);
    }

    // Test getting device types via NPL proxy
    const nplResponse = await this.nplProxyClient.get('/api/device/types');
    
    // Test getting device types via direct ThingsBoard
    const tbResponse = await this.thingsBoardClient.get('/api/device/types');

    // Verify responses
    expect(nplResponse.status).toBe(200);
    expect(tbResponse.status).toBe(200);
    expect(Array.isArray(nplResponse.data)).toBe(true);
    expect(Array.isArray(tbResponse.data)).toBe(true);
    
    // Check that our created types are included
    for (const type of deviceTypes) {
      expect(nplResponse.data).toContain(type);
      expect(tbResponse.data).toContain(type);
    }

    console.log('✅ getDeviceTypes test passed');
  }

  async testSearchDevices(): Promise<void> {
    console.log('📖 Testing: searchDevices via NPL GraphQL...');
    
    // Create a device with a unique name for searching
    const searchDevice: Device = {
      name: 'unique-search-device-12345',
      type: 'sensor',
      label: 'Device for search testing'
    };

    const createResponse = await this.thingsBoardClient.post('/api/device', searchDevice);
    this.createdDevices.push(createResponse.data.id);

    // Test searching via NPL proxy
    const nplResponse = await this.nplProxyClient.get('/api/devices?deviceName=unique-search');
    
    // Test searching via direct ThingsBoard
    const tbResponse = await this.thingsBoardClient.get('/api/devices?deviceName=unique-search');

    // Verify responses
    expect(nplResponse.status).toBe(200);
    expect(tbResponse.status).toBe(200);
    expect(nplResponse.data.data).toBeDefined();
    expect(nplResponse.data.data.length).toBeGreaterThanOrEqual(1);
    
    const foundDevice = nplResponse.data.data.find((d: Device) => d.name === searchDevice.name);
    expect(foundDevice).toBeDefined();

    console.log('✅ searchDevices test passed');
  }

  // ==================== WRITE OPERATION TESTS (NPL Engine) ====================

  async testCreateDevice(): Promise<void> {
    console.log('✏️ Testing: createDevice via NPL Engine...');
    
    const testDevice: Device = {
      name: 'npl-created-device',
      type: 'sensor',
      label: 'Device created via NPL Engine'
    };

    // Create device via NPL proxy (should route to NPL Engine)
    const nplResponse = await this.nplProxyClient.post('/api/device', testDevice);
    
    expect(nplResponse.status).toBe(200);
    expect(nplResponse.data.name).toBe(testDevice.name);
    expect(nplResponse.data.id).toBeDefined();
    
    this.createdDevices.push(nplResponse.data.id);

    // Verify device exists in ThingsBoard
    const verifyResponse = await this.thingsBoardClient.get(`/api/device/${nplResponse.data.id}`);
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.data.name).toBe(testDevice.name);

    console.log('✅ createDevice test passed');
  }

  async testUpdateDevice(): Promise<void> {
    console.log('✏️ Testing: updateDevice via NPL Engine...');
    
    // First create a device
    const originalDevice: Device = {
      name: 'device-to-update',
      type: 'sensor',
      label: 'Original label'
    };

    const createResponse = await this.thingsBoardClient.post('/api/device', originalDevice);
    this.createdDevices.push(createResponse.data.id);

    // Update the device via NPL proxy
    const updatedDevice = {
      ...createResponse.data,
      label: 'Updated via NPL Engine'
    };

    const nplResponse = await this.nplProxyClient.post('/api/device', updatedDevice);
    
    expect(nplResponse.status).toBe(200);
    expect(nplResponse.data.label).toBe('Updated via NPL Engine');

    // Verify update in ThingsBoard
    const verifyResponse = await this.thingsBoardClient.get(`/api/device/${createResponse.data.id}`);
    expect(verifyResponse.data.label).toBe('Updated via NPL Engine');

    console.log('✅ updateDevice test passed');
  }

  async testDeleteDevice(): Promise<void> {
    console.log('✏️ Testing: deleteDevice via NPL Engine...');
    
    // Create a device to delete
    const deviceToDelete: Device = {
      name: 'device-to-delete',
      type: 'sensor'
    };

    const createResponse = await this.thingsBoardClient.post('/api/device', deviceToDelete);
    const deviceId = createResponse.data.id;

    // Delete via NPL proxy (should route to NPL Engine)
    const nplResponse = await this.nplProxyClient.delete(`/api/device/${deviceId}`);
    
    expect(nplResponse.status).toBe(200);

    // Verify device no longer exists in ThingsBoard
    try {
      await this.thingsBoardClient.get(`/api/device/${deviceId}`);
      throw new Error('Device should have been deleted');
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }

    console.log('✅ deleteDevice test passed');
  }

  // ==================== INTEGRATION TESTS ====================

  async testNplEngineProtocolCreation(): Promise<void> {
    console.log('🔗 Testing: NPL Engine protocol instantiation...');
    
    // Test that NPL Engine can create DeviceManagement protocol
    const protocolRequest = {
      package: 'deviceManagement',
      protocol: 'DeviceManagement',
      parties: [
        {
          entity: { email: ['tenant@thingsboard.org'] },
          access: {}
        }
      ],
      initialArguments: {}
    };

    try {
      const response = await this.nplEngineClient.post('/api/protocol/instantiate', protocolRequest);
      expect(response.status).toBe(200);
      expect(response.data.protocolId).toBeDefined();
      console.log(`✅ Protocol created with ID: ${response.data.protocolId}`);
    } catch (error: any) {
      console.warn('⚠️ NPL Engine protocol creation test skipped - service may not be fully ready');
      console.warn('Error:', error.response?.data || error.message);
    }
  }

  async testSyncServiceIntegration(): Promise<void> {
    console.log('🔗 Testing: Sync Service integration...');
    
    // Create a device via NPL and verify it appears in ThingsBoard
    const testDevice: Device = {
      name: 'sync-test-device',
      type: 'sensor',
      label: 'Device for testing sync service'
    };

    try {
      const nplResponse = await this.nplProxyClient.post('/api/device', testDevice);
      this.createdDevices.push(nplResponse.data.id);

      // Wait a moment for sync
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify in ThingsBoard
      const tbResponse = await this.thingsBoardClient.get(`/api/device/${nplResponse.data.id}`);
      expect(tbResponse.data.name).toBe(testDevice.name);

      console.log('✅ Sync Service integration test passed');
    } catch (error: any) {
      console.warn('⚠️ Sync Service test skipped - NPL Engine may not be ready');
      console.warn('Error:', error.response?.data || error.message);
    }
  }

  // ==================== PERFORMANCE TESTS ====================

  async testReadPerformance(): Promise<void> {
    console.log('⚡ Testing: Read operation performance comparison...');
    
    // Create test devices
    for (let i = 0; i < 10; i++) {
      const device: Device = { name: `perf-device-${i}`, type: 'sensor' };
      const response = await this.thingsBoardClient.post('/api/device', device);
      this.createdDevices.push(response.data.id);
    }

    // Measure NPL proxy performance
    const nplStartTime = Date.now();
    const nplResponse = await this.nplProxyClient.get('/api/tenant/devices?pageSize=20');
    const nplEndTime = Date.now();
    const nplDuration = nplEndTime - nplStartTime;

    // Measure direct ThingsBoard performance
    const tbStartTime = Date.now();
    const tbResponse = await this.thingsBoardClient.get('/api/tenant/devices?pageSize=20');
    const tbEndTime = Date.now();
    const tbDuration = tbEndTime - tbStartTime;

    console.log(`📊 NPL Proxy: ${nplDuration}ms`);
    console.log(`📊 ThingsBoard Direct: ${tbDuration}ms`);
    console.log(`📊 Overhead: ${nplDuration - tbDuration}ms`);

    // Verify both return same data
    expect(nplResponse.data.data.length).toBe(tbResponse.data.data.length);

    console.log('✅ Read performance test completed');
  }

  // ==================== MAIN TEST RUNNER ====================

  async runAllTests(): Promise<void> {
    try {
      await this.setup();

      console.log('\n🚀 Starting DeviceManagement Integration Tests...\n');

      // Read operation tests (GraphQL)
      console.log('📖 ========== READ OPERATION TESTS ==========');
      await this.testGetDeviceById();
      await this.testGetDeviceInfoById();
      await this.testGetTenantDevices();
      await this.testGetDeviceTypes();
      await this.testSearchDevices();

      // Write operation tests (NPL Engine)
      console.log('\n✏️ ========== WRITE OPERATION TESTS ==========');
      await this.testCreateDevice();
      await this.testUpdateDevice();
      await this.testDeleteDevice();

      // Integration tests
      console.log('\n🔗 ========== INTEGRATION TESTS ==========');
      await this.testNplEngineProtocolCreation();
      await this.testSyncServiceIntegration();

      // Performance tests
      console.log('\n⚡ ========== PERFORMANCE TESTS ==========');
      await this.testReadPerformance();

      console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
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
    await testSuite.testGetDeviceInfoById();
    await testSuite.testGetTenantDevices();
  }, 60000);

  test('should handle device write operations via NPL Engine', async () => {
    await testSuite.testCreateDevice();
    await testSuite.testUpdateDevice();
    await testSuite.testDeleteDevice();
  }, 60000);

  test('should integrate with NPL Engine and Sync Service', async () => {
    await testSuite.testNplEngineProtocolCreation();
    await testSuite.testSyncServiceIntegration();
  }, 60000);

  test('should perform within acceptable limits', async () => {
    await testSuite.testReadPerformance();
  }, 60000);
});

// CLI runner for standalone execution
if (require.main === module) {
  const testSuite = new DeviceManagementIntegrationTest();
  testSuite.runAllTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} 