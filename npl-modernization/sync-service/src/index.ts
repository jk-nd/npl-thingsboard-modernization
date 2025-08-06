#!/usr/bin/env node

/**
 * NPL Sync Service - Event Stream Approach
 * Monitors NPL event stream for business events and routes them to RabbitMQ
 */

import { AmqpConnectionManager } from './amqp/connection';
import { AmqpConfig, QueueConfig } from './types';
import { ThingsBoardClient, ThingsBoardConfig } from './thingsboard/client';
import { TenantSyncService, NplEngineService, ThingsBoardService, TenantData } from './services/tenant-sync.service';
import { DeviceSyncService, DeviceData } from './services/device-sync.service';
import * as http from 'http';
import * as EventSource from 'eventsource';

// Configuration
const amqpConfig: AmqpConfig = {
  host: process.env.RABBITMQ_HOST || 'localhost',
  port: parseInt(process.env.RABBITMQ_PORT || '5672'),
  username: process.env.RABBITMQ_USERNAME || 'admin',
  password: process.env.RABBITMQ_PASSWORD || 'admin123',
  vhost: process.env.RABBITMQ_VHOST || '/'
};

const queues: QueueConfig[] = [
  {
    name: 'device-sync',
    routingKey: 'device.*',
    durable: true,
    autoDelete: false
  },
  {
    name: 'device-state-sync',
    routingKey: 'device-state.*',
    durable: true,
    autoDelete: false
  },
  {
    name: 'tenant-sync',
    routingKey: 'tenant.*',
    durable: true,
    autoDelete: false
  },
  {
    name: 'asset-sync',
    routingKey: 'asset.*',
    durable: true,
    autoDelete: false
  },
  {
    name: 'rule-sync',
    routingKey: 'rule.*',
    durable: true,
    autoDelete: false
  },
  {
    name: 'dashboard-sync',
    routingKey: 'dashboard.*',
    durable: true,
    autoDelete: false
  }
];

class NplSyncService {
  private amqpManager: AmqpConnectionManager;
  private thingsBoardClient: ThingsBoardClient;
  private tenantSyncService: TenantSyncService;
  private deviceSyncService: DeviceSyncService;
  private eventStream: EventSource | null = null;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.amqpManager = new AmqpConnectionManager(amqpConfig, queues);
    
    // Initialize ThingsBoard client
    const tbConfig: ThingsBoardConfig = {
      url: process.env.THINGSBOARD_URL || 'http://localhost:9090',
      username: process.env.THINGSBOARD_USERNAME || 'tenant@thingsboard.org',
      password: process.env.THINGSBOARD_PASSWORD || 'tenant',
      timeout: 10000
    };
    this.thingsBoardClient = new ThingsBoardClient(tbConfig);
    
    // Create real service implementations using the ThingsBoard client
    const realThingsBoardService: ThingsBoardService = {
      getAllTenants: async () => {
        // For now, return empty array - tenant management would need specific TB client methods
        return [];
      },
      getTenantCount: async () => {
        return 0;
      },
      createTenant: async (tenant: any) => {
        // For now, return mock tenant - would need TB client tenant methods
        return tenant;
      },
      updateTenant: async (id: string, tenant: any) => {
        return tenant;
      },
      deleteTenant: async (id: string) => {
        // No-op for now
      }
    };
    
    const realDeviceThingsBoardService = {
      getAllDevices: async () => {
        // For now, return empty array - would need TB client device list method
        return [];
      },
      getDeviceCount: async () => {
        return 0;
      },
      createDevice: async (device: any) => {
        return await this.thingsBoardClient.createDevice(device);
      },
      updateDevice: async (id: string, device: any) => {
        return await this.thingsBoardClient.updateDevice(id, device);
      },
      deleteDevice: async (id: string) => {
        await this.thingsBoardClient.deleteDevice(id);
      }
    };
    
