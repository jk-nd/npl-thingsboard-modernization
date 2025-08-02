# Hybrid NPL-ThingsBoard Architecture

## Architectural Principles

Given NPL's strengths (protocols, business logic, state management) and limitations (time-series data, real-time streams), the optimal modernization approach is a **domain-driven hybrid architecture**.

## Component Separation by Domain

### 1. NPL Domain: Business Logic & Reference Data
**What NPL handles best:**
- Device lifecycle management (creation, updates, deletion)
- Business rules and permissions
- Device-customer relationships
- Device profiles and configurations
- User access control
- Audit trails and compliance

```npl
protocol[tenant_admin, customer_user] DeviceManagement() {
  permission[tenant_admin] createDevice(device: Device) {
    // Business logic for device creation
    require(device.type != "", "Device type required");
    // Emit event for telemetry system
    notify DeviceCreated(device.id, device.type);
  }
}
```

### 2. ThingsBoard Domain: Time-Series & Transport
**What ThingsBoard keeps:**
- Time-series data storage (`ts_kv`, `ts_kv_latest`)
- Transport protocols (MQTT, CoAP, HTTP, LwM2M)
- WebSocket connections for real-time updates
- Data processing pipelines
- Alerting and rule engine for telemetry

## NPL as Authorization Gateway

### Security Requirement
**Critical**: No frontend should access telemetry data without NPL authorization. NPL acts as the **authorization gateway** for ALL data access, ensuring users can only see devices they have permission to access.

### Authorization Flow for Telemetry

#### Current State (Intermediary)
```
1. User requests telemetry for device X
2. NPL checks: Can this user access device X?
3. If authorized: Generate temporary access token/permission
4. Forward request to ThingsBoard with authorization proof
5. ThingsBoard returns telemetry data
6. NPL optionally filters/transforms data based on permissions
```

#### Future State (with Keycloak)
```
1. User authenticates with Keycloak
2. Keycloak issues JWT with user claims
3. NPL validates JWT and extracts user permissions
4. User requests telemetry for device X
5. NPL checks: Does user's role allow access to device X?
6. If authorized: NPL proxies request to ThingsBoard
7. Return telemetry data (potentially filtered by NPL)
```

## Transition Plan: From Current to Target State

### Current State (Today)
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Angular)                       │
├─────────────────────────────────────────────────────────────┤
│  NPL Overlay Interceptor                                    │
│  Device CRUD → NPL | Telemetry → ThingsBoard (Direct)      │
└─────────────────┬───────────────────────────┬───────────────┘
                  │                           │
                  ▼                           ▼
         ┌─────────────────┐          ┌─────────────────┐
         │   NPL Stack     │          │ ThingsBoard     │
         │                 │          │                 │
         │ • Device CRUD   │          │ • Telemetry     │
         │ • Business      │          │ • Auth (TB)     │
         │   Rules         │          │ • Transport     │
         │ • GraphQL       │          │ • WebSockets    │
         └─────────────────┘          └─────────────────┘

Issues:
- Direct telemetry access bypasses NPL authorization
- ThingsBoard manages its own authentication
- No centralized audit trail for data access
```

### Phase 1: NPL Authorization Gateway (Next 2-4 weeks)
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Angular)                       │
├─────────────────────────────────────────────────────────────┤
│  Enhanced NPL Interceptor                                   │
│  ALL requests → NPL Authorization Gateway                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
         ┌─────────────────────────────────────────────────────┐
         │           NPL Authorization Gateway                 │
         │  • Check device access permissions                 │
         │  • Generate temporary access tokens                │
         │  • Audit all access attempts                       │
         │  • Route to appropriate backend                    │
         └─────────────────┬───────────────┬───────────────────┘
                           │               │
                           ▼               ▼
         ┌─────────────────┐       ┌─────────────────┐
         │   NPL Stack     │       │ ThingsBoard     │
         │                 │       │  (Data Only)    │
         │ • Device CRUD   │       │                 │
         │ • Business      │       │ • Telemetry     │
         │   Rules         │       │ • Transport     │
         │ • Authorization │       │ • WebSockets    │
         │ • Audit Logs    │       │   (Authorized)  │
         └─────────────────┘       └─────────────────┘

Deliverables:
✓ NPL TelemetryAuthorization protocol
✓ Authorization Gateway service
✓ Enhanced frontend interceptor
✓ Temporary token generation
✓ All telemetry requests go through NPL
```

