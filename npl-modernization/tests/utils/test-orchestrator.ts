import axios from 'axios';

export interface TestServiceConfig {
  thingsBoardUrl: string;
  nplEngineUrl: string;
  nplReadModelUrl: string;
  nplProxyUrl: string;
  syncServiceUrl: string;
  credentials: {
    username: string;
    password: string;
  };
  sysadminCredentials: {
    username: string;
    password: string;
  };
}

// Safe error serialization utility to avoid circular references
function serializeError(error: any): string {
  try {
    if (error?.response) {
      return `HTTP ${error.response.status}: ${error.response.statusText} - ${error.response.data?.message || error.message || 'Unknown error'}`;
    }
    return error?.message || String(error);
  } catch {
    return 'Unknown error (failed to serialize)';
  }
}

export class TestOrchestrator {
  private config: TestServiceConfig;

  constructor() {
    this.config = {
      thingsBoardUrl: process.env.TB_URL || 'http://localhost:9090',
      nplEngineUrl: process.env.NPL_ENGINE_URL || 'http://localhost:12000',
      nplReadModelUrl: process.env.NPL_READ_MODEL_URL || 'http://localhost:5001',
      nplProxyUrl: process.env.NPL_PROXY_URL || 'http://localhost:8081',
      syncServiceUrl: process.env.SYNC_SERVICE_URL || 'http://localhost:3001',
      credentials: {
        username: process.env.TB_USERNAME || 'tenant@thingsboard.org',
        password: process.env.TB_PASSWORD || 'tenant'
      },
      sysadminCredentials: {
        username: process.env.TB_SYSADMIN_USERNAME || 'sysadmin@thingsboard.org',
        password: process.env.TB_SYSADMIN_PASSWORD || 'sysadmin'
      }
    };
  }

  async checkServicesHealth(): Promise<void> {
    console.log('🔍 Checking service health...');
    
    const services = [
      { name: 'ThingsBoard', url: `${this.config.thingsBoardUrl}/api/auth/login` },
      { name: 'NPL Engine', url: `${this.config.nplEngineUrl}/actuator/health` },
      { name: 'NPL Read Model', url: `${this.config.nplReadModelUrl}/health` },
      { name: 'NPL Proxy', url: `${this.config.nplProxyUrl}/health` }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(service.url, { timeout: 5000 });
        if (response.status === 200 || response.status === 401) { // 401 is OK for auth endpoints
          console.log(`✅ ${service.name} is healthy`);
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          console.log(`✅ ${service.name} is healthy (auth endpoint)`);
        } else {
          console.warn(`⚠️ ${service.name} health check failed: ${error.message}`);
        }
      }
    }

    console.log('✅ Service health check completed');
  }

  async cleanupTestData(): Promise<void> {
    console.log('🧹 Cleaning up test data...');
    
    try {
      // Get auth token for cleanup - use sysadmin for tenant operations
      const token = await this.authenticateAsSysadmin();
      
      // Clean up test devices
      const devicesResponse = await axios.get(`${this.config.thingsBoardUrl}/api/tenant/devices`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { pageSize: 100, page: 0 }
      });

      for (const device of devicesResponse.data.data || []) {
        if (device.name && device.name.startsWith('test-')) {
          try {
            await axios.delete(`${this.config.thingsBoardUrl}/api/device/${device.id.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`🗑️ Cleaned up test device: ${device.name}`);
          } catch (error) {
            console.warn(`⚠️ Failed to cleanup device ${device.name}: ${error}`);
          }
        }
      }

      // Clean up test tenants
      const tenantsResponse = await axios.get(`${this.config.thingsBoardUrl}/api/tenants`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { pageSize: 100, page: 0 }
      });

      for (const tenant of tenantsResponse.data.data || []) {
        if (tenant.title && tenant.title.startsWith('Test Tenant')) {
          try {
            await axios.delete(`${this.config.thingsBoardUrl}/api/tenant/${tenant.id.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`🗑️ Cleaned up test tenant: ${tenant.title}`);
          } catch (error) {
            console.warn(`⚠️ Failed to cleanup tenant ${tenant.title}: ${error}`);
          }
        }
      }

      console.log('✅ Test data cleanup completed');
    } catch (error) {
      console.warn('⚠️ Test data cleanup failed (this is normal if no test data exists):', error);
    }
  }

  getConfig(): TestServiceConfig {
    return this.config;
  }

  async authenticateWithThingsBoard(): Promise<string> {
    console.log('🔐 Authenticating with ThingsBoard...');
    
    try {
      const response = await axios.post(`${this.config.thingsBoardUrl}/api/auth/login`, {
        username: this.config.credentials.username,
        password: this.config.credentials.password
      });

      const token = response.data.token;
      console.log('✅ Authentication successful');
      return token;
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with ThingsBoard');
    }
  }

  async authenticateAsSysadmin(): Promise<string> {
    console.log('🔐 Authenticating with ThingsBoard as Sysadmin...');
    
    try {
      const response = await axios.post(`${this.config.thingsBoardUrl}/api/auth/login`, {
        username: this.config.sysadminCredentials.username,
        password: this.config.sysadminCredentials.password
      });

      const token = response.data.token;
      console.log('✅ Sysadmin authentication successful');
      return token;
    } catch (error: any) {
      console.error('❌ Sysadmin authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate as sysadmin with ThingsBoard');
    }
  }

  async waitForSync(deviceId: string, timeout: number = 30000): Promise<void> {
    console.log(`⏳ Waiting for device ${deviceId} to sync...`);
    
    const startTime = Date.now();
    const token = await this.authenticateWithThingsBoard();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(`${this.config.thingsBoardUrl}/api/device/${deviceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 200) {
          console.log(`✅ Device ${deviceId} synced successfully`);
          return;
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(`⏳ Device ${deviceId} not found yet, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`Timeout waiting for device ${deviceId} to sync`);
  }

  async waitForTenantSync(tenantId: string, timeout: number = 30000): Promise<void> {
    console.log(`⏳ Waiting for tenant ${tenantId} to sync...`);
    
    const startTime = Date.now();
    const token = await this.authenticateAsSysadmin();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(`${this.config.thingsBoardUrl}/api/tenant/${tenantId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 200) {
          console.log(`✅ Tenant ${tenantId} synced successfully`);
          return;
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(`⏳ Tenant ${tenantId} not found yet, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`Timeout waiting for tenant ${tenantId} to sync`);
  }
}

export const testOrchestrator = new TestOrchestrator();
