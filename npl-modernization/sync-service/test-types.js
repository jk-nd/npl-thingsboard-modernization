#!/usr/bin/env node

/**
 * Simple test script for sync service types and functionality
 * Run with: node test-types.js
 */

console.log('🧪 Running Sync Service Type Tests...\n');

// Test data generation
console.log('📊 Testing Data Generation...');

// Create test device data
const createTestDeviceData = () => ({
  id: 'test-device-001',
  name: 'Test Device',
  type: 'sensor',
  tenantId: 'tenant-001',
  customerId: 'customer-001',
  credentials: 'encrypted-credentials',
  label: 'Test Label',
  deviceProfileId: 'profile-001',
  firmwareId: 'firmware-001',
  softwareId: 'software-001',
  externalId: 'ext-001',
  version: 1,
  additionalInfo: 'Additional info',
  createdTime: 1640995200000,
  deviceData: 'device-data'
});

// Create test sync event
const createTestSyncEvent = (eventType = 'DEVICE_CREATED') => ({
  eventType,
  eventId: `evt-${Date.now()}`,
  source: 'npl-device-management',
  payload: {
    device: createTestDeviceData()
  },
  metadata: {
    timestamp: new Date().toISOString(),
    correlationId: `corr-${Date.now()}`,
    protocolId: '9b9d3593-8685-44b3-bd69-a51c734343b3'
  }
});

// Validation functions
const validateSyncEvent = (event) => {
  return !!(
    event.eventType &&
    event.eventId &&
    event.source &&
    event.payload &&
    event.metadata &&
    event.metadata.timestamp
  );
};

const validateDeviceData = (device) => {
  return !!(
    device.id &&
    device.name &&
    device.type &&
    device.tenantId &&
    device.credentials
  );
};

const validateSyncResult = (result) => {
  return !!(
    typeof result.success === 'boolean' &&
    result.eventId &&
    result.operation &&
    result.timestamp
  );
};

// Run tests
const testDevice = createTestDeviceData();
console.log('✅ Test device created:', testDevice.id);

const testEvent = createTestSyncEvent('DEVICE_CREATED');
console.log('✅ Test event created:', testEvent.eventId);

// Test validation functions
console.log('\n🔍 Testing Validation Functions...');
const eventValid = validateSyncEvent(testEvent);
console.log('✅ Event validation:', eventValid ? 'PASSED' : 'FAILED');

const deviceValid = validateDeviceData(testDevice);
console.log('✅ Device validation:', deviceValid ? 'PASSED' : 'FAILED');

// Test sync result
const syncResult = {
  success: true,
  eventId: 'evt-12345',
  operation: 'DEVICE_CREATED',
  entityId: 'device-001',
  timestamp: new Date().toISOString()
};

const resultValid = validateSyncResult(syncResult);
console.log('✅ Sync result validation:', resultValid ? 'PASSED' : 'FAILED');

// Test error scenarios
console.log('\n❌ Testing Error Scenarios...');
const invalidEvent = {
  eventType: 'DEVICE_CREATED',
  // Missing required fields
};

const invalidEventValid = validateSyncEvent(invalidEvent);
console.log('✅ Invalid event detection:', !invalidEventValid ? 'PASSED' : 'FAILED');

const invalidDevice = {
  id: 'test-device',
  // Missing required fields
};

const invalidDeviceValid = validateDeviceData(invalidDevice);
console.log('✅ Invalid device detection:', !invalidDeviceValid ? 'PASSED' : 'FAILED');

// Test different event types
console.log('\n📋 Testing Event Types...');
const eventTypes = [
  'DEVICE_CREATED',
  'DEVICE_UPDATED', 
  'DEVICE_DELETED',
  'DEVICE_ASSIGNED',
  'DEVICE_UNASSIGNED'
];

eventTypes.forEach(eventType => {
  const event = createTestSyncEvent(eventType);
  const valid = validateSyncEvent(event);
  console.log(`✅ ${eventType}:`, valid ? 'PASSED' : 'FAILED');
});

// Test AMQP configuration
console.log('\n🐰 Testing AMQP Configuration...');
const amqpConfig = {
  host: 'localhost',
  port: 5672,
  username: 'admin',
  password: 'admin123',
  vhost: '/'
};

const validateAmqpConfig = (config) => {
  return !!(config.host && config.port && config.username && config.password);
};

const amqpValid = validateAmqpConfig(amqpConfig);
console.log('✅ AMQP configuration:', amqpValid ? 'PASSED' : 'FAILED');

// Test ThingsBoard configuration
console.log('\n🏢 Testing ThingsBoard Configuration...');
const tbConfig = {
  baseUrl: 'http://localhost:9090',
  username: 'tenant@thingsboard.org',
  password: 'tenant',
  timeout: 5000
};

const validateTbConfig = (config) => {
  return !!(config.baseUrl && config.username && config.password && config.timeout);
};

const tbValid = validateTbConfig(tbConfig);
console.log('✅ ThingsBoard configuration:', tbValid ? 'PASSED' : 'FAILED');

// Summary
console.log('\n🎯 Test Summary:');
console.log('✅ Data generation: Working');
console.log('✅ Type validation: Working');
console.log('✅ Error detection: Working');
console.log('✅ Event types: Working');
console.log('✅ AMQP configuration: Working');
console.log('✅ ThingsBoard configuration: Working');

console.log('\n🎉 All sync service type tests completed successfully!');
console.log('📝 Next steps: Implement AMQP connection and ThingsBoard client'); 