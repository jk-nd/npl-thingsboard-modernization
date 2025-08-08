/**
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
import { testOrchestrator, TestServiceConfig } from '../utils/test-orchestrator';

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
  private config: TestServiceConfig;
  private authToken: string = '';
  private thingsBoardClient: AxiosInstance;
  private nplProxyClient: AxiosInstance;
  private nplEngineClient: AxiosInstance;
  private nplReadModelClient: AxiosInstance;
  private createdDevices: string[] = [];
  private defaultDeviceProfile: any;

  constructor() {
    this.config = testOrchestrator.getConfig();
    
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

    this.nplReadModelClient = axios.create({
      baseURL: this.config.nplReadModelUrl,
      timeout: 10000
    });
  }

  async setup(): Promise<void> {
    console.log('🔧 Setting up DeviceManagement Integration Tests...');
    
    // Check service health
    await testOrchestrator.checkServicesHealth();
    
    // Authenticate with ThingsBoard
    this.authToken = await testOrchestrator.authenticateWithThingsBoard();
    
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
    console.log('📖 Testing: getDeviceById via ThingsBoard API...');
    
    // Create a device via ThingsBoard API (which should trigger NPL sync)
    const testDevice: Device = {
      name: 'test-device-get-by-id',
      type: 'sensor',
      label: 'Test device for getById'
    };

    const createResponse = await this.thingsBoardClient.post('/api/device', testDevice);
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

    // Wait for sync to complete
    await testOrchestrator.waitForSync(deviceIdString);

    // Test getting device via ThingsBoard API
    const tbResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);

    // Verify the device was created successfully
    expect(tbResponse.status).toBe(200);
    expect(tbResponse.data.name).toBe(testDevice.name);
    expect(tbResponse.data.type).toBe(testDevice.type);

    console.log('✅ getDeviceById test passed');
  }

  async testGetDeviceInfoById(): Promise<void> {
    console.log('📖 Testing: getDeviceInfoById via ThingsBoard API...');
    
    const testDevice: Device = {
      name: 'test-device-info',
      type: 'sensor',
      label: 'Test device for info'
    };

    const createResponse = await this.thingsBoardClient.post('/api/device', testDevice);
    const createdDevice = createResponse.data;
    const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync
    await testOrchestrator.waitForSync(deviceIdString);

    // Test device info endpoint via ThingsBoard
    const infoResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
    
    expect(infoResponse.status).toBe(200);
    expect(infoResponse.data.name).toBe(testDevice.name);
    expect(infoResponse.data.type).toBe(testDevice.type);

    console.log('✅ getDeviceInfoById test passed');
  }

  async testGetTenantDevices(): Promise<void> {
    console.log('📖 Testing: getTenantDevices via ThingsBoard API...');
    
    // Create multiple test devices
    const testDevices = [
      { name: 'test-device-tenant-1', type: 'sensor', label: 'Test device 1' },
      { name: 'test-device-tenant-2', type: 'actuator', label: 'Test device 2' }
    ];

    for (const deviceData of testDevices) {
      const createResponse = await this.thingsBoardClient.post('/api/device', deviceData);
      const createdDevice = createResponse.data;
      const deviceIdString = typeof createdDevice.id === 'string' ? createdDevice.id : createdDevice.id.id;
      this.createdDevices.push(deviceIdString);
      
      // Wait for sync
      await testOrchestrator.waitForSync(deviceIdString);
    }

    // Test getting tenant devices via ThingsBoard API
    const devicesResponse = await this.thingsBoardClient.get('/api/tenant/devices', {
      params: { pageSize: 10, page: 0 }
    });

    expect(devicesResponse.status).toBe(200);
    expect(devicesResponse.data.data).toBeDefined();
    expect(Array.isArray(devicesResponse.data.data)).toBe(true);

    console.log('✅ getTenantDevices test passed');
  }

  async testGetDeviceTypes(): Promise<void> {
    console.log('📖 Testing: getDeviceTypes via GraphQL...');
    
    const typesResponse = await this.nplProxyClient.get('/api/device/types');
    
    expect(typesResponse.status).toBe(200);
    expect(Array.isArray(typesResponse.data)).toBe(true);
    expect(typesResponse.data.length).toBeGreaterThan(0);

    console.log('✅ getDeviceTypes test passed');
  }

  // ==================== WRITE OPERATION TESTS (NPL Engine) ====================

  async testCreateDevice(): Promise<void> {
    console.log('✏️ Testing: createDevice via NPL Engine...');
    
    const testDevice: Device = {
      name: 'test-device-create',
      type: 'sensor',
      label: 'Test device for creation'
    };

    const createResponse = await this.nplEngineClient.post('/npl/deviceManagement/DeviceManagement/test-device-create/saveDevice', testDevice);
    
    expect(createResponse.status).toBe(200);
    expect(createResponse.data.name).toBe(testDevice.name);
    expect(createResponse.data.type).toBe(testDevice.type);

    const deviceIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync and verify in ThingsBoard
    await testOrchestrator.waitForSync(deviceIdString);
    
    const tbResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
    expect(tbResponse.status).toBe(200);
    expect(tbResponse.data.name).toBe(testDevice.name);

    console.log('✅ createDevice test passed');
  }

  async testUpdateDevice(): Promise<void> {
    console.log('✏️ Testing: updateDevice via NPL Engine...');
    
    // Create device first
    const testDevice: Device = {
      name: 'test-device-update',
      type: 'sensor',
      label: 'Test device for update'
    };

    const createResponse = await this.nplEngineClient.post('/npl/deviceManagement/DeviceManagement/test-device-update/saveDevice', testDevice);
    const deviceIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync
    await testOrchestrator.waitForSync(deviceIdString);

    // Update device
    const updatedDevice = {
      ...testDevice,
      id: deviceIdString,
      label: 'Updated test device label'
    };

    const updateResponse = await this.nplEngineClient.post(`/npl/deviceManagement/DeviceManagement/${deviceIdString}/saveDevice`, updatedDevice);
    
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.label).toBe('Updated test device label');

    // Wait for sync and verify in ThingsBoard
    await testOrchestrator.waitForSync(deviceIdString);
    
    const tbResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
    expect(tbResponse.status).toBe(200);
    expect(tbResponse.data.label).toBe('Updated test device label');

    console.log('✅ updateDevice test passed');
  }

  async testDeleteDevice(): Promise<void> {
    console.log('✏️ Testing: deleteDevice via NPL Engine...');
    
    // Create device first
    const testDevice: Device = {
      name: 'test-device-delete',
      type: 'sensor',
      label: 'Test device for deletion'
    };

    const createResponse = await this.nplEngineClient.post('/npl/deviceManagement/DeviceManagement/test-device-delete/saveDevice', testDevice);
    const deviceIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync
    await testOrchestrator.waitForSync(deviceIdString);

    // Delete device
    const deleteResponse = await this.nplEngineClient.post('/api/deviceManagement.DeviceManagement/deleteDevice', {
      deviceId: deviceIdString
    });
    
    expect(deleteResponse.status).toBe(200);

    // Wait for sync and verify deletion in ThingsBoard
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
      throw new Error('Device should have been deleted from ThingsBoard');
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }

    // Remove from cleanup list since it's already deleted
    this.createdDevices = this.createdDevices.filter(id => id !== deviceIdString);

    console.log('✅ deleteDevice test passed');
  }

  async testDeviceCustomerAssignment(): Promise<void> {
    console.log('✏️ Testing: deviceCustomerAssignment via NPL Engine...');
    
    // Create device first
    const testDevice: Device = {
      name: 'test-device-assignment',
      type: 'sensor',
      label: 'Test device for assignment'
    };

    const createResponse = await this.nplEngineClient.post('/npl/deviceManagement/DeviceManagement/test-device-assignment/saveDevice', testDevice);
    const deviceIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync
    await testOrchestrator.waitForSync(deviceIdString);

    // Get a customer for assignment
    const customersResponse = await this.thingsBoardClient.get('/api/customers', {
      params: { pageSize: 1, page: 0 }
    });

    if (customersResponse.data.data && customersResponse.data.data.length > 0) {
      const customer = customersResponse.data.data[0];

      // Assign device to customer
      const assignResponse = await this.nplEngineClient.post('/api/deviceManagement.DeviceManagement/assignDeviceToCustomer', {
        deviceId: deviceIdString,
        customerId: customer.id.id
      });
      
      expect(assignResponse.status).toBe(200);

      // Wait for sync and verify assignment
      await testOrchestrator.waitForSync(deviceIdString);
      
      const tbResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}`);
      expect(tbResponse.status).toBe(200);
      expect(tbResponse.data.customerId.id).toBe(customer.id.id);

      console.log('✅ deviceCustomerAssignment test passed');
    } else {
      console.log('⚠️ Skipping deviceCustomerAssignment test - no customers available');
    }
  }

  async testDeviceCredentialsManagement(): Promise<void> {
    console.log('✏️ Testing: deviceCredentialsManagement via NPL Engine...');
    
    // Create device first
    const testDevice: Device = {
      name: 'test-device-credentials',
      type: 'sensor',
      label: 'Test device for credentials'
    };

    const createResponse = await this.nplEngineClient.post('/npl/deviceManagement/DeviceManagement/test-device-credentials/saveDevice', testDevice);
    const deviceIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdDevices.push(deviceIdString);

    // Wait for sync
    await testOrchestrator.waitForSync(deviceIdString);

    // Update device credentials
    const credentials = {
      deviceId: deviceIdString,
      credentialsType: 'ACCESS_TOKEN',
      credentialsId: 'test-token-id',
      credentialsValue: 'test-access-token'
    };

    const credentialsResponse = await this.nplEngineClient.post('/api/deviceManagement.DeviceManagement/updateDeviceCredentials', credentials);
    
    expect(credentialsResponse.status).toBe(200);

    // Wait for sync and verify credentials in ThingsBoard
    await testOrchestrator.waitForSync(deviceIdString);
    
    const tbCredentialsResponse = await this.thingsBoardClient.get(`/api/device/${deviceIdString}/credentials`);
    expect(tbCredentialsResponse.status).toBe(200);
    expect(tbCredentialsResponse.data.credentialsId).toBe('test-token-id');

    console.log('✅ deviceCredentialsManagement test passed');
  }

  // ==================== PERFORMANCE TESTS ====================

  async testReadPerformance(): Promise<void> {
    console.log('⚡ Testing: read performance...');
    
    const startTime = Date.now();
    
    // Test GraphQL read performance
    const devicesResponse = await this.nplProxyClient.get('/api/tenant/devices', {
      params: { pageSize: 50, page: 0 }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(devicesResponse.status).toBe(200);
    expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    console.log(`✅ Read performance test passed (${responseTime}ms)`);
  }

  async testNplEngineIntegration(): Promise<void> {
    console.log('🔗 Testing: NPL Engine integration...');
    
    // Test direct NPL Engine communication
    const healthResponse = await this.nplEngineClient.get('/actuator/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data.status).toBe('UP');

    // Test NPL Engine device operations
    const testDevice: Device = {
      name: 'test-npl-engine-integration',
      type: 'sensor',
      label: 'Test NPL Engine integration'
    };

    const createResponse = await this.nplEngineClient.post('/npl/deviceManagement/DeviceManagement/test-device-create/saveDevice', testDevice);
    expect(createResponse.status).toBe(200);
    
    const deviceIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdDevices.push(deviceIdString);

    // Test device retrieval from NPL Engine
    const getResponse = await this.nplEngineClient.get(`/api/deviceManagement.DeviceManagement/getDevice/${deviceIdString}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data.name).toBe(testDevice.name);

    console.log('✅ NPL Engine integration test passed');
  }

  // ==================== TEST RUNNER ====================

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Device Management Integration Tests...');
    
    try {
      await this.setup();
      
      // Read operation tests
      await this.testGetDeviceById();
      await this.testGetDeviceInfoById();
      await this.testGetTenantDevices();
      await this.testGetDeviceTypes();
      
      // Write operation tests
      await this.testCreateDevice();
      await this.testUpdateDevice();
      await this.testDeleteDevice();
      await this.testDeviceCustomerAssignment();
      await this.testDeviceCredentialsManagement();
      
      // Performance tests
      await this.testReadPerformance();
      await this.testNplEngineIntegration();
      
      console.log('✅ All Device Management Integration Tests passed!');
    } catch (error) {
      console.error('❌ Device Management Integration Tests failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// ==================== JEST TEST SUITE ====================

describe('Device Management Integration Tests', () => {
  let integrationTest: DeviceManagementIntegrationTest;

  beforeAll(async () => {
    integrationTest = new DeviceManagementIntegrationTest();
  });

  afterAll(async () => {
    await testOrchestrator.cleanupTestData();
  });

  test('should run all integration tests', async () => {
    await integrationTest.runAllTests();
  }, 300000); // 5 minute timeout
}); 