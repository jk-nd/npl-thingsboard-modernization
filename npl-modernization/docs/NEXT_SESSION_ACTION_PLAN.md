# Next Session Action Plan - Device Read Completion

## Session Goal
Complete the device read modernization by implementing NPL Engine API reads for map-based data, ensuring devices created in NPL appear immediately in the ThingsBoard UI.

## Priority 1: Implement NPL Engine Device Reads

### Task 1: Create Device List NPL Engine Endpoint
**Objective**: Add NPL Engine API permission to retrieve all devices from DeviceManagement protocol

**Steps**:
1. **Add `getAllDevices()` permission to DeviceManagement.npl**:
   ```npl
   @api
   permission[tenant_admin | sys_admin] getAllDevices() returns List<Device> | active {
       return devices.values().asList();
   };
   ```

2. **Test the endpoint manually**:
   ```bash
   curl -X POST http://localhost:3000/api/npl/deviceManagement/getAllDevices \
     -H "Authorization: Bearer <NPL_TOKEN>" \
     -d '{"protocolId": "<DEVICE_MGMT_PROTOCOL_ID>"}'
   ```

### Task 2: Modify Service Worker for Hybrid Reads
**Objective**: Route device list requests to NPL Engine instead of GraphQL

**File**: `ui-ngx/src/assets/overlay/npl-service-worker.js`

**Changes**:
1. **Update routing logic**:
   ```javascript
   // In routeToGraphQL method
   if (route.graphqlQuery === 'getTenantDeviceInfos') {
     return await this.routeToNplEngineForDeviceList(request, route, authToken);
   }
   ```

2. **Implement `routeToNplEngineForDeviceList()` method**:
   ```javascript
   async routeToNplEngineForDeviceList(request, route, authToken) {
     // Get DeviceManagement protocol instance
     // Call getAllDevices() permission
     // Transform response to ThingsBoard format
     // Return paginated response
   }
   ```

### Task 3: Protocol Instance Discovery
**Objective**: Automatically find the correct DeviceManagement protocol instance for the current tenant

**Approach**:
1. Query GraphQL for protocol instances bound to current tenant
2. Cache protocol ID for subsequent device reads
3. Handle multi-tenant protocol isolation

## Priority 2: Test End-to-End Flow

### Test Sequence
1. **Clean state**: Clear any cached devices
2. **Create device**: Use NPL Engine API via Service Worker
3. **Verify immediate appearance**: Device should appear in UI list without refresh
4. **Verify pagination**: Test with multiple devices
5. **Verify filtering**: Test device search/filter functionality

### Expected Behavior
- ✅ Device creation works (already confirmed)
- ✅ Device immediately appears in list after creation
- ✅ Device details page accessible
- ✅ Read-your-writes consistency maintained

## Priority 3: Error Handling & Edge Cases

### Error Scenarios
1. **No DeviceManagement protocol exists**: Handle gracefully
2. **Multiple protocol instances**: Choose correct one for tenant
3. **Permission denied**: Proper error messages
4. **NPL Engine unavailable**: Fallback strategy

### Performance Considerations
1. **Caching**: Cache protocol instance IDs
2. **Pagination**: Implement proper limit/offset for large device lists
3. **Filtering**: Support device name/type filtering

## Architecture Decision: Hybrid Read Model

### Final Architecture
- **Device/Tenant Writes**: NPL Engine API ✅
- **Device/Tenant Reads**: NPL Engine API (NEW)
- **Simple Data Reads**: GraphQL Read Model
- **Authentication**: OIDC Proxy ✅
- **Caching**: Service Worker read-your-writes ✅

### Rationale
- **NPL maps not decomposed**: GraphQL cannot query individual map entries
- **Protocol state encapsulation**: Complex data requires NPL Engine access
- **Performance**: Direct protocol access is efficient
- **Consistency**: Single source of truth for device data

## Files to Modify

### 1. NPL Protocol
- `npl-modernization/api/src/main/npl-1.0.0/deviceManagement/deviceManagement.npl`
- Add `getAllDevices()` permission
- Consider adding `getDevice(id: Text)` for single device reads

### 2. Service Worker
- `ui-ngx/src/assets/overlay/npl-service-worker.js`
- Implement NPL Engine routing for device reads
- Add protocol instance discovery
- Update response transformation

### 3. Configuration (if needed)
- Update NPL Engine API endpoints in `MODERNIZATION_CONFIG`
- Verify CORS settings for NPL Engine calls

## Success Criteria

### Functional Requirements
- [ ] Device creation followed by immediate visibility in UI
- [ ] Device list pagination works correctly
- [ ] Individual device details accessible
- [ ] Multi-device scenarios work (create 3+ devices)
- [ ] Error handling for edge cases

### Performance Requirements
- [ ] Device list loads in <2 seconds
- [ ] No unnecessary API calls or loops
- [ ] Proper caching behavior

### Technical Requirements
- [ ] No fallback to ThingsBoard database for device reads
- [ ] All device data sourced from NPL
- [ ] Logs clearly show NPL Engine API usage for reads

## Debugging Tools

### Verification Commands
```bash
# Check protocol instances
curl -X POST http://localhost:8081/api/graphql/ \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"query": "{ protocolStates { nodes { protocolId currentState protoRefId } } }"}'

# Test NPL Engine device read
curl -X POST http://localhost:3000/api/npl/deviceManagement/getAllDevices \
  -H "Authorization: Bearer <NPL_TOKEN>" \
  -d '{"protocolId": "<PROTOCOL_ID>"}'
```

### Key Log Messages to Watch
- `📱 Routing to NPL Engine for device list`
- `📋 Found N devices from NPL Engine`
- `🎯 Transformed NPL devices to ThingsBoard format`

## Estimated Timeline
- **Task 1**: 30 minutes (NPL endpoint)
- **Task 2**: 45 minutes (Service Worker changes)
- **Task 3**: 15 minutes (Protocol discovery)
- **Testing**: 30 minutes (End-to-end verification)
- **Total**: ~2 hours

This approach will finally complete the device read modernization and ensure NPL is the true "golden source" for all device operations.
