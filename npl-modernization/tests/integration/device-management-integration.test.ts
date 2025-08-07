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

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

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
  deviceProfileId?: { id: string; entityType: string; };
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
  private defaultDeviceProfile: any;

  constructor() {
    this.config = {
      thingsBoardUrl: process.env.TB_URL || 'http://localhost:9090', // Use mytb-core for API calls
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

    // Get default device profile
    const deviceProfilesResponse = await this.thingsBoardClient.get('/api/deviceProfiles', {
      params: { pageSize: 1, page: 0 }
    });
    
    if (deviceProfilesResponse.data.data && deviceProfilesResponse.data.data.length > 0) {
      this.defaultDeviceProfile = deviceProfilesResponse.data.data[0];
      console.log(`📋 Using default device profile: ${this.defaultDeviceProfile.name}`);
    }

    console.log('✅ Authentication successful');
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test devices...');
    
    for (const deviceId of this.createdDevices) {
      try {
        await this.thingsBoardClient.delete(`/api/device/${deviceId}`);
        console.log(`🗑️ Deleted device: ${deviceId}`);
      } catch (error: any) {
        const status = error?.response?.status;
        const statusText = error?.response?.statusText;
        const message = error?.message;
        console.warn(`⚠️ Failed to delete device ${deviceId}. status=${status} statusText=${statusText} message=${message}`);
      }
    }
    
    this.createdDevices = [];
    console.log('✅ Cleanup completed');
  }

  // ==================== READ OPERATION TESTS (GraphQL) ====================

  async testGetDeviceById(): Promise<void> {
    console.log('📖 Testing: getDeviceById via NPL GraphQL...');
    
    // Create a device via NPL (source of truth)
    const testDevice: Device = {
      name: 'test-device-get-by-id',
      type: 'sensor',
      label: 'Test device for getById'
    };

    const createResponse = await this.nplProxyClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    let deviceIdString: string;
    
    if (typeof createdDevice.id === 'string') {
      deviceIdString = createdDevice.id;
    } else if (createdDevice.id && createdDevice.id.id) {
      deviceIdString = createdDevice.id.id;
    } else {
      throw new Error('Invalid device ID structure');
    }
    
    this.createdDevices.push(deviceIdString);

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test getting device via NPL proxy (should route to GraphQL)
    const nplResponse = await this.nplProxyClient.get(`/api/device/${deviceIdString}`);
    
    // Test getting device via direct ThingsBoard to verify sync
    const tbResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);

    // Verify both responses contain the device
    expect(nplResponse.status).toBe(200);
    expect(tbResponse.status).toBe(200);
    expect(nplResponse.data.name).toBe(testDevice.name);
    expect(tbResponse.data.name).toBe(testDevice.name);

    console.log('✅ getDeviceById test passed');
  }

  async testGetDeviceInfoById(): Promise<void> {
    console.log('📖 Testing: getDeviceInfoById via GraphQL...');
    
    const testDevice: Device = {
      name: 'test-device-info',
      type: 'sensor',
      label: 'Test device for info'
    };

    const createResponse = await this.nplProxyClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test device info endpoint
    const infoResponse = await this.nplProxyClient.get(`/api/device/info/${deviceIdString}`);
    
    expect(infoResponse.status).toBe(200);
    expect(infoResponse.data.name).toBe(testDevice.name);
    expect(infoResponse.data.type).toBe(testDevice.type);

    console.log('✅ getDeviceInfoById test passed');
  }

  async testGetTenantDevices(): Promise<void> {
    console.log('📖 Testing: getTenantDevices via GraphQL...');
    
    // Create multiple devices
    const devices = [
      { name: 'tenant-device-1', type: 'sensor', label: 'Tenant test 1' },
      { name: 'tenant-device-2', type: 'actuator', label: 'Tenant test 2' }
    ];

    for (const device of devices) {
      const createResponse = await this.nplProxyClient.post('/api/device', device);
      const createdDevice = createResponse.data;
      const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
      this.createdDevices.push(deviceIdString);
    }

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test tenant devices endpoint
    const tenantResponse = await this.nplProxyClient.get('/api/tenant/devices', {
      params: { pageSize: 20, page: 0 }
    });
    
    expect(tenantResponse.status).toBe(200);
    expect(tenantResponse.data.data).toBeDefined();
    expect(Array.isArray(tenantResponse.data.data)).toBe(true);

    console.log('✅ getTenantDevices test passed');
  }

  async testGetDeviceTypes(): Promise<void> {
    console.log('📖 Testing: getDeviceTypes via GraphQL...');
    
    const typesResponse = await this.nplProxyClient.get('/api/device/types');
    
    expect(typesResponse.status).toBe(200);
    expect(Array.isArray(typesResponse.data)).toBe(true);

    console.log('✅ getDeviceTypes test passed');
  }

  // ==================== WRITE OPERATION TESTS (NPL Engine) ====================

  async testCreateDevice(): Promise<void> {
    console.log('✏️ Testing: Device creation via NPL Engine...');
    
    const testDevice: Device = {
      name: 'npl-created-device',
      type: 'temperature_sensor',
      label: 'Device created via NPL'
    };

    const createResponse = await this.nplProxyClient.post('/api/device', testDevice);
    expect(createResponse.status).toBe(200);
    
    const createdDevice = createResponse.data;
    expect(createdDevice.name).toBe(testDevice.name);
    expect(createdDevice.type).toBe(testDevice.type);
    
    const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync to ThingsBoard
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify device appears in ThingsBoard
    const tbResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
    expect(tbResponse.status).toBe(200);
    expect(tbResponse.data.name).toBe(testDevice.name);

    console.log('✅ Device creation test passed');
  }

  async testUpdateDevice(): Promise<void> {
    console.log('✏️ Testing: Device update via NPL Engine...');
    
    // Create device first
    const testDevice: Device = {
      name: 'device-to-update',
      type: 'sensor',
      label: 'Original label'
    };

    const createResponse = await this.nplProxyClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
    this.createdDevices.push(deviceIdString);

    // Update device
    const updatedDevice = {
      ...createdDevice,
      label: 'Updated label via NPL'
    };

    const updateResponse = await this.nplProxyClient.put('/api/device', updatedDevice);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.label).toBe('Updated label via NPL');

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify update in ThingsBoard
    const tbResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
    expect(tbResponse.status).toBe(200);
    expect(tbResponse.data.label).toBe('Updated label via NPL');

    console.log('✅ Device update test passed');
  }

  async testDeleteDevice(): Promise<void> {
    console.log('✏️ Testing: Device deletion via NPL Engine...');
    
    // Create device first
    const testDevice: Device = {
      name: 'device-to-delete',
      type: 'sensor',
      label: 'Will be deleted'
    };

    const createResponse = await this.nplProxyClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;

    // Wait for creation sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify device exists in ThingsBoard
    const beforeDeleteResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
    expect(beforeDeleteResponse.status).toBe(200);

    // Delete device via NPL
    const deleteResponse = await this.nplProxyClient.delete(`/api/device/${deviceIdString}`);
    expect(deleteResponse.status).toBe(200);

    // Wait for deletion sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify device is deleted in ThingsBoard
    try {
      await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
      throw new Error('Device should have been deleted');
    } catch (error) {
      expect(axios.isAxiosError(error) && error.response?.status).toBe(404);
    }

    console.log('✅ Device deletion test passed');
  }

  // ==================== BUSINESS LOGIC TESTS ====================

  async testDeviceCustomerAssignment(): Promise<void> {
    console.log('🏢 Testing: Device-Customer assignment...');
    
    // Create a device
    const testDevice: Device = {
      name: 'device-for-assignment',
      type: 'sensor',
      label: 'Assignment test device'
    };

    const createResponse = await this.nplProxyClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
    this.createdDevices.push(deviceIdString);

    // Get tenant customers
    const customersResponse = await this.thingsBoardClient.get('/api/tenant/customers', {
      params: { pageSize: 10, page: 0 }
    });

    if (customersResponse.data.data && customersResponse.data.data.length > 0) {
      const customerId = customersResponse.data.data[0].id.id;

      // Assign device to customer via NPL
      const assignResponse = await this.nplProxyClient.post(`/api/customer/${customerId}/device/${deviceIdString}`);
      expect(assignResponse.status).toBe(200);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify assignment in ThingsBoard
      const deviceResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
      expect(deviceResponse.data.customerId.id).toBe(customerId);

      console.log('✅ Device-Customer assignment test passed');
    } else {
      console.log('⚠️ No customers found - skipping assignment test');
    }
  }

  async testDeviceCredentialsManagement(): Promise<void> {
    console.log('🔑 Testing: Device credentials management...');
    
    // Create device
    const testDevice: Device = {
      name: 'device-with-credentials',
      type: 'sensor',
      label: 'Credentials test device'
    };

    const createResponse = await this.nplProxyClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
    this.createdDevices.push(deviceIdString);

    // Test credentials update
    const credentials = {
      deviceId: deviceIdString,
      credentialsType: 'ACCESS_TOKEN',
      credentialsValue: 'test-token-12345'
    };

    const credentialsResponse = await this.nplProxyClient.post('/api/device/credentials', credentials);
    expect(credentialsResponse.status).toBe(200);

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify credentials in ThingsBoard
    const tbCredentialsResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}/credentials`);
    expect(tbCredentialsResponse.status).toBe(200);

    console.log('✅ Device credentials management test passed');
  }

  // ==================== PERFORMANCE TESTS ====================

  async testReadPerformance(): Promise<void> {
    console.log('⚡ Testing: Read operation performance...');
    
    // Create test devices
    const devicePromises: Promise<AxiosResponse<any>>[] = [];
    for (let i = 0; i < 3; i++) {
      const device = {
        name: `perf-device-${i}`,
        type: 'sensor',
        label: `Performance test device ${i}`
      };
      devicePromises.push(this.nplProxyClient.post('/api/device', device));
    }

    const createResponses = await Promise.all(devicePromises);
    const deviceIds = createResponses.map(response => {
      const device = response.data;
      const deviceIdString = typeof device.id === 'string' ? device.id : device.id.id;
      this.createdDevices.push(deviceIdString);
      return deviceIdString;
    });

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test individual device queries performance
    const startTime = Date.now();
    const queryPromises = deviceIds.map(id => 
      this.nplProxyClient.get(`/api/device/${id}`)
    );
    
    const responses = await Promise.all(queryPromises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Verify all responses
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.data.name).toMatch(/^perf-device-\d+$/);
    });

    // Performance assertion (should complete within reasonable time)
    expect(totalTime).toBeLessThan(5000); // 5 seconds for 3 parallel queries

    console.log(`✅ Performance test passed - ${responses.length} queries in ${totalTime}ms`);
  }

  // ==================== INTEGRATION TESTS ====================

  async testNplEngineIntegration(): Promise<void> {
    console.log('🔗 Testing: NPL Engine integration...');
    
    // Test NPL Engine health
    const healthResponse = await this.nplEngineClient.get('/actuator/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data.status).toBe('UP');

    console.log('✅ NPL Engine integration test passed');
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

  // ==================== READ OPERATIONS ====================
  
  test('should handle device read operations via GraphQL', async () => {
    await testSuite.testGetDeviceById();
    await testSuite.testGetDeviceInfoById();
    await testSuite.testGetTenantDevices();
    await testSuite.testGetDeviceTypes();
  }, 60000);

  // ==================== WRITE OPERATIONS ====================
  
  test('should handle device write operations via NPL Engine', async () => {
    await testSuite.testCreateDevice();
    await testSuite.testUpdateDevice();
    await testSuite.testDeleteDevice();
  }, 120000);

  // ==================== BUSINESS LOGIC ====================
  
  test('should handle business logic operations', async () => {
    await testSuite.testDeviceCustomerAssignment();
    await testSuite.testDeviceCredentialsManagement();
  }, 90000);

  // ==================== INTEGRATION & PERFORMANCE ====================
  
  test('should integrate with NPL Engine and Sync Service', async () => {
    await testSuite.testNplEngineIntegration();
  }, 30000);

  test('should perform within acceptable limits', async () => {
    await testSuite.testReadPerformance();
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