/**
 * ThingsBoard Client
 * Handles API integration for syncing NPL events to ThingsBoard
 */

export interface ThingsBoardConfig {
  url: string;
  username: string;
  password: string;
  timeout?: number;
}

export interface ThingsBoardDevice {
  id: string;
  name: string;
  type: string;
  tenantId: string;
  customerId?: string;
  credentials?: string;
  label?: string;
  deviceProfileId?: string;
  firmwareId?: string;
  softwareId?: string;
  externalId?: string;
  version?: number;
  additionalInfo?: any;
  createdTime?: number;
  deviceData?: string;
}

export interface ThingsBoardResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class ThingsBoardClient {
  private config: ThingsBoardConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: ThingsBoardConfig) {
    this.config = {
      timeout: 10000,
      ...config
    };
  }

  /**
   * Authenticate with ThingsBoard and get JWT token
   */
  async authenticate(): Promise<void> {
    try {
      console.log('🔐 Authenticating with ThingsBoard...');
      
      const response = await fetch(`${this.config.url}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password
        }),
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      this.token = data.token;
      this.tokenExpiry = Date.now() + (data.expiresIn || 3600) * 1000;
      
      console.log('✅ ThingsBoard authentication successful');
    } catch (error) {
      console.error('❌ ThingsBoard authentication failed:', error);
      throw error;
    }
  }

  /**
   * Check if token is valid and refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.token || Date.now() >= this.tokenExpiry - 60000) { // Refresh 1 minute before expiry
      await this.authenticate();
    }
  }

  /**
   * Create a device in ThingsBoard
   */
  async createDevice(device: ThingsBoardDevice): Promise<ThingsBoardResponse> {
    try {
      await this.ensureValidToken();

      console.log(`📱 Creating device in ThingsBoard: ${device.name}`);
      
      const response = await fetch(`${this.config.url}/api/device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: device.name,
          type: device.type,
          label: device.label,
          deviceProfileId: device.deviceProfileId,
          firmwareId: device.firmwareId,
          softwareId: device.softwareId,
          externalId: device.externalId,
          additionalInfo: device.additionalInfo
        }),
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device creation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as any;
      console.log(`✅ Device created successfully: ${data.id}`);
      
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('❌ Device creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update a device in ThingsBoard
   */
  async updateDevice(deviceId: string, device: Partial<ThingsBoardDevice>): Promise<ThingsBoardResponse> {
    try {
      await this.ensureValidToken();

      console.log(`📱 Updating device in ThingsBoard: ${deviceId}`);
      
      const response = await fetch(`${this.config.url}/api/device/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: device.name,
          type: device.type,
          label: device.label,
          deviceProfileId: device.deviceProfileId,
          firmwareId: device.firmwareId,
          softwareId: device.softwareId,
          externalId: device.externalId,
          additionalInfo: device.additionalInfo
        }),
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device update failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as any;
      console.log(`✅ Device updated successfully: ${deviceId}`);
      
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('❌ Device update failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a device from ThingsBoard
   */
  async deleteDevice(deviceId: string): Promise<ThingsBoardResponse> {
    try {
      await this.ensureValidToken();

      console.log(`📱 Deleting device from ThingsBoard: ${deviceId}`);
      
      const response = await fetch(`${this.config.url}/api/device/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device deletion failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log(`✅ Device deleted successfully: ${deviceId}`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('❌ Device deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Assign a device to a customer in ThingsBoard
   */
  async assignDeviceToCustomer(deviceId: string, customerId: string): Promise<ThingsBoardResponse> {
    try {
      await this.ensureValidToken();

      console.log(`📱 Assigning device ${deviceId} to customer ${customerId}`);
      
      const response = await fetch(`${this.config.url}/api/customer/${customerId}/device/${deviceId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device assignment failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log(`✅ Device assigned successfully: ${deviceId} -> ${customerId}`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('❌ Device assignment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unassign a device from a customer in ThingsBoard
   */
  async unassignDeviceFromCustomer(deviceId: string, customerId: string): Promise<ThingsBoardResponse> {
    try {
      await this.ensureValidToken();

      console.log(`📱 Unassigning device ${deviceId} from customer ${customerId}`);
      
      const response = await fetch(`${this.config.url}/api/customer/${customerId}/device/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device unassignment failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log(`✅ Device unassigned successfully: ${deviceId} <- ${customerId}`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('❌ Device unassignment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get device by ID from ThingsBoard
   */
  async getDevice(deviceId: string): Promise<ThingsBoardResponse> {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${this.config.url}/api/device/${deviceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device retrieval failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('❌ Device retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test connection to ThingsBoard
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      console.log('✅ ThingsBoard connection test successful');
      return true;
    } catch (error) {
      console.error('❌ ThingsBoard connection test failed:', error);
      return false;
    }
  }
} 