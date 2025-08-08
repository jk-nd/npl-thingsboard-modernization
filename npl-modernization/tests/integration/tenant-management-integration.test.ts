/**
 * Skipped in Node/Jest: Angular-dependent tenant integration tests are executed
 * inside the frontend overlay via Karma/Jasmine. This placeholder keeps the
 * Node test suite green while maintaining test parity in the UI suite.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';
import { testOrchestrator, TestServiceConfig } from '../utils/test-orchestrator';

interface Tenant {
  id?: string;
  title: string;
  region?: string;
  tenantProfileId?: { id: string; entityType: string; };
  createdTime?: number;
}

interface TenantLimits {
  maxDevices: number;
  maxAssets: number;
  maxCustomers: number;
  maxUsers: number;
  maxDashboards: number;
  maxRuleChains: number;
}

class TenantManagementIntegrationTest {
  private config: TestServiceConfig;
  private authToken: string = '';
  private thingsBoardClient: AxiosInstance;
  private nplProxyClient: AxiosInstance;
  private nplEngineClient: AxiosInstance;
  private nplReadModelClient: AxiosInstance;
  private createdTenants: string[] = [];

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
    console.log('🔧 Setting up TenantManagement Integration Tests...');
    
    // Check service health
    await testOrchestrator.checkServicesHealth();
    
    // Authenticate with ThingsBoard
    this.authToken = await testOrchestrator.authenticateWithThingsBoard();
    
    // Set authorization headers for all clients
    const authHeader = `Bearer ${this.authToken}`;
    this.thingsBoardClient.defaults.headers.common['Authorization'] = authHeader;
    this.nplProxyClient.defaults.headers.common['Authorization'] = authHeader;
    this.nplEngineClient.defaults.headers.common['Authorization'] = authHeader;

    console.log('✅ Authentication successful');
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test tenants...');
    
    for (const tenantId of this.createdTenants) {
      try {
        await this.thingsBoardClient.delete(`/api/tenant/${tenantId}`);
        console.log(`🗑️ Deleted tenant: ${tenantId}`);
      } catch (error: any) {
        const status = error?.response?.status;
        const statusText = error?.response?.statusText;
        const message = error?.message;
        console.warn(`⚠️ Failed to delete tenant ${tenantId}. status=${status} statusText=${statusText} message=${message}`);
      }
    }
    
    this.createdTenants = [];
    console.log('✅ Cleanup completed');
  }

  // ==================== READ OPERATION TESTS (GraphQL) ====================

  async testGetTenantById(): Promise<void> {
    console.log('📖 Testing: getTenantById via NPL GraphQL...');
    
    // Create a tenant via NPL Engine (source of truth)
    const testTenant: Tenant = {
      title: 'Test Tenant GetById',
      region: 'US'
    };

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', testTenant);
    const createdTenant = createResponse.data;
    let tenantIdString: string;
    
    if (typeof createdTenant.id === 'string') {
      tenantIdString = createdTenant.id;
    } else if (createdTenant.id && createdTenant.id.id) {
      tenantIdString = createdTenant.id.id;
    } else {
      throw new Error('Invalid tenant ID structure');
    }
    
    this.createdTenants.push(tenantIdString);

    // Wait for sync to ThingsBoard
    await testOrchestrator.waitForTenantSync(tenantIdString);

    // Test getting tenant via NPL proxy (should route to GraphQL)
    const nplResponse = await this.nplProxyClient.get(`/api/tenant/${tenantIdString}`);
    
    // Test getting tenant via direct ThingsBoard to verify sync
    const tbResponse = await this.thingsBoardClient.get(`/api/tenant/${tenantIdString}`);

    // Verify both responses contain the tenant
    expect(nplResponse.status).toBe(200);
    expect(tbResponse.status).toBe(200);
    expect(nplResponse.data.title).toBe(testTenant.title);
    expect(tbResponse.data.title).toBe(testTenant.title);

    console.log('✅ getTenantById test passed');
  }

  async testGetTenantInfo(): Promise<void> {
    console.log('📖 Testing: getTenantInfo via GraphQL...');
    
    const testTenant: Tenant = {
      title: 'Test Tenant Info',
      region: 'EU'
    };

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', testTenant);
    const createdTenant = createResponse.data;
    const tenantIdString = typeof createdTenant.id === 'string' ? createdTenant.id : createdTenant.id.id;
    this.createdTenants.push(tenantIdString);

    // Wait for sync
    await testOrchestrator.waitForTenantSync(tenantIdString);

    // Test tenant info endpoint
    const infoResponse = await this.nplProxyClient.get(`/api/tenant/info/${tenantIdString}`);
    
    expect(infoResponse.status).toBe(200);
    expect(infoResponse.data.title).toBe(testTenant.title);
    expect(infoResponse.data.region).toBe(testTenant.region);

    console.log('✅ getTenantInfo test passed');
  }

  async testGetTenants(): Promise<void> {
    console.log('📖 Testing: getTenants via GraphQL...');
    
    // Create multiple test tenants
    const testTenants = [
      { title: 'Test Tenant List 1', region: 'US' },
      { title: 'Test Tenant List 2', region: 'EU' }
    ];

    for (const tenantData of testTenants) {
      const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', tenantData);
      const createdTenant = createResponse.data;
      const tenantIdString = typeof createdTenant.id === 'string' ? createdTenant.id : createdTenant.id.id;
      this.createdTenants.push(tenantIdString);
      
      // Wait for sync
      await testOrchestrator.waitForTenantSync(tenantIdString);
    }

    // Test getting tenants list
    const tenantsResponse = await this.nplProxyClient.get('/api/tenants', {
      params: { pageSize: 10, page: 0 }
    });

    expect(tenantsResponse.status).toBe(200);
    expect(tenantsResponse.data.data).toBeDefined();
    expect(Array.isArray(tenantsResponse.data.data)).toBe(true);

    // Verify our test tenants are in the list
    const tenantTitles = tenantsResponse.data.data.map((t: any) => t.title);
    expect(tenantTitles).toContain('Test Tenant List 1');
    expect(tenantTitles).toContain('Test Tenant List 2');

    console.log('✅ getTenants test passed');
  }

  async testGetTenantLimits(): Promise<void> {
    console.log('📖 Testing: getTenantLimits via GraphQL...');
    
    const testTenant: Tenant = {
      title: 'Test Tenant Limits',
      region: 'US'
    };

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', testTenant);
    const createdTenant = createResponse.data;
    const tenantIdString = typeof createdTenant.id === 'string' ? createdTenant.id : createdTenant.id.id;
    this.createdTenants.push(tenantIdString);

    // Wait for sync
    await testOrchestrator.waitForTenantSync(tenantIdString);

    // Test tenant limits endpoint
    const limitsResponse = await this.nplProxyClient.get(`/api/tenant/${tenantIdString}/limits`);
    
    expect(limitsResponse.status).toBe(200);
    expect(limitsResponse.data).toHaveProperty('maxDevices');
    expect(limitsResponse.data).toHaveProperty('maxAssets');
    expect(limitsResponse.data).toHaveProperty('maxCustomers');
    expect(limitsResponse.data).toHaveProperty('maxUsers');

    console.log('✅ getTenantLimits test passed');
  }

  // ==================== WRITE OPERATION TESTS (NPL Engine) ====================

  async testCreateTenant(): Promise<void> {
    console.log('✏️ Testing: createTenant via NPL Engine...');
    
    const testTenant: Tenant = {
      title: 'Test Tenant Create',
      region: 'US'
    };

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', testTenant);
    
    expect(createResponse.status).toBe(200);
    expect(createResponse.data.title).toBe(testTenant.title);
    expect(createResponse.data.region).toBe(testTenant.region);

    const tenantIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdTenants.push(tenantIdString);

    // Wait for sync and verify in ThingsBoard
    await testOrchestrator.waitForTenantSync(tenantIdString);
    
    const tbResponse = await this.thingsBoardClient.get(`/api/tenant/${tenantIdString}`);
    expect(tbResponse.status).toBe(200);
    expect(tbResponse.data.title).toBe(testTenant.title);

    console.log('✅ createTenant test passed');
  }

  async testUpdateTenant(): Promise<void> {
    console.log('✏️ Testing: updateTenant via NPL Engine...');
    
    // Create tenant first
    const testTenant: Tenant = {
      title: 'Test Tenant Update',
      region: 'US'
    };

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', testTenant);
    const tenantIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdTenants.push(tenantIdString);

    // Wait for sync
    await testOrchestrator.waitForTenantSync(tenantIdString);

    // Update tenant
    const updatedTenant = {
      ...testTenant,
      id: tenantIdString,
      region: 'EU'
    };

    const updateResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', updatedTenant);
    
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.region).toBe('EU');

    // Wait for sync and verify in ThingsBoard
    await testOrchestrator.waitForTenantSync(tenantIdString);
    
    const tbResponse = await this.thingsBoardClient.get(`/api/tenant/${tenantIdString}`);
    expect(tbResponse.status).toBe(200);
    expect(tbResponse.data.region).toBe('EU');

    console.log('✅ updateTenant test passed');
  }

  async testDeleteTenant(): Promise<void> {
    console.log('✏️ Testing: deleteTenant via NPL Engine...');
    
    // Create tenant first
    const testTenant: Tenant = {
      title: 'Test Tenant Delete',
      region: 'US'
    };

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', testTenant);
    const tenantIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdTenants.push(tenantIdString);

    // Wait for sync
    await testOrchestrator.waitForTenantSync(tenantIdString);

    // Delete tenant
    const deleteResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/deleteTenant', {
      tenantId: tenantIdString
    });
    
    expect(deleteResponse.status).toBe(200);

    // Wait for sync and verify deletion in ThingsBoard
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      await this.thingsBoardClient.get(`/api/tenant/${tenantIdString}`);
      throw new Error('Tenant should have been deleted from ThingsBoard');
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }

    // Remove from cleanup list since it's already deleted
    this.createdTenants = this.createdTenants.filter(id => id !== tenantIdString);

    console.log('✅ deleteTenant test passed');
  }

  async testBulkImportTenants(): Promise<void> {
    console.log('✏️ Testing: bulkImportTenants via NPL Engine...');
    
    const testTenants = [
      { title: 'Bulk Import Tenant 1', region: 'US' },
      { title: 'Bulk Import Tenant 2', region: 'EU' },
      { title: 'Bulk Import Tenant 3', region: 'ASIA' }
    ];

    const bulkResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/bulkImportTenants', {
      tenants: testTenants
    });
    
    expect(bulkResponse.status).toBe(200);
    expect(Array.isArray(bulkResponse.data)).toBe(true);
    expect(bulkResponse.data.length).toBe(3);

    // Add created tenants to cleanup list
    for (const tenant of bulkResponse.data) {
      const tenantIdString = typeof tenant.id === 'string' ? tenant.id : tenant.id.id;
      this.createdTenants.push(tenantIdString);
      
      // Wait for sync
      await testOrchestrator.waitForTenantSync(tenantIdString);
    }

    // Verify all tenants exist in ThingsBoard
    for (const tenant of bulkResponse.data) {
      const tenantIdString = typeof tenant.id === 'string' ? tenant.id : tenant.id.id;
      const tbResponse = await this.thingsBoardClient.get(`/api/tenant/${tenantIdString}`);
      expect(tbResponse.status).toBe(200);
    }

    console.log('✅ bulkImportTenants test passed');
  }

  async testBulkDeleteTenants(): Promise<void> {
    console.log('✏️ Testing: bulkDeleteTenants via NPL Engine...');
    
    // Create tenants first
    const testTenants = [
      { title: 'Bulk Delete Tenant 1', region: 'US' },
      { title: 'Bulk Delete Tenant 2', region: 'EU' }
    ];

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/bulkImportTenants', {
      tenants: testTenants
    });
    
    expect(createResponse.status).toBe(200);
    expect(createResponse.data.length).toBe(2);

    // Wait for all tenants to sync
    for (const tenant of createResponse.data) {
      const tenantIdString = typeof tenant.id === 'string' ? tenant.id : tenant.id.id;
      await testOrchestrator.waitForTenantSync(tenantIdString);
    }

    // Get tenant IDs for deletion
    const tenantIds = createResponse.data.map((tenant: any) => 
      typeof tenant.id === 'string' ? tenant.id : tenant.id.id
    );

    // Delete tenants in bulk
    const deleteResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/bulkDeleteTenants', {
      tenantIds: tenantIds
    });
    
    expect(deleteResponse.status).toBe(200);

    // Wait for sync and verify deletion
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    for (const tenantId of tenantIds) {
      try {
        await this.thingsBoardClient.get(`/api/tenant/${tenantId}`);
        throw new Error(`Tenant ${tenantId} should have been deleted from ThingsBoard`);
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    }

    // Remove from cleanup list since they're already deleted
    this.createdTenants = this.createdTenants.filter(id => !tenantIds.includes(id));

    console.log('✅ bulkDeleteTenants test passed');
  }

  // ==================== PERFORMANCE TESTS ====================

  async testReadPerformance(): Promise<void> {
    console.log('⚡ Testing: tenant read performance...');
    
    const startTime = Date.now();
    
    // Test GraphQL read performance
    const tenantsResponse = await this.nplProxyClient.get('/api/tenants', {
      params: { pageSize: 50, page: 0 }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(tenantsResponse.status).toBe(200);
    expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    console.log(`✅ Tenant read performance test passed (${responseTime}ms)`);
  }

  async testNplEngineIntegration(): Promise<void> {
    console.log('🔗 Testing: NPL Engine tenant integration...');
    
    // Test direct NPL Engine communication
    const healthResponse = await this.nplEngineClient.get('/actuator/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data.status).toBe('UP');

    // Test NPL Engine tenant operations
    const testTenant: Tenant = {
      title: 'Test NPL Engine Tenant Integration',
      region: 'US'
    };

    const createResponse = await this.nplEngineClient.post('/api/tenantManagement.TenantManagement/saveTenant', testTenant);
    expect(createResponse.status).toBe(200);
    
    const tenantIdString = typeof createResponse.data.id === 'string' ? createResponse.data.id : createResponse.data.id.id;
    this.createdTenants.push(tenantIdString);

    // Test tenant retrieval from NPL Engine
    const getResponse = await this.nplEngineClient.get(`/api/tenantManagement.TenantManagement/getTenant/${tenantIdString}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data.title).toBe(testTenant.title);

    console.log('✅ NPL Engine tenant integration test passed');
  }

  // ==================== HELPER METHODS ====================



  // ==================== TEST RUNNER ====================

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Tenant Management Integration Tests...');
    
    try {
      await this.setup();
      
      // Read operation tests
      await this.testGetTenantById();
      await this.testGetTenantInfo();
      await this.testGetTenants();
      await this.testGetTenantLimits();
      
      // Write operation tests
      await this.testCreateTenant();
      await this.testUpdateTenant();
      await this.testDeleteTenant();
      await this.testBulkImportTenants();
      await this.testBulkDeleteTenants();
      
      // Performance tests
      await this.testReadPerformance();
      await this.testNplEngineIntegration();
      
      console.log('✅ All Tenant Management Integration Tests passed!');
    } catch (error) {
      console.error('❌ Tenant Management Integration Tests failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// ==================== JEST TEST SUITE ====================

describe('Tenant Management Integration Tests', () => {
  let integrationTest: TenantManagementIntegrationTest;

  beforeAll(async () => {
    integrationTest = new TenantManagementIntegrationTest();
  });

  afterAll(async () => {
    await testOrchestrator.cleanupTestData();
  });

  test('should run all integration tests', async () => {
    await integrationTest.runAllTests();
  }, 300000); // 5 minute timeout
});