### Phase 2: Enhanced Security & Monitoring (Weeks 5-8)
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Angular)                       │
├─────────────────────────────────────────────────────────────┤
│  Security-Enhanced NPL Interceptor                          │
│  • Token refresh logic                                      │
│  • Session management                                       │
│  • Security headers                                         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
         ┌─────────────────────────────────────────────────────┐
         │      Enhanced NPL Authorization Gateway             │
         │  • Fine-grained permissions                        │
         │  • Rate limiting                                   │
         │  • Data filtering by user role                     │
         │  • Real-time security monitoring                   │
         │  • WebSocket authorization                         │
         └─────────────────┬───────────────┬───────────────────┘
                           │               │
                           ▼               ▼
         ┌─────────────────┐       ┌─────────────────┐
         │   NPL Stack     │       │ ThingsBoard     │
         │                 │       │                 │
         │ • Advanced      │       │ • Telemetry     │
         │   Permissions   │       │ • Transport     │
         │ • Data          │       │ • Processing    │
         │   Filtering     │       │ • Storage Only  │
         │ • Audit Trail   │       │                 │
         └─────────────────┘       └─────────────────┘

Deliverables:
✓ Advanced permission models in NPL
✓ Data filtering based on user roles
✓ WebSocket authorization
✓ Rate limiting and monitoring
✓ Security audit dashboard
```

### Phase 3: Keycloak Integration (Weeks 9-12)
```
                    ┌─────────────────┐
                    │    Keycloak     │
                    │  • JWT Tokens   │
                    │  • Role Mgmt    │
                    │  • SSO          │
                    └─────────┬───────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Frontend (Angular)                       │
├─────────────────────────────────────────────────────────────┤
│  Keycloak + NPL Interceptor                                 │
│  • JWT validation                                           │
│  • Role-based routing                                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
         ┌─────────────────────────────────────────────────────┐
         │    Keycloak-NPL Authorization Gateway               │
         │  • JWT validation                                  │
         │  • Keycloak role → NPL party mapping              │
         │  • Multi-tenant support                           │
         │  • External identity provider integration          │
         └─────────────────┬───────────────┬───────────────────┘
                           │               │
                           ▼               ▼
         ┌─────────────────┐       ┌─────────────────┐
         │   NPL Stack     │       │ ThingsBoard     │
         │                 │       │                 │
         │ • External      │       │ • Telemetry     │
         │   Auth          │       │ • Transport     │
         │ • Role          │       │ • Processing    │
         │   Mapping       │       │ • Storage Only  │
         │ • Multi-tenant  │       │                 │
         └─────────────────┘       └─────────────────┘

Deliverables:
✓ Keycloak integration
✓ JWT validation in NPL
✓ Role mapping service
✓ Multi-tenant support
✓ Migration from ThingsBoard auth
```

### Phase 4: Complete Migration (Weeks 13-16)
```
                    ┌─────────────────┐
                    │    Keycloak     │
                    │  • All Auth     │
                    │  • SSO/SAML     │
                    │  • External IDP │
                    └─────────┬───────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Frontend (Angular)                       │
├─────────────────────────────────────────────────────────────┤
│  Pure NPL Integration                                        │
│  • No ThingsBoard auth dependencies                         │
│  • Clean separation of concerns                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
         ┌─────────────────────────────────────────────────────┐
         │         Complete NPL Authorization                  │
         │  • Zero trust architecture                         │
         │  • Complete audit trail                           │
         │  • Advanced business rules                         │
         │  • Real-time permission updates                   │
         └─────────────────┬───────────────┬───────────────────┘
                           │               │
                           ▼               ▼
         ┌─────────────────┐       ┌─────────────────┐
         │   NPL Stack     │       │ ThingsBoard     │
         │                 │       │                 │
         │ • Complete      │       │ • Pure Data     │
         │   Business      │       │   Layer         │
         │   Logic         │       │ • Transport     │
         │ • All Auth      │       │ • Storage       │
         │ • Audit         │       │ • Processing    │
         └─────────────────┘       └─────────────────┘

