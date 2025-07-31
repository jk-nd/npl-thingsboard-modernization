import * as amqp from 'amqplib';
import { AmqpConfig, QueueConfig } from '../types';

/**
 * AMQP Connection Manager for NPL Sync Service
 * Handles RabbitMQ connections and message routing
 */
export class AmqpConnectionManager {
  private connection: any = null;
  private channel: any = null;
  private config: AmqpConfig;
  private queues: QueueConfig[];

  constructor(config: AmqpConfig, queues: QueueConfig[]) {
    this.config = config;
    this.queues = queues;
  }

  /**
   * Initialize AMQP connection and create queues
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔌 Connecting to RabbitMQ...');
      
      // Connect to RabbitMQ
      this.connection = await amqp.connect(`amqp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}${this.config.vhost}`);

      // Create channel
      this.channel = await this.connection.createChannel();

      // Create queues
      await this.createQueues();

      console.log('✅ RabbitMQ connection established');
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Create all required queues
   */
  private async createQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    for (const queue of this.queues) {
      await this.channel.assertQueue(queue.name, {
        durable: queue.durable,
        autoDelete: queue.autoDelete
      });
      console.log(`✅ Queue created: ${queue.name}`);
    }
  }

  /**
   * Publish message to specific queue
   */
  async publishMessage(queueName: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    await this.channel.sendToQueue(queueName, messageBuffer, {
      persistent: true,
      timestamp: Date.now()
    });

    console.log(`📤 Message published to ${queueName}:`, message.eventType);
  }

  /**
   * Route NPL notification to appropriate queue
   */
  async routeNotification(notification: any): Promise<void> {
    const { type, data } = notification;
    
    // Map notification type to queue
    const queueName = this.getQueueForNotificationType(type);
    
    if (queueName) {
      const syncEvent = this.transformNotificationToSyncEvent(type, data);
      await this.publishMessage(queueName, syncEvent);
    } else {
      console.warn(`⚠️ No queue found for notification type: ${type}`);
    }
  }

  /**
   * Get queue name for notification type
   */
  private getQueueForNotificationType(type: string): string | null {
    const queueMap: Record<string, string> = {
      'DEVICE_CREATED': 'device-sync',
      'DEVICE_UPDATED': 'device-sync',
      'DEVICE_DELETED': 'device-sync',
      'DEVICE_ASSIGNED': 'device-sync',
      'DEVICE_UNASSIGNED': 'device-sync',
      'DEVICE_STATE_CHANGED': 'device-state-sync',
      'DEVICE_ACTIVITY_UPDATED': 'device-state-sync',
      'ASSET_CREATED': 'asset-sync',
      'ASSET_UPDATED': 'asset-sync',
      'ASSET_DELETED': 'asset-sync',
      'ASSET_ASSIGNED': 'asset-sync',
      'RULE_CHAIN_CREATED': 'rule-sync',
      'RULE_CHAIN_UPDATED': 'rule-sync',
      'RULE_NODE_ADDED': 'rule-sync',
      'DASHBOARD_CREATED': 'dashboard-sync',
      'DASHBOARD_UPDATED': 'dashboard-sync',
      'WIDGET_ADDED': 'dashboard-sync'
    };

    return queueMap[type] || null;
  }

  /**
   * Transform NPL notification to sync event format
   */
  private transformNotificationToSyncEvent(type: string, data: any): any {
    return {
      eventType: type,
      eventId: `evt-${Date.now()}`,
      source: 'npl-device-management',
      payload: this.extractPayload(type, data),
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId: `corr-${Date.now()}`,
        protocolId: data.protocolId || 'unknown'
      }
    };
  }

  /**
   * Extract payload based on notification type
   */
  private extractPayload(type: string, data: any): any {
    switch (type) {
      case 'DEVICE_CREATED':
      case 'DEVICE_UPDATED':
        return {
          device: this.sanitizeDeviceData(data)
        };
      
      case 'DEVICE_DELETED':
        return {
          deviceId: data
        };
      
      case 'DEVICE_ASSIGNED':
        return {
          deviceId: data,
          customerId: data.customerId
        };
      
      case 'DEVICE_UNASSIGNED':
        return {
          deviceId: data
        };
      
      default:
        return data;
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
   * Close AMQP connection
   */
  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    console.log('🔌 RabbitMQ connection closed');
  }

  /**
   * Consume messages from a queue
   */
  async consume(queueName: string, callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.channel.consume(queueName, async (message: any) => {
      if (message) {
        await callback(message);
      }
    });

    console.log(`🐰 Started consuming from ${queueName}`);
  }

  /**
   * Acknowledge a message
   */
  ack(message: any): void {
    if (this.channel && message) {
      this.channel.ack(message);
    }
  }

  /**
   * Negative acknowledge a message
   */
  nack(message: any): void {
    if (this.channel && message) {
      this.channel.nack(message);
    }
  }

  /**
   * Get connection health status
   */
  isHealthy(): boolean {
    return this.connection !== null && this.channel !== null;
  }
} 