// Event-driven sync types for NPL to ThingsBoard synchronization

export interface SyncEvent {
  eventType: EventType;
  eventId: string;
  source: string; // e.g., "npl-device-management"
  payload: any; // Will be typed based on eventType
  metadata: EventMetadata;
}

export interface EventMetadata {
  timestamp: string;
  correlationId?: string;
  protocolId?: string;
  userId?: string;
  tenantId?: string;
}

// Event types for different NPL packages
export type EventType = 
  // Device Management
  | "DEVICE_CREATED"
  | "DEVICE_UPDATED" 
  | "DEVICE_DELETED"
  | "DEVICE_ASSIGNED"
  | "DEVICE_UNASSIGNED"
  
  // Device State Management
  | "DEVICE_STATE_CHANGED"
  | "DEVICE_ACTIVITY_UPDATED"
  
  // Asset Management
  | "ASSET_CREATED"
  | "ASSET_UPDATED"
  | "ASSET_DELETED"
  | "ASSET_ASSIGNED"
  
  // Rule Engine
  | "RULE_CHAIN_CREATED"
  | "RULE_CHAIN_UPDATED"
  | "RULE_NODE_ADDED"
  
  // Dashboard Management
  | "DASHBOARD_CREATED"
  | "DASHBOARD_UPDATED"
  | "WIDGET_ADDED";

// Device-specific payload types
export interface DevicePayload {
  device: DeviceData;
}

export interface DeviceData {
  id: string;
  name: string;
  type: string;
  tenantId: string;
  customerId?: string;
  credentials: string;
  label?: string;
  deviceProfileId?: string;
  firmwareId?: string;
  softwareId?: string;
  externalId?: string;
  version?: number;
  additionalInfo?: string;
  createdTime?: number;
  deviceData?: string;
}

// Device assignment payload
export interface DeviceAssignmentPayload {
  deviceId: string;
  customerId: string;
  tenantId: string;
}

// Device state payload
export interface DeviceStatePayload {
  deviceId: string;
  state: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  lastActivityTime?: number;
  additionalInfo?: string;
}

// ThingsBoard API response types
export interface ThingsBoardDevice {
  id: {
    id: string;
    entityType: "DEVICE";
  };
  createdTime: number;
  name: string;
  type: string;
  tenantId: {
    id: string;
    entityType: "TENANT";
  };
  customerId?: {
    id: string;
    entityType: "CUSTOMER";
  };
  credentials: {
    id: string;
    createdTime: number;
    deviceId: {
      id: string;
      entityType: "DEVICE";
    };
    credentialsType: string;
    credentialsId: string;
  };
  label?: string;
  deviceProfileId?: {
    id: string;
    entityType: "DEVICE_PROFILE";
  };
  firmwareId?: {
    id: string;
    entityType: "OTA_PACKAGE";
  };
  softwareId?: {
    id: string;
    entityType: "OTA_PACKAGE";
  };
  externalId?: {
    id: string;
    entityType: "DEVICE";
  };
  additionalInfo?: Record<string, any>;
}

// Sync operation result
export interface SyncResult {
  success: boolean;
  eventId: string;
  operation: string;
  entityId?: string;
  error?: string;
  timestamp: string;
}

// Queue configuration
export interface QueueConfig {
  name: string;
  routingKey: string;
  durable: boolean;
  autoDelete: boolean;
}

// AMQP connection configuration
export interface AmqpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
}

// ThingsBoard API configuration
export interface ThingsBoardConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout: number;
} 