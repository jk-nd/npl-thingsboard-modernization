# Device Read Modernization Session - August 9/10, 2025

## Session Overview

This session focused on resolving the critical issue where devices created through NPL were not appearing in the ThingsBoard UI device list. The goal was to ensure that all device read operations go through GraphQL to NPL as the "golden source" instead of falling back to the legacy ThingsBoard database.

## Problem Statement

- **Initial Issue**: Device creation through NPL was working (write operations successful)
- **Core Problem**: Device list in UI showed "No devices found" despite successful device creation
- **Root Cause**: UI was not properly reading from NPL GraphQL endpoint due to multiple configuration and architectural issues

## Key Findings

### 1. Database Permissions Issue
- **Problem**: GraphQL queries returned `"permission denied for schema noumena"`
- **Root Cause**: PostGraphile user lacked access to the `noumena` schema in NPL database
- **Solution**: Granted necessary permissions:
  ```sql
  GRANT USAGE ON SCHEMA noumena TO postgraphile;
  GRANT SELECT ON ALL TABLES IN SCHEMA noumena TO postgraphile;
  ALTER DEFAULT PRIVILEGES IN SCHEMA noumena GRANT SELECT ON TABLES TO postgraphile;
  ```

### 2. NPL Protocol Variable Visibility
- **Problem**: Private NPL protocol variables are not exposed to GraphQL read model
- **Root Cause**: Variables declared as `private var` in NPL protocols cannot be queried via GraphQL
- **Solution**: Modified NPL protocols to make key data structures public:
  
  **DeviceManagement.npl**:
  ```npl
  // Changed from private var to var for GraphQL access
  var devices: Map<Text, Device> = mapOf<Text, Device>();
  var deviceCredentials: Map<Text, DeviceCredentialsManager> = mapOf<Text, DeviceCredentialsManager>();
  var customerAssignments: Map<Text, CustomerAssignment> = mapOf<Text, CustomerAssignment>();
  var edgeAssignments: Map<Text, EdgeAssignment> = mapOf<Text, EdgeAssignment>();
  ```
  
  **TenantManagement.npl**:
  ```npl
  var tenants: Map<Text, Tenant> = mapOf<Text, Tenant>();
  var tenantInfos: Map<Text, TenantInfo> = mapOf<Text, TenantInfo>();
  ```

### 3. NPL Map Storage Architecture Discovery
- **Critical Finding**: NPL maps (like `devices: Map<Text, Device>`) are NOT automatically decomposed into individual `protocolFieldsStructs` entries
- **Implication**: The GraphQL query `protocolFieldsStructs(filter: {field: {equalTo: "devices"}})` returns empty because maps are stored as single protocol fields, not as individual map entries
- **Current Status**: This is the remaining blocker - we can query `protocolFieldsStructs` but it doesn't contain the individual device entries

## Changes Made

### 1. NPL Protocol Updates
- **Files Modified**:
  - `npl-modernization/api/src/main/npl-1.0.0/deviceManagement/deviceManagement.npl`
  - `npl-modernization/api/src/main/npl-1.0.0/tenantManagement/tenantManagement.npl`
- **Changes**:
  - Made core data maps public (removed `private` keyword)
  - Added explicit type annotations
  - Fixed `deleteTenant` permission to include proper state transition (`become deleted;`)
  - Added missing `final state deleted;` in TenantManagement

### 2. Automated Protocol Bootstrapping
- **File Modified**: `start.sh`
- **Change**: Integrated `npl-modernization/bootstrap-protocols.sh` into startup sequence
- **Benefit**: NPL protocol instances are now automatically created on stack startup
- **Location in Script**: After NPL engine and ThingsBoard core are healthy (Step 6)

### 3. Database Configuration
- **Manual Fix**: Database permissions granted to `postgraphile` user
- **Effect**: Eliminated "permission denied" errors for GraphQL queries
- **Service**: Restarted `read-model` service to pick up new permissions

