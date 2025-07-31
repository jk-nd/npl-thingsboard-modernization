# NPL Modernization Testing Guide

## 🧪 **Testing Strategy**

This guide outlines the testing approach for the NPL modernization project, focusing on the sync service and event-driven architecture.

## 📋 **Test Categories**

### **1. Unit Tests**
- **Type Validation**: Ensure TypeScript interfaces work correctly
- **Data Transformation**: Test NPL ↔ ThingsBoard data conversion
- **Configuration**: Validate AMQP and ThingsBoard configs

### **2. Integration Tests**
- **AMQP Connection**: Test RabbitMQ connectivity
- **ThingsBoard API**: Test REST API calls
- **Event Processing**: Test end-to-end event flow

### **3. End-to-End Tests**
- **NPL → ThingsBoard Sync**: Complete sync workflow
- **Error Handling**: Test retry logic and error scenarios
- **Performance**: Test sync latency and throughput

## 🔧 **Manual Testing Procedures**

### **1. Type Validation Tests**

```typescript
// Test sync event creation
const testEvent: SyncEvent = {
  eventType: 'DEVICE_CREATED',
  eventId: 'evt-12345',
  source: 'npl-device-management',
  payload: {
    device: {
      id: 'device-001',
      name: 'Test Device',
      type: 'sensor',
      tenantId: 'tenant-001',
      credentials: 'encrypted-credentials'
    }
  },
  metadata: {
    timestamp: new Date().toISOString(),
    correlationId: 'corr-abc123'
  }
};

// Validate required fields
console.log('Event valid:', !!(
  testEvent.eventType &&
  testEvent.eventId &&
  testEvent.source &&
  testEvent.payload &&
  testEvent.metadata.timestamp
));
```

### **2. AMQP Connection Tests**

```bash
# Test RabbitMQ connection
curl -u admin:admin123 http://localhost:15672/api/overview

# Test queue creation
curl -u admin:admin123 -H "Content-Type: application/json" \
  -d '{"auto_delete":false,"durable":true}' \
  http://localhost:15672/api/queues/%2F/device-sync
```

### **3. ThingsBoard API Tests**

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/protocol/openid-connect/token \
  -H "Content-Type: application/json" \
  -d '{"username":"tenant@thingsboard.org","password":"tenant"}' \
  | jq -r '.access_token')

# Test device creation
curl -s -X POST http://localhost:9090/api/device \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Device",
    "type": "sensor",
    "deviceProfileId": {
      "id": "default",
      "entityType": "DEVICE_PROFILE"
    }
  }' | jq .
```

## 📊 **Test Scenarios**

### **Scenario 1: Device Creation**
1. **NPL Protocol**: Create device via NPL API
2. **Event Generation**: Verify event is published to RabbitMQ
3. **Sync Service**: Consume event and transform data
4. **ThingsBoard API**: Create device via REST API
5. **Verification**: Check device exists in ThingsBoard

### **Scenario 2: Device Update**
1. **NPL Protocol**: Update device via NPL API
2. **Event Generation**: Verify update event is published
3. **Sync Service**: Process update event
4. **ThingsBoard API**: Update device via REST API
5. **Verification**: Check device is updated in ThingsBoard

### **Scenario 3: Device Assignment**
1. **NPL Protocol**: Assign device to customer
2. **Event Generation**: Verify assignment event
3. **Sync Service**: Process assignment
4. **ThingsBoard API**: Update device customer
5. **Verification**: Check device assignment

### **Scenario 4: Error Handling**
1. **Invalid Data**: Send malformed event
2. **Network Error**: Disconnect ThingsBoard
3. **Authentication Error**: Use invalid token
4. **Retry Logic**: Verify exponential backoff
5. **Dead Letter Queue**: Check failed messages

## 🛠️ **Testing Tools**

### **1. RabbitMQ Management UI**
- **URL**: http://localhost:15672
- **Username**: admin
- **Password**: admin123
- **Features**: Queue monitoring, message inspection

### **2. ThingsBoard API**
- **Base URL**: http://localhost:9090
- **Authentication**: JWT via OIDC proxy
- **Endpoints**: `/api/device`, `/api/customer`, etc.

### **3. NPL Engine API**
- **Base URL**: http://localhost:12000
- **Authentication**: JWT via OIDC proxy
- **Endpoints**: `/npl/deviceManagement/DeviceManagement/{id}`

### **4. Sync Service Logs**
```bash
# View sync service logs
docker compose logs sync-service

# Follow logs in real-time
docker compose logs -f sync-service
```

## 📈 **Performance Testing**

### **1. Latency Tests**
```bash
# Measure sync latency
time curl -X POST http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/createDevice \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device": {...}}'
```

### **2. Throughput Tests**
```bash
# Create multiple devices rapidly
for i in {1..100}; do
  curl -X POST http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/createDevice \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"device\": {\"id\": \"device-$i\", \"name\": \"Device $i\", \"type\": \"sensor\", \"tenantId\": \"tenant-001\", \"credentials\": \"encrypted\"}}" &
done
wait
```

### **3. Queue Depth Monitoring**
```bash
# Check queue depth
curl -u admin:admin123 http://localhost:15672/api/queues/%2F/device-sync | jq '.messages'
```

## 🔍 **Debugging Tests**

### **1. Event Inspection**
```bash
# Check RabbitMQ messages
curl -u admin:admin123 http://localhost:15672/api/queues/%2F/device-sync/get \
  -H "Content-Type: application/json" \
  -d '{"count":5,"requeue":true}' | jq .
```

### **2. ThingsBoard Database**
```bash
# Check devices in ThingsBoard
docker compose exec postgres psql -U postgres -d thingsboard -c \
  "SELECT id, name, type FROM device LIMIT 10;"
```

### **3. NPL Engine State**
```bash
# Check NPL protocol state
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:12000/api/engine/protocols | jq .
```

## 📋 **Test Checklist**

### **Pre-Test Setup**
- [ ] RabbitMQ is running and accessible
- [ ] ThingsBoard is running and accessible
- [ ] NPL Engine is running with device management protocol
- [ ] OIDC proxy is working
- [ ] Sync service is running

### **Type Validation**
- [ ] SyncEvent interface works correctly
- [ ] DeviceData interface validates required fields
- [ ] EventType enum contains all expected values
- [ ] Configuration interfaces are valid

### **AMQP Tests**
- [ ] Can connect to RabbitMQ
- [ ] Can create queues
- [ ] Can publish messages
- [ ] Can consume messages
- [ ] Error handling works

### **ThingsBoard API Tests**
- [ ] Can authenticate with JWT
- [ ] Can create devices
- [ ] Can update devices
- [ ] Can delete devices
- [ ] Can assign devices to customers

### **End-to-End Tests**
- [ ] NPL device creation → ThingsBoard sync
- [ ] NPL device update → ThingsBoard sync
- [ ] NPL device deletion → ThingsBoard sync
- [ ] Error scenarios handled correctly
- [ ] Performance meets requirements

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ All device operations sync correctly
- ✅ Error handling works as expected
- ✅ Retry logic functions properly
- ✅ Dead letter queue captures failed messages

### **Performance Requirements**
- ✅ Sync latency < 100ms average
- ✅ Error rate < 1% of operations
- ✅ Queue depth < 100 messages
- ✅ Service uptime > 99.9%

### **Operational Requirements**
- ✅ Logging provides sufficient detail
- ✅ Monitoring metrics are available
- ✅ Configuration is environment-based
- ✅ Health checks are implemented

---

*This testing guide ensures comprehensive validation of the sync service and event-driven architecture.* 