Target State Achieved:
✓ NPL is the single source of truth for authorization
✓ ThingsBoard is pure data/transport layer
✓ Complete audit trail
✓ Zero trust security model
✓ Keycloak handles all authentication
```

## Detailed Implementation Steps

### Phase 1: NPL Authorization Gateway (Weeks 1-4)

#### Week 1: NPL Protocol Development
```npl
// File: npl-modernization/api/src/main/npl-1.0.0/telemetry/TelemetryAuthorization.npl
protocol[sys_admin, tenant_admin, customer_user] TelemetryAuthorization() {
  
  permission[sys_admin | tenant_admin | customer_user] canAccessDevice(
    deviceId: Text
  ) returns Boolean {
    // Implementation details in previous sections
  };
  
  permission[sys_admin | tenant_admin | customer_user] generateTelemetryToken(
    deviceId: Text,
    duration: Number
  ) returns Text {
    // Generate JWT with device access permissions
  };
  
  permission[sys_admin | tenant_admin | customer_user] validateTelemetryAccess(
    deviceId: Text,
    accessType: Text
  ) returns Boolean {
    // Validate specific access types (read, subscribe, etc.)
  };
}
```

#### Week 2: Authorization Gateway Service
```typescript
// File: npl-modernization/sync-service/src/services/AuthorizationGateway.ts
@Injectable()
export class NPLAuthorizationGateway {
  
  async proxyTelemetryRequest(
    req: HttpRequest<any>,
    user: User
  ): Promise<HttpResponse<any>> {
    
    const deviceId = this.extractDeviceId(req.url);
    
    // 1. Check NPL permissions
    const hasAccess = await this.nplEngine.call('canAccessDevice', {
      deviceId
    }, user.nplPartyInfo);
    
    if (!hasAccess) {
      throw new ForbiddenException('Device access denied');
    }
    
    // 2. Generate access token
    const token = await this.nplEngine.call('generateTelemetryToken', {
      deviceId,
      duration: 15
    }, user.nplPartyInfo);
    
    // 3. Proxy to ThingsBoard with token
    return await this.proxyToThingsBoard(req, token);
  }
}
```

#### Week 3: Frontend Interceptor Updates
```typescript
// File: npl-modernization/frontend-overlay/src/app/npl-modernization/interceptors/
@Injectable()
export class NPLAuthorizationInterceptor implements HttpInterceptor {
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    // Route ALL requests through NPL authorization
    if (this.isTelemetryRequest(req)) {
      return this.authGateway.proxyTelemetryRequest(req);
    }
    
    if (this.isDeviceRequest(req)) {
      return this.transformer.transformToNPL(req);
    }
    
    // All other requests also need authorization check
    return this.authGateway.authorizeAndProxy(req);
  }
  
  private isTelemetryRequest(req: HttpRequest<any>): boolean {
    return req.url.includes('/api/plugins/telemetry/') ||
           req.url.includes('/api/ws/plugins/telemetry');
  }
}
```

#### Week 4: Testing & Integration
- Unit tests for authorization logic
- Integration tests for telemetry access
- End-to-end testing of authorization flow
- Performance testing of authorization overhead

### Phase 2: Enhanced Security (Weeks 5-8)

#### Advanced Permission Models
```npl
protocol[sys_admin, tenant_admin, customer_user] AdvancedTelemetryAuth() {
  
  permission[sys_admin | tenant_admin | customer_user] canAccessTelemetryKeys(
    deviceId: Text,
    keys: List<Text>
  ) returns List<Text> {
    // Return only the keys user is allowed to see
    var allowedKeys = listOf<Text>();
    
    if (activeParty() == sys_admin) {
      return keys; // Sys admin sees all
    };
    
    for (key in keys) {
      if (isKeyAllowedForUser(deviceId, key)) {
        allowedKeys = allowedKeys.with(key);
      };
    };
    
    return allowedKeys;
  };
  
  permission[sys_admin | tenant_admin | customer_user] getDataFilter(
    deviceId: Text
  ) returns Optional<Text> {
    // Return SQL-like filter for data access
    if (activeParty() == customer_user) {
      return optionalOf("timestamp > now() - interval '24 hours'");
    };
    
    return optionalOf(); // No filter for admins
  };
}
```

### Phase 3: Keycloak Integration (Weeks 9-12)

#### Keycloak Service Integration
```typescript
@Injectable()
export class KeycloakNPLAuthService {
  