### 4. Service Worker GraphQL Query
- **File Modified**: `ui-ngx/src/assets/overlay/npl-service-worker.js`
- **Updated Query**: Modified to query `protocolFieldsStructs` for devices field
- **Current Query**:
  ```graphql
  query GetDevicesFromNPL {
    protocolFieldsStructs(first: 50, filter: {field: {equalTo: "devices"}}) {
      nodes {
        protocolId
        field
        value
      }
      totalCount
    }
  }
  ```

## Current Status

### ✅ Resolved Issues
1. GraphQL permission errors fixed
2. NPL protocol variables made public and accessible
3. Protocol bootstrapping automated
4. Service Worker properly configured for GraphQL calls
5. Database grants applied successfully

### ❌ Remaining Issue
**Core Problem**: `protocolFieldsStructs` query returns empty results because NPL maps are not decomposed into individual queryable field entries.

**Database Evidence**:
- `protocol_fields_struct` table: 0 rows
- `protocol_states` table: Contains DeviceManagement protocol instances
- Created devices exist within protocol instances but not as separate GraphQL-queryable entities

## Next Steps & Solutions

### Option 1: NPL Engine API for Device Reads (Recommended)
- **Approach**: Use NPL Engine API calls to read devices from public protocol variables
- **Method**: Call `getAllDevices()` or similar permission via NPL Engine
- **Benefit**: Leverages existing NPL infrastructure
- **Implementation**: Modify Service Worker to use NPL Engine for device list reads

### Option 2: Modify NPL Protocol Architecture
- **Approach**: Store each device as individual protocol field instead of in a map
- **Benefit**: Makes devices individually queryable via GraphQL
- **Downside**: Requires significant NPL protocol restructuring

### Option 3: Create NPL Read Model Enhancement
- **Approach**: Enhance NPL read model to decompose maps into queryable fields
- **Scope**: Requires changes to NPL Engine itself
- **Timeline**: Long-term solution

## Testing Evidence

### Successful GraphQL Connection
```json
{"data":{"protocolFieldsStructs":{"nodes":[],"totalCount":0}}}
```
- ✅ No permission errors
- ✅ GraphQL endpoint accessible
- ❌ Empty results (expected given map storage architecture)

### Successful Device Creation
- ✅ NPL Engine API calls work
- ✅ Devices stored in protocol instances
- ✅ Protocol instances visible in `protocol_states` table

### Database State
```sql
-- DeviceManagement protocol instances exist
SELECT protocol_id, current_state, proto_ref_id 
FROM noumena.protocol_states 
WHERE proto_ref_id LIKE '%DeviceManagement%';

-- Results: 2 active DeviceManagement protocol instances
```

## Configuration Files Modified

1. **start.sh** - Added protocol bootstrapping
2. **deviceManagement.npl** - Made variables public, fixed linting
3. **tenantManagement.npl** - Made variables public, added final state
4. **Service Worker** - Updated GraphQL queries for protocolFieldsStructs

## Architecture Insights

### NPL Read Model Structure
- **Protocol States**: Stored in `noumena.protocol_states`
- **Protocol Fields**: Simple fields stored in `noumena.protocol_fields_struct`
- **Maps**: Stored as protocol state, NOT decomposed into individual fields
- **Implication**: Complex data structures require NPL Engine API access, not GraphQL

### Hybrid Architecture Decision
Given the findings, the optimal architecture is:
- **Writes**: NPL Engine API (already working)
- **Simple Reads**: GraphQL for individual fields and metadata
- **Complex Reads**: NPL Engine API for map-based data (devices, tenants)
- **Caching**: Service Worker read-your-writes for immediate consistency

## Recommended Immediate Action

Implement **Option 1** in next session:
1. Create NPL Engine API endpoint for device reads
2. Modify Service Worker to route device list requests to NPL Engine
3. Maintain GraphQL for other simpler read operations
4. Keep read-your-writes caching for consistency

This approach leverages our existing infrastructure while solving the immediate device visibility issue.
