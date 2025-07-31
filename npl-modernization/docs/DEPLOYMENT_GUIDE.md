# NPL Modernization Deployment Guide

This guide documents the complete process for deploying and instantiating NPL protocols in the ThingsBoard modernization project.

## Prerequisites

- Docker and Docker Compose installed
- `curl` and `jq` available in terminal
- ThingsBoard running locally (optional, for testing sync scenarios)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ThingsBoard   │    │   OIDC Proxy    │    │   NPL Engine    │
│   (Port 9090)   │◄──►│   (Port 8080)   │◄──►│   (Port 12000)  │
│                 │    │                 │    │                 │
│ - JWT Auth      │    │ - OIDC Bridge   │    │ - Protocol API  │
│ - Device API    │    │ - RSA Signing   │    │ - Management    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 1. Environment Setup

### 1.1 Start the NPL Stack

```bash
# Navigate to the NPL modernization directory
cd npl-modernization

# Start the complete stack (engine, OIDC proxy, PostgreSQL)
docker compose up -d

# Verify all services are running
docker compose ps
```

### 1.2 Verify Services

```bash
# Check NPL Engine health
curl -s http://localhost:12000/health | jq .

# Check OIDC Proxy health
curl -s http://localhost:8080/health | jq .

# Check PostgreSQL connection
docker compose exec postgres psql -U postgres -d npl_engine -c "SELECT 1;"
```

## 2. Authentication Setup

### 2.1 Get JWT Token from OIDC Proxy

The OIDC proxy bridges ThingsBoard's JWT authentication with NPL's OIDC requirements.

```bash
# Get a JWT token using ThingsBoard credentials
TOKEN=$(curl -s -X POST http://localhost:8080/protocol/openid-connect/token \
  -H "Content-Type: application/json" \
  -d '{"username":"tenant@thingsboard.org","password":"tenant"}' \
  | jq -r '.access_token')

echo "Token obtained, length: ${#TOKEN}"
```

### 2.2 Verify Token

```bash
# Test the token with a simple API call
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:12000/api/engine/environment/list/test | jq .
```

## 3. Protocol Deployment

### 3.1 Prepare Deployment Package

The deployment package must contain:
- NPL source files in the correct directory structure
- `migration.yml` configuration
- `rules/rules_1.0.0.yml` for role mapping

**File Structure:**
```
deployment.zip
├── npl-1.0.0/
│   └── deviceManagement/
│       └── deviceManagement.npl
├── migration.yml
└── rules/
    └── rules_1.0.0.yml
```

### 3.2 Deploy via Management API

```bash
# Deploy the protocol using multipart/form-data
curl -s -X POST http://localhost:12400/management/application \
  -H "Authorization: Bearer $TOKEN" \
  -F "archive=@deployment.zip" \
  | jq .
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Deployment completed successfully"
}
```

### 3.3 Verify Deployment

```bash
# Check if the protocol endpoints are available
curl -s -I http://localhost:12000/npl/deviceManagement/DeviceManagement/

# Should return 401 Unauthorized (not 404 Not Found)
```

## 4. Protocol Instantiation

### 4.1 Create Protocol Instance

```bash
# Instantiate the protocol with parties
curl -s -X POST http://localhost:12000/api/engine/protocols \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prototypeId": "/deviceManagement/DeviceManagement",
    "parties": [
      {"entity": {"claims": {"email": ["sysadmin@thingsboard.org"]}}, "access": {}},
      {"entity": {"claims": {"email": ["tenant@thingsboard.org"]}}, "access": {}},
      {"entity": {"claims": {"email": ["customer@thingsboard.org"]}}, "access": {}}
    ]
  }' | jq .
```

**Expected Response:**
```json
{
  "commandId": "2a4d2895-aa99-4427-ab67-46ec7810f79e",
  "result": {
    "nplType": "protocolReference",
    "value": "9b9d3593-8685-44b3-bd69-a51c734343b3",
    "typeName": "/deviceManagement/DeviceManagement"
  },
  "resultingStates": [
    {
      "protocolId": "9b9d3593-8685-44b3-bd69-a51c734343b3",
      "version": 1
    }
  ]
}
```

### 4.2 Extract Protocol Instance ID

```bash
# Extract the protocol instance ID for future use
PROTOCOL_ID=$(curl -s -X POST http://localhost:12000/api/engine/protocols \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prototypeId": "/deviceManagement/DeviceManagement",
    "parties": [
      {"entity": {"claims": {"email": ["sysadmin@thingsboard.org"]}}, "access": {}},
      {"entity": {"claims": {"email": ["tenant@thingsboard.org"]}}, "access": {}},
      {"entity": {"claims": {"email": ["customer@thingsboard.org"]}}, "access": {}}
    ]
  }' | jq -r '.result.value')

echo "Protocol Instance ID: $PROTOCOL_ID"
```

## 5. Protocol Interaction

### 5.1 Test Protocol Endpoints

