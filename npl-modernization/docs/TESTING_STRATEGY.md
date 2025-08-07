# NPL Modernization Testing Strategy

## Overview

This document outlines the comprehensive testing strategy implemented for the NPL modernization of ThingsBoard's Device and Tenant Management modules. The testing approach uses a **separated testing strategy** to handle the different technologies and environments involved.

## 🏗️ Testing Architecture

### Separated Testing Strategy

We implement a **dual-environment testing approach** to handle the complexity of NPL + Angular integration:

```
┌─────────────────────────────────────────────────────────────┐
│                    Root Level (Jest)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Sync Service  │  │   Integration   │  │   Node.js   │ │
│  │     Tests       │  │     Tests       │  │   Utils     │ │
│  │   (Unit + IT)   │  │  (End-to-End)   │  │   Tests     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend Overlay (Karma + Jasmine)            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Angular HTTP  │  │   Service Unit  │  │   Component │ │
│  │  Interceptors   │  │     Tests       │  │    Tests    │ │
│  │     Tests       │  │                 │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Test Categories and Status

### ✅ Node.js Tests (Jest)

#### Sync Service Tests
**Location**: `tests/sync-service/`  
**Status**: ✅ **10/10 PASSING**  
**Coverage**: Unit and integration tests for bidirectional synchronization

| Test File | Tests | Status | Coverage |
|-----------|-------|--------|----------|
| `device-sync.test.ts` | 5 tests | ✅ PASS | Device sync operations |
| `tenant-sync.test.ts` | 5 tests | ✅ PASS | Tenant sync operations |

**Test Categories**:
- ✅ NPL → ThingsBoard synchronization
- ✅ ThingsBoard → NPL synchronization  
- ✅ Error handling and recovery
- ✅ Bulk operations
- ✅ Event handling validation

#### Integration Tests (Currently Disabled)
**Location**: `tests/integration/`  
**Status**: ⚠️ **DISABLED** (connectivity issues)  
**Reason**: Requires live NPL Engine + ThingsBoard services

| Test File | Tests | Status | Notes |
|-----------|-------|--------|-------|
| `device-management-integration.test.ts` | 4 tests | ⚠️ DISABLED | Service connectivity required |
| `tenant-management-integration.test.ts` | 3 tests | ⚠️ DISABLED | Service connectivity required |

### ✅ Frontend Tests (Karma + Jasmine)

#### Angular HTTP Interceptor Tests
**Location**: `frontend-overlay/tests/ui/`  
**Status**: ✅ **31/31 PASSING**  
**Framework**: Angular CLI + Karma + Jasmine

| Test File | Tests | Status | Coverage |
|-----------|-------|--------|----------|
| `device-overlay.test.ts` | 15 tests | ✅ PASS | Device interceptor routing |
| `tenant-overlay.test.ts` | 16 tests | ✅ PASS | Tenant interceptor routing |

**Test Categories**:
- ✅ HTTP request routing (READ → GraphQL)
- ✅ HTTP request routing (WRITE → NPL Engine)
- ✅ Error handling and fallback
- ✅ Service integration mocking
- ✅ URL pattern matching

## 🔧 Test Configuration

### Jest Configuration (Node.js Tests)

**Base Config**: `jest.config.base.js`
```javascript
module.exports = {
  testTimeout: 120000
};
```

**Node Config**: `jest.config.node.js`
```javascript
module.exports = {
  ...require('./jest.config.base'),
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/sync-service/**/*.test.ts'
    // Integration tests temporarily disabled
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@services/(.*)$': '<rootDir>/sync-service/src/services/$1',
    '^@test/(.*)$': '<rootDir>/tests/$1'
  }
};
```

### Karma Configuration (Angular Tests)

**Karma Config**: `frontend-overlay/karma.conf.js`
```javascript
module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    browsers: ['ChromeHeadless'],
    singleRun: true,
    // ... full Angular testing setup
  });
};
```

## 🧪 Test Execution Scripts

### Root Level Scripts
```json
{
  "test:all": "npm run test:node && npm run test:ui",
  "test:node": "jest --config jest.config.node.js",
  "test:ui": "npm --prefix frontend-overlay run test",
  "test:sync": "jest --config jest.config.node.js tests/sync-service",
  "test:integration": "jest --config jest.config.node.js tests/integration"
}
```

### Frontend Overlay Scripts
```json
{
  "test": "ng test --watch=false --browsers=ChromeHeadless"
}
```

## 📊 Current Test Results

### Last Successful Test Run

**Node.js Tests**:
```
> npm run test:node

PASS tests/sync-service/tenant-sync.test.ts
PASS tests/sync-service/device-sync.test.ts

Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        1.867 s
```

**Angular Tests**:
```
> npm run test:ui