  async validateAndMapUser(keycloakJWT: string): Promise<NPLUserContext> {
    // 1. Validate JWT with Keycloak
    const claims = await this.keycloak.validateToken(keycloakJWT);
    
    // 2. Map Keycloak roles to NPL parties
    const nplParty = this.mapRolesToNPLParty(claims.realm_access.roles);
    
    // 3. Extract tenant/customer info
    const tenantId = claims.tenant_id || 'default';
    const customerId = claims.customer_id;
    
    return {
      party: nplParty,
      tenantId,
      customerId,
      userId: claims.sub,
      email: claims.email
    };
  }
}
```

### Phase 4: Complete Migration (Weeks 13-16)

#### Remove ThingsBoard Auth Dependencies
```typescript
// Remove all ThingsBoard authentication code
// Update all services to use NPL authorization only
// Migrate existing users to Keycloak
// Update documentation and deployment scripts
```

## Migration Checklist

### Phase 1 Checklist
- [ ] NPL TelemetryAuthorization protocol implemented
- [ ] Authorization Gateway service created
- [ ] Frontend interceptor updated
- [ ] All telemetry requests go through NPL
- [ ] Temporary token generation working
- [ ] WebSocket authorization implemented
- [ ] Integration tests passing
- [ ] Performance impact assessed

### Phase 2 Checklist
- [ ] Fine-grained permission models
- [ ] Data filtering by user role
- [ ] Rate limiting implemented
- [ ] Security monitoring dashboard
- [ ] Audit trail complete
- [ ] WebSocket security enhanced
- [ ] Load testing completed

### Phase 3 Checklist
- [ ] Keycloak server deployed
- [ ] JWT validation implemented
- [ ] Role mapping service created
- [ ] Multi-tenant support added
- [ ] User migration plan executed
- [ ] SSO integration tested
- [ ] External IDP connections tested

### Phase 4 Checklist
- [ ] ThingsBoard auth completely removed
- [ ] All users migrated to Keycloak
- [ ] Zero trust architecture verified
- [ ] Complete audit trail operational
- [ ] Documentation updated
- [ ] Training completed
- [ ] Production deployment successful

## Risk Mitigation

### Technical Risks
1. **Performance Impact**: Authorization adds latency
   - Mitigation: Token caching, parallel processing
   - Monitoring: Response time metrics

2. **Single Point of Failure**: NPL becomes critical path
   - Mitigation: NPL clustering, fallback mechanisms
   - Monitoring: NPL availability metrics

3. **Migration Complexity**: Multiple systems involved
   - Mitigation: Gradual rollout, feature flags
   - Monitoring: Error rates during migration

### Business Risks
1. **User Disruption**: Authentication changes affect users
   - Mitigation: Gradual migration, user training
   - Communication: Clear migration timeline

2. **Security Gaps**: Temporary vulnerabilities during migration
   - Mitigation: Security reviews at each phase
   - Testing: Penetration testing

This comprehensive transition plan ensures a smooth migration from the current state to a fully secure, NPL-controlled architecture while maintaining system availability and user experience.

## Updated Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Angular)                   │
├─────────────────────────────────────────────────────────────┤
│  NPL Overlay Interceptor                                    │
│  ALL requests → NPL Authorization Gateway                   │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                NPL Authorization Gateway                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           NPL Authorization Service                     ││
│  │  • Validate user permissions                           ││
│  │  • Check device access rights                          ││
│  │  • Generate access tokens                              ││
│  │  • Audit all access attempts                           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────┬───────────────────────────┬───────────────┘
                  │                           │
                  ▼                           ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│           NPL Stack             │ │       ThingsBoard Stack         │
│                                 │ │    (Data Storage Only)          │
│ ┌─────────────────────────────┐ │ │ ┌─────────────────────────────┐ │
│ │        NPL Engine           │ │ │ │     Transport Layer         │ │
│ │  • Device Management        │ │ │ │  • MQTT Broker              │ │
│ │  • Business Rules           │ │ │ │  • CoAP Server              │ │
│ │  • Permissions              │ │ │ │  • HTTP Transport           │ │
│ │  • Audit Logs              │ │ │ │  • LwM2M Server             │ │
│ └─────────────────────────────┘ │ │ └─────────────────────────────┘ │
│                                 │ │                                 │
│ ┌─────────────────────────────┐ │ │ ┌─────────────────────────────┐ │
│ │      NPL Read Model         │ │ │ │     Rule Engine             │ │
│ │  • GraphQL API             │ │ │ │  • Telemetry Processing     │ │
│ │  • Device Queries           │ │ │ │  • Alarm Generation         │ │
│ │  • Metadata Access          │ │ │ │  • Data Transformation      │ │
│ └─────────────────────────────┘ │ │ └─────────────────────────────┘ │
│                                 │ │                                 │
│            AMQP/RabbitMQ        │ │ ┌─────────────────────────────┐ │
│         (Event Bus)             │ │ │    Time-Series Storage      │ │
│                                 │ │ │  • PostgreSQL + TimescaleDB │ │
│                                 │ │ │  • ts_kv tables             │ │
│                                 │ │ │  • WebSocket endpoints      │ │
│                                 │ │ └─────────────────────────────┘ │
└─────────────────┬───────────────┘ └─────────────────┬───────────────┘
                  │                                   │
                  └──────────── Event Bridge ────────┘
                        (RabbitMQ + Sync Service)
```