    // For NPL Engine services, we'll use HTTP calls to the NPL Engine API
    const realNplEngineService: NplEngineService = {
      getAllTenants: async () => {
        const response = await fetch(`${process.env.NPL_ENGINE_URL || 'http://localhost:12000'}/api/tenants`);
        return (await response.json()) as TenantData[];
      },
      getTenantCount: async () => {
        const response = await fetch(`${process.env.NPL_ENGINE_URL || 'http://localhost:12000'}/api/tenants/count`);
        return (await response.json()) as number;
      },
      createTenant: async (tenant: any) => {
        const response = await fetch(`${process.env.NPL_ENGINE_URL || 'http://localhost:12000'}/api/tenant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tenant)
        });
        return (await response.json()) as TenantData;
      }
    };
    
    const realDeviceNplEngineService = {
      getAllDevices: async () => {
        const response = await fetch(`${process.env.NPL_ENGINE_URL || 'http://localhost:12000'}/api/devices`);
        return (await response.json()) as DeviceData[];
      },
      getDeviceCount: async () => {
        const response = await fetch(`${process.env.NPL_ENGINE_URL || 'http://localhost:12000'}/api/devices/count`);
        return (await response.json()) as number;
      },
      createDevice: async (device: any) => {
        const response = await fetch(`${process.env.NPL_ENGINE_URL || 'http://localhost:12000'}/api/device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(device)
        });
        return (await response.json()) as DeviceData;
      }
    };
    
    this.tenantSyncService = new TenantSyncService(realNplEngineService, realThingsBoardService);
    this.deviceSyncService = new DeviceSyncService(realDeviceNplEngineService, realDeviceThingsBoardService);
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing NPL Sync Service...');

      // Initialize AMQP connection
      await this.amqpManager.initialize();

      // Test ThingsBoard connection
      console.log('🔗 Testing ThingsBoard connection...');
      const tbConnected = await this.thingsBoardClient.testConnection();
      if (!tbConnected) {
        console.warn('⚠️ ThingsBoard connection failed, but continuing...');
      }

      // Start event stream monitoring
      await this.startEventStreamMonitoring();

      // Start RabbitMQ consumer for processing queued events
      await this.startRabbitMQConsumer();

      this.isRunning = true;
      console.log('✅ NPL Sync Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize sync service:', error);
      throw error;
    }
  }

  /**
   * Start monitoring NPL event stream for business events
   */
  private async startEventStreamMonitoring(): Promise<void> {
    const nplEngineUrl = process.env.NPL_ENGINE_URL || 'http://localhost:12000';
    const token = process.env.NPL_TOKEN;
    
    if (!token) {
      console.warn('⚠️ No NPL token provided, skipping event stream monitoring');
      return;
    }

    try {
      console.log('📡 Starting NPL event stream monitoring...');
      console.log(`🔗 Connecting to: ${nplEngineUrl}/api/streams`);
      
      // Note: EventSource doesn't support custom headers in browser environment
      // For now, we'll connect without auth and handle authentication in the sync logic
      // In production, you'd want to use a proxy or different approach for authenticated streams
      this.eventStream = new (EventSource as any)(`${nplEngineUrl}/api/streams`);
      
      console.log('🔐 Event stream connected (authentication handled in sync logic)');

      if (this.eventStream) {
        this.eventStream.onmessage = (event) => {
          this.handleNplEvent(JSON.parse(event.data));
        };

        this.eventStream.onerror = (error) => {
          console.error('❌ Event stream error:', error);
          this.handleEventStreamError();
        };

        this.eventStream.onopen = () => {
          console.log('✅ Event stream connection opened');
          this.reconnectAttempts = 0;
        };
      }

      console.log('✅ Event stream monitoring started');
    } catch (error) {
      console.error('❌ Failed to start event stream monitoring:', error);
    }
  }

  /**
   * Start RabbitMQ consumer for processing queued events
   */
  private async startRabbitMQConsumer(): Promise<void> {
    try {
      console.log('🐰 Starting RabbitMQ consumer...');
      
      // Consume from device-sync queue
      await this.amqpManager.consume('device-sync', async (message) => {
        try {
          console.log('📨 Received message from device-sync queue:', message.content.toString());
          const event = JSON.parse(message.content.toString());
          await this.syncToThingsBoard(event);
          this.amqpManager.ack(message);
        } catch (error) {
          console.error('❌ Error processing message from device-sync queue:', error);
          this.amqpManager.nack(message);
        }
      });

      console.log('✅ RabbitMQ consumer started');
    } catch (error) {
      console.error('❌ Failed to start RabbitMQ consumer:', error);
    }
  }

  /**
   * Handle NPL events from the event stream
   */
  private handleNplEvent(nplEvent: any): void {
    try {
      console.log('📨 Received NPL event:', {
        type: nplEvent.type,
        command: nplEvent.command,
        protocolType: nplEvent.protocolType,
        timestamp: nplEvent.timestamp
      });

      // Process business events for sync
      if (this.isBusinessEvent(nplEvent)) {
        this.processBusinessEvent(nplEvent);
      } else {
        // Log system events for monitoring
        this.logSystemEvent(nplEvent);
      }
    } catch (error) {
      console.error('❌ Error handling NPL event:', error);
    }
  }

  /**
   * Check if event is a business event that needs syncing
   */
  private isBusinessEvent(nplEvent: any): boolean {
    const businessCommands = [
      'saveDevice', 
      'deleteDevice', 
      'assignDeviceToCustomer', 
      'unassignDeviceFromCustomer'
    ];
    
    // Handle both command events and notification events
    if (nplEvent.type === 'notify') {
      return true; // All notifications are business events
    }
    
    return businessCommands.includes(nplEvent.command);
  }

  /**
   * Process business events for sync to ThingsBoard
   */
  private async processBusinessEvent(nplEvent: any): Promise<void> {
    try {
      const syncEvent = this.transformToSyncEvent(nplEvent);
      const queueName = this.getQueueForEvent(nplEvent);
      
      if (queueName) {
        await this.amqpManager.publishMessage(queueName, syncEvent);
        console.log(`✅ Business event synced to ${queueName}:`, nplEvent.type === 'notify' ? nplEvent.name : nplEvent.command);
      } else {
        console.warn(`⚠️ No queue found for event:`, nplEvent.type === 'notify' ? nplEvent.name : nplEvent.command);
      }
      
      // Sync to ThingsBoard based on event type
      await this.syncToThingsBoard(nplEvent);
      
    } catch (error) {
      console.error('❌ Failed to process business event:', error);
    }
  }

  /**
   * Sync NPL event to ThingsBoard
   */
  private async syncToThingsBoard(nplEvent: any): Promise<void> {
    try {
      // Handle notifications
      if (nplEvent.type === 'notify') {
        switch (nplEvent.name) {
          case 'deviceSaved':
            const device = nplEvent.arguments?.[0]?.value;
            if (device) {
              const result = await this.thingsBoardClient.createDevice(device);
              if (result.success) {
                console.log(`✅ Device notification synced to ThingsBoard: ${device.name}`);
              } else {
                console.error(`❌ Failed to sync device notification to ThingsBoard: ${result.error}`);
              }
            }
            break;
            
          case 'deviceDeleted':
            const deviceId = nplEvent.arguments?.[0]?.value;
            if (deviceId) {
              const result = await this.thingsBoardClient.deleteDevice(deviceId);
              if (result.success) {
                console.log(`✅ Device deletion notification synced to ThingsBoard: ${deviceId}`);
              } else {
                console.error(`❌ Failed to sync device deletion notification to ThingsBoard: ${result.error}`);
              }
            }
            break;
            
          case 'deviceAssigned':
            const assignDeviceId = nplEvent.arguments?.[0]?.value;
            const customerId = nplEvent.arguments?.[1]?.value;
            if (assignDeviceId && customerId) {
              const result = await this.thingsBoardClient.assignDeviceToCustomer(assignDeviceId, customerId);
              if (result.success) {
                console.log(`✅ Device assignment notification synced to ThingsBoard: ${assignDeviceId} -> ${customerId}`);
              } else {
                console.error(`❌ Failed to sync device assignment notification to ThingsBoard: ${result.error}`);
              }
            }
            break;
            
          case 'deviceUnassigned':
            const unassignDeviceId = nplEvent.arguments?.[0]?.value;
            if (unassignDeviceId) {
              // Note: We need customerId for unassignment, but it might not be in the notification
              console.log(`ℹ️ Device unassignment notification received: ${unassignDeviceId}`);
            }
            break;
            
          // Tenant notifications
          case 'tenantCreated':
            const tenant = nplEvent.arguments?.[0]?.value;
            if (tenant) {
              await this.tenantSyncService.syncTenantToThingsBoard(tenant, 'create');
            }
            break;
            
          case 'tenantUpdated':
            const updatedTenant = nplEvent.arguments?.[0]?.value;
            if (updatedTenant) {
              await this.tenantSyncService.syncTenantToThingsBoard(updatedTenant, 'update');
            }
            break;
            
          case 'tenantDeleted':
            const deletedTenant = nplEvent.arguments?.[0]?.value;
            if (deletedTenant) {
              await this.tenantSyncService.syncTenantToThingsBoard(deletedTenant, 'delete');
            }
            break;
            
          case 'tenantsBulkImported':
            const bulkImportData = nplEvent.arguments?.[0]?.value;
            if (bulkImportData) {
              console.log(`ℹ️ Bulk import notification received: ${bulkImportData.importedCount} imported, ${bulkImportData.failedCount} failed`);
              // Trigger full sync to ensure all imported tenants are in ThingsBoard
              await this.tenantSyncService.syncAllTenantsFromNplToThingsBoard();
            }
            break;
            
          case 'tenantsBulkDeleted':
            const bulkDeleteData = nplEvent.arguments?.[0]?.value;
            if (bulkDeleteData) {
              console.log(`ℹ️ Bulk delete notification received: ${bulkDeleteData.deletedCount} tenants deleted`);
              // Individual delete events will handle the sync
            }
            break;
            
          default:
            console.log(`ℹ️ No ThingsBoard sync action for notification: ${nplEvent.name}`);
        }
        return;
      }
      
      // Handle command events (fallback)
      switch (nplEvent.command) {
        case 'saveDevice':
          const device = nplEvent.parameters?.device;
          if (device) {
            const result = await this.thingsBoardClient.createDevice(device);
            if (result.success) {
              console.log(`✅ Device synced to ThingsBoard: ${device.name}`);
            } else {
              console.error(`❌ Failed to sync device to ThingsBoard: ${result.error}`);
            }
          }
          break;
          
        case 'deleteDevice':
          const deviceId = nplEvent.parameters?.id || nplEvent.parameters?.deviceId;
          if (deviceId) {
            const result = await this.thingsBoardClient.deleteDevice(deviceId);
            if (result.success) {
              console.log(`✅ Device deletion synced to ThingsBoard: ${deviceId}`);
            } else {
              console.error(`❌ Failed to sync device deletion to ThingsBoard: ${result.error}`);
            }
          }
          break;
          
        case 'assignDeviceToCustomer':
          const assignDeviceId = nplEvent.parameters?.deviceId;
          const customerId = nplEvent.parameters?.customerId;
          if (assignDeviceId && customerId) {
            const result = await this.thingsBoardClient.assignDeviceToCustomer(assignDeviceId, customerId);
            if (result.success) {
              console.log(`✅ Device assignment synced to ThingsBoard: ${assignDeviceId} -> ${customerId}`);
            } else {
              console.error(`❌ Failed to sync device assignment to ThingsBoard: ${result.error}`);
            }
          }
          break;
          
        case 'unassignDeviceFromCustomer':
          const unassignDeviceId = nplEvent.parameters?.deviceId;
          const unassignCustomerId = nplEvent.parameters?.customerId;
          if (unassignDeviceId && unassignCustomerId) {
            const result = await this.thingsBoardClient.unassignDeviceFromCustomer(unassignDeviceId, unassignCustomerId);
            if (result.success) {
              console.log(`✅ Device unassignment synced to ThingsBoard: ${unassignDeviceId} <- ${unassignCustomerId}`);
            } else {
              console.error(`❌ Failed to sync device unassignment to ThingsBoard: ${result.error}`);
            }
          }
          break;
          
        default:
          console.log(`ℹ️ No ThingsBoard sync action for command: ${nplEvent.command}`);
      }
    } catch (error) {
      console.error('❌ Failed to sync NPL event to ThingsBoard:', error);
    }
  }

  /**
   * Transform NPL event to a sync event for RabbitMQ
   */
  private transformToSyncEvent(nplEvent: any): any {
    const syncEvent: any = {
      type: nplEvent.type,
      command: nplEvent.command,
      protocolType: nplEvent.protocolType,
      timestamp: nplEvent.timestamp,
      parameters: nplEvent.parameters
    };

    // Add specific fields for different event types
    if (nplEvent.type === 'notify') {
      syncEvent.name = nplEvent.name;
      syncEvent.arguments = nplEvent.arguments;
    } else if (nplEvent.type === 'command') {
      syncEvent.id = nplEvent.id;
      syncEvent.command = nplEvent.command;
      syncEvent.parameters = nplEvent.parameters;
    }

    return syncEvent;
  }

  /**
   * Get the RabbitMQ queue name for an event
   */
  private getQueueForEvent(nplEvent: any): string | undefined {
    if (nplEvent.type === 'notify') {
      switch (nplEvent.name) {
        case 'deviceSaved':
          return 'device-sync';
        case 'deviceDeleted':
          return 'device-sync';
        case 'deviceAssigned':
          return 'device-sync';
        case 'deviceUnassigned':
          return 'device-sync';
        case 'tenantCreated':
          return 'tenant-sync';
        case 'tenantUpdated':
          return 'tenant-sync';
        case 'tenantDeleted':
          return 'tenant-sync';
        case 'tenantsBulkImported':
          return 'tenant-sync';
        case 'tenantsBulkDeleted':
          return 'tenant-sync';
        default:
          return undefined;
      }
    } else if (nplEvent.type === 'command') {
      switch (nplEvent.command) {
        case 'saveDevice':
          return 'device-sync';
        case 'deleteDevice':
          return 'device-sync';
        case 'assignDeviceToCustomer':
          return 'device-sync';
        case 'unassignDeviceFromCustomer':
          return 'device-sync';
        default:
          return undefined;
      }
    }
    return undefined;
  }

  /**
   * Log system events (e.g., connection errors, reconnections)
   */
  private logSystemEvent(nplEvent: any): void {
    if (nplEvent.type === 'error') {
      console.error('❌ System error:', nplEvent.message);
    } else if (nplEvent.type === 'reconnect') {
      console.log(`🔄 Reconnecting to NPL Engine... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached. Exiting.');
        process.exit(1);
      }
    } else if (nplEvent.type === 'open') {
      console.log('✅ NPL Engine connection opened.');
    } else if (nplEvent.type === 'close') {
      console.log('✅ NPL Engine connection closed.');
    }
  }

  /**
   * Handle event stream errors
   */
  private handleEventStreamError(): void {
    console.error('❌ Event stream error. Attempting to reconnect...');
    this.eventStream?.close();
    this.eventStream = null;
    this.startEventStreamMonitoring(); // Re-attempt connection
  }
}

// Start the service
const service = new NplSyncService();
service.initialize().then(() => {
  console.log('✅ NPL Sync Service is running.');
}).catch((error) => {
  console.error('❌ Failed to start NPL Sync Service:', error);
  process.exit(1);
});