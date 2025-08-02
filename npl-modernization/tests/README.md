# NPL DeviceManagement Integration Tests

This directory contains comprehensive integration tests for the NPL (Noumena Protocol Language) DeviceManagement implementation in ThingsBoard.

## Overview

The test suite validates the complete integration between:
- **ThingsBoard UI** (Direct access via port 8082)
- **NPL Proxy** (Enhanced UI with NPL overlay via port 8081)
- **NPL Engine** (Protocol execution and write operations)
- **NPL Read Model** (GraphQL queries for read operations)
- **Sync Service** (Data synchronization between NPL and ThingsBoard)

## Test Categories

### 📖 Read Operation Tests (GraphQL)
- `getDeviceById` - Retrieve device by ID via GraphQL
- `getDeviceInfoById` - Enhanced device info with metadata
- `getTenantDevices` - Paginated device listing
- `getCustomerDevices` - Customer-specific device queries
- `getDeviceTypes` - Available device types
- `searchDevices` - Device search with filters
- `getDeviceCredentials` - Device authentication credentials

### ✏️ Write Operation Tests (NPL Engine)
- `createDevice` - Device creation via NPL protocol
- `updateDevice` - Device modification via NPL protocol
- `deleteDevice` - Device deletion via NPL protocol
- `assignDeviceToCustomer` - Customer assignment operations
- `unassignDeviceFromCustomer` - Customer unassignment operations
- `claimDevice` - Device claiming functionality
- `reclaimDevice` - Device reclaiming functionality

### 🔗 Integration Tests
- NPL Engine protocol instantiation
- Sync Service data synchronization
- End-to-end request routing validation

### ⚡ Performance Tests
- Response time comparison (NPL vs Direct)
- Overhead measurement
- Load testing with multiple devices

## Prerequisites

1. **Docker Services Running**:
   ```bash
   docker compose ps
   ```
   All services should be `Up` and healthy:
   - `postgres` (Database)
   - `rabbitmq` (Message broker)
   - `engine` (NPL Engine)
   - `read-model` (NPL Read Model)
   - `sync-service` (Data synchronization)
   - `oidc-proxy` (Authentication bridge)
   - `npl-proxy` (Nginx proxy with overlay)
   - `mytb-core` (ThingsBoard backend)
   - `mytb-ui` (ThingsBoard frontend)

2. **NPL Overlay Deployed**:
   ```bash
   ls -la ../overlay/npl-overlay.js
   ```

3. **Node.js** (v18+ recommended)

## Quick Start

1. **Install dependencies**:
   ```bash
   cd npl-modernization/tests
   npm install
   ```

2. **Run all tests**:
   ```bash
   ./run-tests.sh
   ```

## Test Runner Options

```bash
# Run all tests (default)
./run-tests.sh all

# Quick tests (read operations only)
./run-tests.sh quick

# Integration tests only
./run-tests.sh integration

# Performance tests only
./run-tests.sh performance

# Tests with coverage report
./run-tests.sh coverage

# Watch mode (for development)
./run-tests.sh watch

# Standalone test runner (bypass Jest)
./run-tests.sh standalone
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TB_URL` | `http://localhost:8082` | ThingsBoard direct URL |
| `NPL_PROXY_URL` | `http://localhost:8081` | NPL Proxy URL |
| `NPL_ENGINE_URL` | `http://localhost:12000` | NPL Engine API URL |
| `NPL_READ_MODEL_URL` | `http://localhost:5001` | NPL Read Model GraphQL URL |
| `TB_USERNAME` | `tenant@thingsboard.org` | Test user credentials |
| `TB_PASSWORD` | `tenant` | Test user password |
| `VERBOSE_TESTS` | `false` | Enable verbose test output |

Example with custom configuration:
```bash
TB_URL=http://localhost:9090 NPL_PROXY_URL=http://localhost:8080 ./run-tests.sh
```

## Test Structure

```
tests/
├── device-management-integration.test.ts  # Main test suite
├── package.json                          # Dependencies and scripts
├── jest.config.js                        # Jest configuration
├── test-setup.ts                         # Test environment setup
├── run-tests.sh                          # Test runner script
└── README.md                             # This file
```

## Expected Test Flow

1. **Setup Phase**:
   - Authenticate with ThingsBoard
   - Initialize test clients
   - Check service health

2. **Read Tests**:
   - Create test devices via ThingsBoard API
   - Query devices via NPL Proxy (GraphQL routing)
   - Compare results with direct ThingsBoard queries
   - Validate data consistency

3. **Write Tests**:
   - Create/modify devices via NPL Proxy (NPL Engine routing)
   - Verify changes in ThingsBoard database
   - Test NPL protocol notifications

4. **Integration Tests**:
   - Test NPL Engine protocol instantiation
   - Verify Sync Service data flow
   - Validate end-to-end operations

5. **Cleanup Phase**:
   - Remove all test devices
   - Clean up protocol instances

## Troubleshooting

### Common Issues

1. **Services Not Running**:
   ```bash
   docker compose up -d
   ```

2. **Authentication Failures**:
   ```bash
   # Check ThingsBoard logs
   docker compose logs mytb-core
   ```

3. **NPL Engine Connection Issues**:
   ```bash
   # Check NPL Engine logs
   docker compose logs engine
   ```

4. **GraphQL Query Failures**:
   ```bash
   # Check Read Model logs
   docker compose logs read-model
   ```

### Test Debugging

Enable verbose output:
```bash
VERBOSE_TESTS=true ./run-tests.sh
```

Run individual test categories:
```bash
# Only read operations
npm test -- --testNamePattern="read operations"

# Only write operations  
npm test -- --testNamePattern="write operations"

# Only integration tests
npm test -- --testNamePattern="integration"
```

View detailed Jest output:
```bash
npm run test:verbose
```

## Success Criteria

✅ **All tests pass**: Read, Write, Integration, and Performance tests
✅ **No data leaks**: All test devices are cleaned up
✅ **Performance acceptable**: NPL overhead < 200ms for typical operations
✅ **Coverage > 80%**: Comprehensive test coverage of all operations

## Contributing

When adding new device management features:

1. Add corresponding test cases to `device-management-integration.test.ts`
2. Update this README with new test descriptions
3. Ensure all tests pass before submitting PR
4. Include performance impact analysis

## Related Documentation

- [NPL DeviceManagement Protocol](../api/src/main/npl-1.0.0/deviceManagement/deviceManagement.npl)
- [GraphQL Service Implementation](../frontend-overlay/src/app/npl-modernization/services/device-graphql.service.ts)
- [Request Transformer](../frontend-overlay/src/app/npl-modernization/services/request-transformer.service.ts)
- [Docker Compose Configuration](../../docker-compose.yml) 