## Authorization Implementation

### NPL Authorization Protocol

```npl
protocol[sys_admin, tenant_admin, customer_user] TelemetryAuthorization() {
  
  /**
   * Check if user can access device telemetry
   */
  permission[sys_admin | tenant_admin | customer_user] canAccessDeviceTelemetry(
    deviceId: Text,
    telemetryType: Text
  ) returns Boolean {
    
    // Get device from NPL
    var device = getDevice(deviceId);
    require(device.isPresent(), "Device not found");
    
    // Check permissions based on user role
    if (activeParty() == sys_admin) {
      return true; // Sys admin can access all
    };
    
    if (activeParty() == tenant_admin) {
      return device.get().tenantId == getCurrentTenantId();
    };
    
    if (activeParty() == customer_user) {
      return device.get().customerId == getCurrentCustomerId();
    };
    
    return false;
  };
  
  /**
   * Generate temporary access token for telemetry
   */
  permission[sys_admin | tenant_admin | customer_user] generateTelemetryToken(
    deviceId: Text,
    duration: Number
  ) returns Text {
    
    require(canAccessDeviceTelemetry(deviceId, "read"), "Access denied");
    
    // Generate JWT token valid for specified duration
    var token = generateJWT(mapOf(
      Pair("deviceId", deviceId),
      Pair("userId", getCurrentUserId()),
      Pair("exp", now().plus(minutes(duration)))
    ));
    
    // Audit the access
    notify TelemetryAccessGranted(deviceId, getCurrentUserId(), now());
    
    return token;
  };
}
```

### Authorization Gateway Service

```typescript
@Injectable()
export class NPLAuthorizationGateway {
  
  constructor(
    private nplEngine: NplEngineService,
    private thingsboardClient: ThingsBoardClient
  ) {}
  
  /**
   * Proxy telemetry request through NPL authorization
   */
  async getTelemetryData(
    userId: string, 
    deviceId: string, 
    telemetryRequest: TelemetryRequest
  ): Promise<TelemetryResponse> {
    
    // 1. Check authorization via NPL
    const canAccess = await this.nplEngine.call('canAccessDeviceTelemetry', {
      deviceId,
      telemetryType: 'read'
    });
    
    if (!canAccess) {
      throw new ForbiddenException('Access denied to device telemetry');
    }
    
    // 2. Generate temporary access token
    const accessToken = await this.nplEngine.call('generateTelemetryToken', {
      deviceId,
      duration: 15 // 15 minutes
    });
    
    // 3. Forward to ThingsBoard with authorization proof
    const telemetryData = await this.thingsboardClient.getTelemetry({
      deviceId,
      ...telemetryRequest,
      accessToken // Include NPL-generated token
    });
    
    // 4. Optional: Filter data based on fine-grained permissions
    return this.filterTelemetryByPermissions(userId, telemetryData);
  }
  
  /**
   * Proxy WebSocket connections through NPL authorization
   */
  async authorizeWebSocketConnection(
    userId: string,
    deviceId: string
  ): Promise<string> {
    
    const canAccess = await this.nplEngine.call('canAccessDeviceTelemetry', {
      deviceId,
      telemetryType: 'subscribe'
    });
    
    if (!canAccess) {
      throw new ForbiddenException('WebSocket access denied');
    }
    
    // Generate long-lived token for WebSocket
    return await this.nplEngine.call('generateTelemetryToken', {
      deviceId,
      duration: 60 // 1 hour for WebSocket
    });
  }
}
```

