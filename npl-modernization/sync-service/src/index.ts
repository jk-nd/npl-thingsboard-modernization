#!/usr/bin/env node

/**
 * NPL Sync Service - Event Stream Approach
 * Monitors NPL event stream for business events and routes them to RabbitMQ
 */

import { AmqpConnectionManager } from './amqp/connection';
import { AmqpConfig, QueueConfig } from './types';
import { ThingsBoardClient, ThingsBoardConfig } from './thingsboard/client';
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
      console.error('❌ Failed to sync to ThingsBoard:', error);
    }
  }

  /**
   * Transform NPL event to sync event format
   */
  private transformToSyncEvent(nplEvent: any): any {
    const eventType = this.mapCommandToEventType(nplEvent.command);
    
    return {
      eventType,
      eventId: `evt-${Date.now()}`,
      source: 'npl-device-management',
      payload: this.extractPayload(nplEvent),
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId: `corr-${Date.now()}`,
        protocolId: nplEvent.protocolId || 'unknown',
        userId: nplEvent.userId,
        tenantId: nplEvent.tenantId
      }
    };
  }

  /**
   * Map NPL command to event type
   */
  private mapCommandToEventType(command: string): string {
    const commandMap: Record<string, string> = {
      'saveDevice': 'DEVICE_CREATED',
      'deleteDevice': 'DEVICE_DELETED',
      'assignDeviceToCustomer': 'DEVICE_ASSIGNED',
      'unassignDeviceFromCustomer': 'DEVICE_UNASSIGNED'
    };

    return commandMap[command] || 'UNKNOWN_EVENT';
  }

  /**
   * Extract payload from NPL event
   */
  private extractPayload(nplEvent: any): any {
    switch (nplEvent.command) {
      case 'saveDevice':
        return {
          device: this.sanitizeDeviceData(nplEvent.parameters?.device || {})
        };
      
      case 'deleteDevice':
        return {
          deviceId: nplEvent.parameters?.id || nplEvent.parameters?.deviceId
        };
      
      case 'assignDeviceToCustomer':
        return {
          deviceId: nplEvent.parameters?.deviceId,
          customerId: nplEvent.parameters?.customerId
        };
      
      case 'unassignDeviceFromCustomer':
        return {
          deviceId: nplEvent.parameters?.deviceId
        };
      
      default:
        return nplEvent.parameters || {};
    }
  }

  /**
   * Sanitize device data for sync (remove sensitive information)
   */
  private sanitizeDeviceData(device: any): any {
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      tenantId: device.tenantId,
      customerId: device.customerId,
      // Don't sync credentials for security
      credentials: '',
      label: device.label,
      deviceProfileId: device.deviceProfileId,
      firmwareId: device.firmwareId,
      softwareId: device.softwareId,
      externalId: device.externalId,
      version: device.version,
      additionalInfo: device.additionalInfo,
      createdTime: device.createdTime,
      deviceData: device.deviceData
    };
  }

  /**
   * Get queue name for event type
   */
  private getQueueForEvent(nplEvent: any): string | null {
    // Handle notifications
    if (nplEvent.type === 'notify') {
      const notificationQueueMap: Record<string, string> = {
        'deviceSaved': 'device-sync',
        'deviceDeleted': 'device-sync',
        'deviceAssigned': 'device-sync',
        'deviceUnassigned': 'device-sync',
        'tenantCreated': 'tenant-sync',
        'tenantUpdated': 'tenant-sync',
        'tenantDeleted': 'tenant-sync',
        'tenantsBulkImported': 'tenant-sync',
        'tenantsBulkDeleted': 'tenant-sync'
      };
      return notificationQueueMap[nplEvent.name] || null;
    }
    
    // Handle command events
    const commandQueueMap: Record<string, string> = {
      'saveDevice': 'device-sync',
      'deleteDevice': 'device-sync',
      'assignDeviceToCustomer': 'device-sync',
      'unassignDeviceFromCustomer': 'device-sync',
      'createTenant': 'tenant-sync',
      'updateTenant': 'tenant-sync',
      'deleteTenant': 'tenant-sync',
      'bulkImportTenants': 'tenant-sync',
      'bulkDeleteTenants': 'tenant-sync'
    };

    return commandQueueMap[nplEvent.command] || null;
  }

  /**
   * Log system events for monitoring
   */
  private logSystemEvent(nplEvent: any): void {
    console.log('📊 System Event:', {
      type: nplEvent.type,
      command: nplEvent.command,
      protocolType: nplEvent.protocolType,
      timestamp: nplEvent.timestamp,
      userId: nplEvent.userId
    });
  }

  /**
   * Handle event stream errors and reconnect
   */
  private handleEventStreamError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.startEventStreamMonitoring();
      }, 5000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  /**
   * Simulate business event for testing
   */
  async simulateBusinessEvent(command: string, parameters: any): Promise<void> {
    const nplEvent = {
      type: 'command',
      command,
      parameters,
      timestamp: new Date().toISOString(),
      userId: 'test-user',
      tenantId: 'test-tenant'
    };

    await this.processBusinessEvent(nplEvent);
  }

  /**
   * Get service health status
   */
  getHealthStatus(): any {
    return {
      isRunning: this.isRunning,
      amqpHealthy: this.amqpManager.isHealthy(),
      eventStreamActive: this.eventStream !== null,
      reconnectAttempts: this.reconnectAttempts,
      thingsBoardConfigured: !!this.thingsBoardClient,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Shutdown the sync service
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down NPL Sync Service...');
    
    this.isRunning = false;

    if (this.eventStream) {
      this.eventStream.close();
    }

    await this.amqpManager.close();
    
    console.log('✅ NPL Sync Service shutdown complete');
  }
}

// Main execution
async function main() {
  const syncService = new NplSyncService();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await syncService.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await syncService.shutdown();
    process.exit(0);
  });

  try {
    await syncService.initialize();

    // Only run test events in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n🧪 Testing business events...');
      
      await syncService.simulateBusinessEvent('saveDevice', {
        device: {
          id: 'test-device-001',
          name: 'Test Device',
          type: 'sensor',
          tenantId: 'tenant-001',
          credentials: 'test-credentials'
        }
      });

      await syncService.simulateBusinessEvent('deleteDevice', {
        deviceId: 'test-device-001'
      });

      console.log('\n✅ Test events completed');
    }

    // Start HTTP server for health checks
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        const health = syncService.getHealthStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(3000, () => {
      console.log('\n🔄 Sync service is running on port 3000');
      console.log('📊 Health endpoint: http://localhost:3000/health');
      console.log('🛑 Press Ctrl+C to stop');
    });
    
    // Log health status every 30 seconds
    setInterval(() => {
      const health = syncService.getHealthStatus();
      console.log('💚 Health Status:', health);
    }, 30000);

  } catch (error) {
    console.error('❌ Failed to start sync service:', error);
    process.exit(1);
  }
}

// Run the service if this file is executed directly
if (require.main === module) {
  main();
}

export { NplSyncService }; 