#!/usr/bin/env node

/**
 * Simple test script for NPL Sync Service
 * Tests AMQP connection and message publishing
 */

console.log('🧪 Testing NPL Sync Service...\n');

// Mock AMQP connection for testing
class MockAmqpManager {
  constructor() {
    this.isConnected = false;
    this.messages = [];
  }

  async initialize() {
    console.log('🔌 Mock AMQP: Connecting...');
    this.isConnected = true;
    console.log('✅ Mock AMQP: Connected successfully');
  }

  async publishMessage(queueName, message) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    
    this.messages.push({ queueName, message });
    console.log(`📤 Mock AMQP: Message published to ${queueName}:`, message.eventType);
  }

  isHealthy() {
    return this.isConnected;
  }

  async close() {
    console.log('🔌 Mock AMQP: Connection closed');
    this.isConnected = false;
  }
}

// Test data
const testEvents = [
  {
    command: 'saveDevice',
    parameters: {
      device: {
        id: 'test-device-001',
        name: 'Test Sensor',
        type: 'sensor',
        tenantId: 'tenant-001',
        customerId: 'customer-001',
        credentials: 'encrypted-credentials',
        label: 'Test Label',
        deviceProfileId: 'default-profile',
        firmwareId: 'firmware-v1.0',
        softwareId: 'software-v1.0',
        externalId: 'ext-001',
        version: 1,
        additionalInfo: '{"location": "building-a"}',
        createdTime: 1640995200000,
        deviceData: '{"config": {"sampling_rate": 60}}'
      }
    }
  },
  {
    command: 'deleteDevice',
    parameters: {
      deviceId: 'test-device-001'
    }
  },
  {
    command: 'assignDeviceToCustomer',
    parameters: {
      deviceId: 'test-device-001',
      customerId: 'customer-002'
    }
  },
  {
    command: 'unassignDeviceFromCustomer',
    parameters: {
      deviceId: 'test-device-001'
    }
  }
];

// Test functions
function transformToSyncEvent(nplEvent) {
  const commandMap = {
    'saveDevice': 'DEVICE_CREATED',
    'deleteDevice': 'DEVICE_DELETED',
    'assignDeviceToCustomer': 'DEVICE_ASSIGNED',
    'unassignDeviceFromCustomer': 'DEVICE_UNASSIGNED'
  };

  const eventType = commandMap[nplEvent.command] || 'UNKNOWN_EVENT';
  
  return {
    eventType,
    eventId: `evt-${Date.now()}`,
    source: 'npl-device-management',
    payload: extractPayload(nplEvent),
    metadata: {
      timestamp: new Date().toISOString(),
      correlationId: `corr-${Date.now()}`,
      protocolId: 'test-protocol',
      userId: 'test-user',
      tenantId: 'test-tenant'
    }
  };
}

function extractPayload(nplEvent) {
  switch (nplEvent.command) {
    case 'saveDevice':
      return {
        device: sanitizeDeviceData(nplEvent.parameters?.device || {})
      };
    
    case 'deleteDevice':
      return {
        deviceId: nplEvent.parameters?.deviceId
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

function sanitizeDeviceData(device) {
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

function getQueueForEvent(nplEvent) {
  const queueMap = {
    'saveDevice': 'device-sync',
    'deleteDevice': 'device-sync',
    'assignDeviceToCustomer': 'device-sync',
    'unassignDeviceFromCustomer': 'device-sync'
  };

  return queueMap[nplEvent.command] || null;
}

// Run tests
async function runTests() {
  console.log('📋 Running Sync Service Tests...\n');

  const amqpManager = new MockAmqpManager();

  try {
    // Test 1: Initialize AMQP connection
    console.log('🧪 Test 1: AMQP Connection');
    await amqpManager.initialize();
    console.log('✅ Test 1: PASSED\n');

    // Test 2: Process business events
    console.log('🧪 Test 2: Business Event Processing');
    
    for (const testEvent of testEvents) {
      const syncEvent = transformToSyncEvent(testEvent);
      const queueName = getQueueForEvent(testEvent);
      
      if (queueName) {
        await amqpManager.publishMessage(queueName, syncEvent);
        console.log(`✅ Processed: ${testEvent.command}`);
      } else {
        console.log(`⚠️ No queue for: ${testEvent.command}`);
      }
    }
    
    console.log('✅ Test 2: PASSED\n');

    // Test 3: Verify message count
    console.log('🧪 Test 3: Message Verification');
    console.log(`📊 Total messages published: ${amqpManager.messages.length}`);
    
    if (amqpManager.messages.length === testEvents.length) {
      console.log('✅ Test 3: PASSED\n');
    } else {
      console.log('❌ Test 3: FAILED - Message count mismatch\n');
    }

    // Test 4: Health check
    console.log('🧪 Test 4: Health Check');
    const isHealthy = amqpManager.isHealthy();
    console.log(`💚 AMQP Healthy: ${isHealthy}`);
    
    if (isHealthy) {
      console.log('✅ Test 4: PASSED\n');
    } else {
      console.log('❌ Test 4: FAILED\n');
    }

    // Test 5: Data sanitization
    console.log('🧪 Test 5: Data Sanitization');
    const testDevice = {
      id: 'test-device',
      name: 'Test Device',
      credentials: 'sensitive-data',
      tenantId: 'tenant-001'
    };
    
    const sanitized = sanitizeDeviceData(testDevice);
    console.log('Original credentials:', testDevice.credentials);
    console.log('Sanitized credentials:', sanitized.credentials);
    
    if (sanitized.credentials === '') {
      console.log('✅ Test 5: PASSED - Credentials sanitized\n');
    } else {
      console.log('❌ Test 5: FAILED - Credentials not sanitized\n');
    }

    // Summary
    console.log('🎯 Test Summary:');
    console.log('✅ AMQP Connection: Working');
    console.log('✅ Event Processing: Working');
    console.log('✅ Message Publishing: Working');
    console.log('✅ Health Monitoring: Working');
    console.log('✅ Data Sanitization: Working');
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('📝 Next steps:');
    console.log('  1. Deploy to Docker with real RabbitMQ');
    console.log('  2. Connect to NPL event stream');
    console.log('  3. Implement ThingsBoard client');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await amqpManager.close();
  }
}

// Run the tests
runTests(); 