## Migration Phases

### Phase 1: NPL Authorization Layer (Current → Intermediary)

```typescript
// Frontend interceptor update
@Injectable()
export class NPLAuthorizationInterceptor implements HttpInterceptor {
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    // ALL requests go through NPL first
    if (this.isTelemetryRequest(req)) {
      return this.authGateway.proxyTelemetryRequest(req);
    }
    
    if (this.isDeviceRequest(req)) {
      return this.transformer.transformToNPL(req);
    }
    
    // Other requests still need authorization check
    return this.authGateway.authorizeAndProxy(req);
  }
}
```

### Phase 2: Keycloak Integration

```typescript
// Keycloak + NPL authorization
@Injectable()
export class KeycloakNPLAuthService {
  
  constructor(
    private keycloak: KeycloakService,
    private nplEngine: NplEngineService
  ) {}
  
  async validateAccess(deviceId: string): Promise<boolean> {
    // 1. Get user from Keycloak JWT
    const userToken = this.keycloak.getToken();
    const userClaims = this.decodeJWT(userToken);
    
    // 2. Map Keycloak roles to NPL parties
    const nplParty = this.mapKeycloakRoleToNPLParty(userClaims.roles);
    
    // 3. Check NPL permissions
    return await this.nplEngine.callAsParty(nplParty, 'canAccessDeviceTelemetry', {
      deviceId,
      telemetryType: 'read'
    });
  }
  
  private mapKeycloakRoleToNPLParty(roles: string[]): string {
    if (roles.includes('system-admin')) return 'sys_admin';
    if (roles.includes('tenant-admin')) return 'tenant_admin';
    if (roles.includes('customer-user')) return 'customer_user';
    throw new Error('Invalid role mapping');
  }
}
```

### Phase 3: Complete Integration

```yaml
# Architecture after Keycloak migration
Authentication: Keycloak
Authorization: NPL Engine
Device Management: NPL Engine  
Telemetry Storage: ThingsBoard
Transport Layer: ThingsBoard

# All data access flows through NPL authorization:
Frontend → Keycloak (auth) → NPL (authz) → ThingsBoard (data)
```

## Security Benefits

1. **Centralized Authorization**: All access controlled by NPL business rules
2. **Audit Trail**: Every telemetry access logged in NPL
3. **Fine-grained Permissions**: Can implement complex access rules
4. **Token-based Security**: Temporary tokens limit exposure
5. **Zero Trust**: No direct ThingsBoard access from frontend

## WebSocket Authorization

```typescript
// WebSocket with NPL authorization
class AuthorizedWebSocketService {
  
  async connectToDeviceTelemetry(deviceId: string): Promise<WebSocket> {
    // 1. Get authorization from NPL
    const wsToken = await this.authGateway.authorizeWebSocketConnection(
      this.currentUser.id, 
      deviceId
    );
    
    // 2. Connect with NPL-issued token
    const ws = new WebSocket(`ws://localhost:8081/api/ws/plugins/telemetry?token=${wsToken}&deviceId=${deviceId}`);
    
    // 3. NPL validates token on ThingsBoard side
    return ws;
  }
}
```

This approach ensures that NPL acts as the **security perimeter** for all data access, while still leveraging ThingsBoard's time-series capabilities.

## Data Flow Patterns

### 1. Device Management Flow (NPL-First)
```
1. User creates device via UI (8081)
2. Request routed to NPL Engine
3. NPL validates business rules
4. NPL stores device metadata
5. NPL emits DeviceCreated event
6. Sync Service creates device in ThingsBoard
7. ThingsBoard ready to receive telemetry
```

### 2. Telemetry Flow (ThingsBoard-First)
```
1. IoT device sends data via MQTT/CoAP
2. ThingsBoard transport receives data
3. Data stored in ts_kv tables
4. Rule engine processes data
5. WebSocket pushes to UI (real-time)
6. Optional: Events to NPL for business logic
```

### 3. Query Flow (Hybrid)
```
Device Metadata:  UI → NPL Read Model → GraphQL
Telemetry Data:   UI → ThingsBoard → REST/WebSocket
```

## Database Strategy

### NPL Database (PostgreSQL)
```sql
-- NPL stores business entities
CREATE TABLE devices (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  tenant_id UUID,
  customer_id UUID,
  created_at TIMESTAMP,
  -- Business metadata only
);