```bash
# Test device creation
curl -s -X POST http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/createDevice \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": {
      "id": "test-device-001",
      "name": "Test Device",
      "type": "sensor",
      "tenantId": "tenant-001",
      "credentials": "encrypted-credentials",
      "label": "Test Label",
      "deviceProfileId": "profile-001",
      "firmwareId": "firmware-001",
      "softwareId": "software-001",
      "externalId": "ext-001",
      "version": 1,
      "additionalInfo": "Additional info",
      "createdTime": 1640995200000,
      "deviceData": "device-data"
    }
  }' | jq .

# Test device retrieval
curl -s -X POST http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/getDeviceById \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "test-device-001"}' | jq .

# Test device listing
curl -s -X POST http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/getAllDevices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

## 6. Troubleshooting

### 6.1 Common Issues

**Issue: "No such PrototypeId"**
- **Cause**: Protocol not deployed successfully
- **Solution**: Check deployment logs and verify ZIP file structure

**Issue: "Unknown protocol"**
- **Cause**: Protocol instance not found
- **Solution**: Verify protocol instance ID and ensure it exists

**Issue: "401 Unauthorized"**
- **Cause**: Invalid or expired JWT token
- **Solution**: Get a fresh token from the OIDC proxy

**Issue: "JSON parse error"**
- **Cause**: Incorrect payload format
- **Solution**: Verify the exact field names and structure expected by the API

### 6.2 Clean Restart

If you encounter persistent issues:

```bash
# Stop all services and remove volumes
docker compose down -v

# Restart the stack
docker compose up -d

# Wait for services to be ready
sleep 30

# Verify services
docker compose ps
```

### 6.3 Debug Commands

```bash
# Check engine logs
docker compose logs engine

# Check OIDC proxy logs
docker compose logs oidc-proxy

# Check database
docker compose exec postgres psql -U postgres -d npl_engine -c "SELECT * FROM protocols;"
```

## 7. File Structure Reference

### 7.1 NPL Source File (`deviceManagement.npl`)

```npl
package deviceManagement

@api
protocol[sys_admin, tenant_admin, customer_user] DeviceManagement() {
    initial state active;
    final state active;
    
    // Protocol implementation...
}
```

### 7.2 Migration Configuration (`migration.yml`)

```yaml
systemUnderAudit: nplinit

changesets:
  - name: 1.0.0
    changes:
      - reset: true
      - migrate:
        dir-list: npl-1.0.0
        rules: rules/rules_1.0.0.yml
```

### 7.3 Rules Configuration (`rules_1.0.0.yml`)

```yaml
deviceManagement.DeviceManagement:
  sys_admin:
    extract:
      entity:
        - preferred_username
  tenant_admin:
    extract:
      entity:
        - preferred_username
  customer_user:
    extract:
      entity:
```

## 8. Docker Compose Configuration

### 8.1 Key Environment Variables

```yaml
engine:
  environment:
    ENGINE_DB_URL: jdbc:postgresql://postgres:5432/npl_engine
    ENGINE_DB_USER: postgres
    ENGINE_DB_PASSWORD: welcome123
    ENGINE_DEV_MODE: false
    ENGINE_ALLOWED_ISSUERS: "http://oidc-proxy:8080"
    ENGINE_OIDC_SUBJECT_CLAIM: sub
    ENGINE_OIDC_ROLES_CLAIM: scopes
    ENGINE_OIDC_ISSUER_CLAIM: iss
```

## 9. Next Steps

After successful deployment and instantiation:

1. **Test CRUD Operations**: Verify all device management operations work correctly
2. **Build Sync Service**: Implement AMQP-based synchronization with ThingsBoard
3. **Add More Protocols**: Deploy additional protocols (device state management, etc.)
4. **Frontend Integration**: Build React frontend using generated OpenAPI clients
5. **Production Deployment**: Configure for production environment

## 10. Scripts

### 10.1 Complete Deployment Script

```bash
#!/bin/bash
# deploy.sh - Complete deployment script

set -e

echo "Starting NPL stack..."
docker compose up -d

echo "Waiting for services to be ready..."
sleep 30

echo "Getting JWT token..."
TOKEN=$(curl -s -X POST http://localhost:8080/protocol/openid-connect/token \
  -H "Content-Type: application/json" \
  -d '{"username":"tenant@thingsboard.org","password":"tenant"}' \
  | jq -r '.access_token')

echo "Deploying protocol..."
curl -s -X POST http://localhost:12400/management/application \
  -H "Authorization: Bearer $TOKEN" \
  -F "archive=@deployment.zip" \
  | jq .

echo "Creating protocol instance..."
RESPONSE=$(curl -s -X POST http://localhost:12000/api/engine/protocols \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prototypeId": "/deviceManagement/DeviceManagement",
    "parties": [
      {"entity": {"claims": {"email": ["sysadmin@thingsboard.org"]}}, "access": {}},
      {"entity": {"claims": {"email": ["tenant@thingsboard.org"]}}, "access": {}},
      {"entity": {"claims": {"email": ["customer@thingsboard.org"]}}, "access": {}}
    ]
  }')

PROTOCOL_ID=$(echo $RESPONSE | jq -r '.result.value')
echo "Protocol Instance ID: $PROTOCOL_ID"

echo "Deployment complete!"
```

This guide provides a complete reference for deploying and instantiating NPL protocols in the ThingsBoard modernization project. 