Chrome Headless: Executed 31 of 31 SUCCESS (0.234 secs / 0.198 secs)
TOTAL: 31 SUCCESS
```

## ⚠️ Gaps and Future Testing Needs

### 🔴 Missing: End-to-End Testing

**Status**: ⚠️ **NOT IMPLEMENTED**  
**Priority**: **HIGH**  
**Requirement**: Complete user journey testing

#### Proposed E2E Test Categories

1. **User Authentication Flow**
   - Login via OIDC
   - Role-based access verification
   - Session management

2. **Device Management E2E**
   - Create device via NPL Engine
   - Verify GraphQL query retrieval
   - Update device and sync verification
   - Delete device and cleanup verification

3. **Tenant Management E2E**
   - Create tenant via NPL Engine
   - Verify tenant configuration
   - Multi-tenant isolation testing
   - Bulk operations validation

4. **Integration Flow E2E**
   - NPL Engine → Sync Service → ThingsBoard
   - Frontend → Interceptor → NPL/GraphQL
   - Error handling across all layers
   - Performance under load

#### Recommended E2E Framework

**Technology**: Cypress or Playwright  
**Location**: `tests/e2e/`  
**Services Required**:
- NPL Engine (port 12000)
- NPL Read Model (port 5555)
- ThingsBoard (port 9090)
- Frontend (port 4200)

### 🟡 Integration Test Limitations

**Current Issue**: Integration tests disabled due to service connectivity requirements

**Resolution Needed**:
1. **Docker Compose Integration**: Tests should start required services
2. **Service Health Checks**: Wait for services to be ready
3. **Test Data Management**: Setup and teardown test data
4. **Environment Isolation**: Separate test database

## 🔨 Test Infrastructure Improvements

### 1. Service Orchestration for Testing

**Proposed**: `docker-compose.test.yml`
```yaml
version: '3.8'
services:
  test-postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: npl_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5435:5432"
  
  test-npl-engine:
    build: ./npl-engine
    depends_on:
      - test-postgres
    environment:
      - DATABASE_URL=postgresql://test:test@test-postgres:5432/npl_test
    ports:
      - "12001:12000"
```

### 2. Test Data Management

**Proposed**: Test data fixtures and cleanup utilities
```typescript
// tests/fixtures/test-data.ts
export const testDevices = {
  validDevice: {
    id: "test-device-001",
    name: "Test Device",
    type: "sensor",
    tenantId: "test-tenant-001"
  }
};

// tests/utils/test-cleanup.ts
export async function cleanupTestData() {
  // Remove test devices, tenants, etc.
}
```

### 3. Performance Testing

**Proposed**: Load testing with k6 or Artillery
```javascript
// tests/performance/device-crud.js
import { check } from 'k6';
import http from 'k6/http';

export default function () {
  // Test device creation under load
  const response = http.post('http://localhost:12000/api/deviceManagement.DeviceManagement/saveDevice', {
    // ... test payload
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## 🎯 Testing Strategy Success Metrics

### ✅ Achieved Metrics

1. **Test Separation**: Successfully isolated Node.js and Angular test environments
2. **Framework Integration**: Jest + Karma working in harmony
3. **Mock-Free NPL Testing**: Direct protocol testing without complex mocking
4. **Parallel Execution**: Independent test runs for faster feedback
5. **100% Pass Rate**: All implemented tests passing consistently

### 🎯 Target Metrics (with E2E)

1. **Coverage**: >90% code coverage across all components
2. **Performance**: All operations < 500ms response time
3. **Reliability**: 99.9% test pass rate
4. **E2E Coverage**: Complete user journey validation
5. **Integration**: Full service integration testing

## 📝 Test Development Guidelines

### 1. NPL Protocol Testing

```typescript
// ✅ GOOD: Direct protocol testing
@test
function test_device_validation(test: Test) -> {
  var deviceManagement = DeviceManagement['tenant_admin', 'customer_user']();
  
  var device = Device(
    id = "test-device-001",
    name = "Test Device",
    type = "sensor",
    tenantId = "tenant-001"
  );
  
  var result = deviceManagement.saveDevice['tenant_admin'](device);
  test.assertEquals("test-device-001", result.id);
}
```

### 2. Angular Service Testing

```typescript
// ✅ GOOD: Jasmine spy objects with TestBed
beforeEach(() => {
  const nplSpy = jasmine.createSpyObj('DeviceNplService', ['createDevice']);
  const gqlSpy = jasmine.createSpyObj('DeviceGraphQLService', ['getDevice']);

  TestBed.configureTestingModule({
    providers: [
      { provide: DeviceNplService, useValue: nplSpy },
      { provide: DeviceGraphQLService, useValue: gqlSpy }
    ]
  });
});
```

### 3. Integration Testing

```typescript
// 🎯 TARGET: Service integration testing
describe('Device Management Integration', () => {
  beforeAll(async () => {
    await startTestServices();
  });

  afterAll(async () => {
    await stopTestServices();
    await cleanupTestData();
  });

  it('should create device end-to-end', async () => {
    // Test complete flow: NPL → Sync → ThingsBoard → GraphQL
  });
});
```

## 🚀 Next Steps for Complete Testing Coverage

### Immediate (Required for Production)
1. **Implement E2E Testing Framework** (Cypress/Playwright)
2. **Enable Integration Tests** with Docker Compose
3. **Add Performance Testing** for load validation

### Medium-term (Quality Improvements)
1. **Increase Unit Test Coverage** to >90%
2. **Add Chaos Engineering** tests
3. **Implement Contract Testing** between services

### Long-term (DevOps Integration)
1. **CI/CD Pipeline Integration** with automated testing
2. **Test Report Dashboards** for monitoring
3. **Automated Test Data Management**

---

## 📋 Summary

**Current Status**: ✅ **STRONG FOUNDATION**
- 41/41 unit and service tests passing (100%)
- Robust testing infrastructure in place
- Clear separation of concerns

**Critical Gap**: ⚠️ **END-TO-END TESTING**
- No complete user journey validation
- Integration tests disabled due to service dependencies
- Performance under load not validated

**Recommendation**: Implement E2E testing before production deployment to ensure complete system validation.

---

*Testing Strategy Documentation*  
*Generated: January 2025*  
*NPL Modernization Team*