CREATE TABLE device_profiles (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  configuration JSONB
);
```

### ThingsBoard Database (PostgreSQL + TimescaleDB)
```sql
-- Keep existing time-series schema
-- ts_kv: Historical telemetry
-- ts_kv_latest: Latest values
-- ts_kv_dictionary: Key mappings

-- Optional: Add TimescaleDB for better performance
SELECT create_hypertable('ts_kv', 'ts');
```

## Event-Driven Integration

### RabbitMQ Event Topics
```yaml
Device Events:
  - device.created
  - device.updated
  - device.deleted
  - device.assigned
  - device.credentials.updated

Telemetry Events (Optional):
  - telemetry.alarm.high
  - telemetry.alarm.critical
  - device.offline
  - device.online
```

### NPL Event Notifications
```npl
protocol[tenant_admin] DeviceManagement() {
  permission[tenant_admin] createDevice(device: Device) {
    // Business logic...
    
    // Emit event for ThingsBoard sync
    notify DeviceCreated {
      deviceId: device.id,
      type: device.type,
      tenantId: this.tenantId
    };
  }
}
```

## Transport Layer Strategy

### Keep ThingsBoard Transport Components
```yaml
MQTT Broker:
  - Handles device connections
  - Processes telemetry ingestion
  - Manages device credentials

CoAP Server:
  - Lightweight protocol support
  - Battery-efficient devices

HTTP Transport:
  - REST API for devices
  - Bulk data uploads

LwM2M Server:
  - Device management protocol
  - Firmware updates
```

### NPL Integration Points
```typescript
// Device credentials via NPL
@Injectable()
export class DeviceCredentialsService {
  
  // NPL manages credentials business logic
  async updateCredentials(deviceId: string, credentials: any) {
    const result = await this.nplEngine.call('updateDeviceCredentials', {
      deviceId, credentials
    });
    
    // Sync to ThingsBoard transport layer
    await this.syncToThingsBoard(deviceId, credentials);
    return result;
  }
}
```

## Recommended Migration Strategy

### Phase 1: Reference Data (Current)
- Device CRUD → NPL
- User management → NPL  
- Permissions → NPL
- Keep telemetry in ThingsBoard

### Phase 2: Enhanced Integration
- Add TimescaleDB for better time-series performance
- Implement NPL business rules for telemetry
- Add alerting integration

### Phase 3: Streaming Events (Future)
- NPL event streams for business events
- Real-time business rule processing
- Advanced analytics integration

## Benefits of This Approach

1. **Leverages NPL Strengths**: Business logic, permissions, audit
2. **Keeps ThingsBoard Strengths**: Time-series, transport, real-time
3. **Incremental Migration**: Can migrate piece by piece
4. **Performance**: Each system handles what it's optimized for
5. **Maintainability**: Clear separation of concerns

## Technical Implementation

### Sync Service Enhancement
```typescript
export class EnhancedSyncService {
  
  // Two-way sync for device metadata
  async syncDeviceFromNPL(device: Device) {
    await this.thingsboardClient.createDevice({
      id: device.id,
      name: device.name,
      type: device.type,
      // Only sync metadata, not business logic
    });
  }
  
  // Business events from telemetry
  async handleTelemetryAlarm(alarm: TelemetryAlarm) {
    await this.nplEngine.call('handleDeviceAlarm', {
      deviceId: alarm.deviceId,
      severity: alarm.severity,
      // Trigger business logic in NPL
    });
  }
}
```

This architecture maximizes the strengths of both systems while providing a clear path for incremental modernization. 