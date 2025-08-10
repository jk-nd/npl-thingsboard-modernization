/**
 * NPL Modernization Service Worker
 * 
 * Generic service worker that intercepts ThingsBoard HTTP requests and routes them
 * to the appropriate modernized services (NPL Engine, GraphQL, etc.) based on
 * configurable routing rules.
 * 
 * Features:
 * - Extensible routing configuration
 * - Built-in authentication handling
 * - Fallback to ThingsBoard for non-modernized routes
 * - Comprehensive logging for debugging
 */

const CACHE_NAME = 'npl-modernization-v1';
const DEBUG = true;

// ===== ROUTING CONFIGURATION =====
// This is where we define which routes should be modernized
const MODERNIZATION_CONFIG = {
  // Base URLs for modernized services
  services: {
    nplEngine: '/api/npl',
    graphql: '/api/graphql/', 
    oidcProxy: '/api'
  },
  
  // Route definitions - easily extensible
  routes: [
    // Device Management Routes
    {
      pattern: /^\/api\/device$/,
      methods: ['POST'],
      feature: 'device',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'deviceManagement/DeviceManagement'
    },
    {
      pattern: /^\/api\/device\/([^\/]+)$/,
      methods: ['PUT'],
      feature: 'device', 
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'deviceManagement/DeviceManagement'
    },
    {
      pattern: /^\/api\/device\/([^\/]+)$/,
      methods: ['DELETE'],
      feature: 'device',
      operation: 'write', 
      target: 'nplEngine',
      nplOperation: 'deviceManagement.DeviceManagement/deleteDevice'
    },
    {
      pattern: /^\/api\/device\/([^\/]+)\/credentials$/,
      methods: ['POST', 'PUT'],
      feature: 'device',
      operation: 'write',
      target: 'nplEngine', 
      nplOperation: 'deviceManagement.DeviceManagement/saveDeviceCredentials'
    },
    {
      pattern: /^\/api\/device\/([^\/]+)\/credentials$/,
      methods: ['DELETE'],
      feature: 'device',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'deviceManagement.DeviceManagement/deleteDeviceCredentials'
    },
    {
      pattern: /^\/api\/device\/([^\/]+)\/(assign|unassign)$/,
      methods: ['POST'],
      feature: 'device',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'deviceManagement.DeviceManagement/assignDeviceToCustomer'
    },
    {
      pattern: /^\/api\/devices\/bulk$/,
      methods: ['POST'],
      feature: 'device',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'deviceManagement.DeviceManagement/bulkImportDevices'
    },
    {
      pattern: /^\/api\/devices\/bulk\/delete$/,
      methods: ['POST'],
      feature: 'device',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'deviceManagement.DeviceManagement/bulkDeleteDevices'
    },

    // Device Read Operations (GraphQL)
    {
      pattern: /^\/api\/devices$/,
      methods: ['GET'],
      feature: 'device',
      operation: 'read',
      target: 'graphql',
      graphqlQuery: 'getDevices'
    },
    {
      pattern: /^\/api\/tenant\/deviceInfos$/,
      methods: ['GET'],
      feature: 'device',
      operation: 'read',
      target: 'graphql',
      graphqlQuery: 'getTenantDeviceInfos'
    },
    {
      pattern: /^\/api\/device\/([^\/]+)$/,
      methods: ['GET'],
      feature: 'device',
      operation: 'read',
      target: 'graphql',
      graphqlQuery: 'getDeviceById'
    },
    {
      pattern: /^\/api\/device\/info\/([^\/]+)$/,
      methods: ['GET'],
      feature: 'device',
      operation: 'read',
      target: 'graphql',
      graphqlQuery: 'getDeviceInfo'
    },
    {
      pattern: /^\/api\/customer\/([^\/]+)\/devices$/,
      methods: ['GET'],
      feature: 'device',
      operation: 'read',
      target: 'graphql',
      graphqlQuery: 'getCustomerDevices'
    },
    {
      pattern: /^\/api\/tenant\/([^\/]+)\/devices$/,
      methods: ['GET'],
      feature: 'device',
      operation: 'read',
      target: 'graphql',
      graphqlQuery: 'getTenantDevices'
    },

    // Tenant Management Routes (Future expansion)
    {
      pattern: /^\/api\/tenant$/,
      methods: ['POST'],
      feature: 'tenant',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'tenantManagement.TenantManagement/createTenant'
    },
    {
      pattern: /^\/api\/tenant\/([^\/]+)$/,
      methods: ['PUT'],
      feature: 'tenant',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'tenantManagement.TenantManagement/updateTenant'
    },
    {
      pattern: /^\/api\/tenant\/([^\/]+)$/,
      methods: ['DELETE'],
      feature: 'tenant',
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'tenantManagement.TenantManagement/deleteTenant'
    }
    
    // TODO: Add more routes as we modernize additional features:
    // - Customer management
    // - Device profiles
    // - Dashboards
    // - Rules
    // - etc.
  ],

  // Feature flags for gradual rollout
  features: {
    enableDeviceModernization: true,
    enableTenantModernization: true,
    enableCustomerModernization: false, // Future
    enableDashboardModernization: false, // Future
    enableRuleModernization: false, // Future
    enableLogging: true
  }
};

// ===== AUTHENTICATION & AUTHORIZATION =====
class AuthManager {
  constructor() {
    this.tokenCache = new Map();
    this.tokenExpiry = new Map();
    this.jwtToken = null; // Store JWT token from main page
  }

  async getAuthToken() {
    const cached = this.tokenCache.get('access_token');
    const expiry = this.tokenExpiry.get('access_token');
    
    // Check if we have a valid cached token
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Request JWT token from main page if we don't have it
    if (!this.jwtToken) {
      await this.requestJWTToken();
    }

    if (!this.jwtToken) {
      throw new Error('No JWT token available for authentication');
    }

    try {
      // Get new token from OIDC proxy with JWT token
      this.log(`🔑 Attempting OIDC token exchange with JWT: ${this.jwtToken?.substring(0, 50)}...`);
      const response = await fetch(`${MODERNIZATION_CONFIG.services.oidcProxy}/protocol/openid-connect/token/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jwtToken}`
        },
        body: JSON.stringify({})
      });
      
      this.log(`🔄 OIDC response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        this.log(`❌ OIDC error response: ${errorText}`);
      }

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokenData = await response.json();
      const token = tokenData.access_token;
      
      if (!token) {
        throw new Error('No access token received');
      }

      // Cache the token (assuming 1 hour expiry if not specified)
      const expiryTime = Date.now() + (tokenData.expires_in || 3600) * 1000;
      this.tokenCache.set('access_token', token);
      this.tokenExpiry.set('access_token', expiryTime);

      this.log('🔑 Successfully obtained auth token');
      return token;
      
    } catch (error) {
      this.log(`❌ Authentication failed: ${error.message}`);
      throw error;
    }
  }

  async requestJWTToken() {
    // If we already have a token, don't request again
    if (this.jwtToken) {
      this.log('🔑 Using existing JWT token');
      return;
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      // Send message to main page requesting JWT token
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients.forEach(client => {
            client.postMessage({
              type: 'REQUEST_JWT_TOKEN'
            });
          });
          this.log('📤 Requested JWT token from all clients');
        } else {
          this.log('⚠️ No clients available for JWT token request');
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      });
      
      // Set timeout and resolve
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (!this.jwtToken) {
            this.log('⏰ JWT token request timed out after 3 seconds');
          }
          resolve();
        }
      }, 3000);
    });
  }

  setJWTToken(token) {
    this.log(`🔍 Setting JWT token, received:`, token);
    
    // Handle both string tokens and token objects
    let actualToken = token;
    if (typeof token === 'object') {
      if (token.token) {
        actualToken = token.token;
      } else if (token.data && token.data.token) {
        actualToken = token.data.token;
      }
    }
    
    if (actualToken && typeof actualToken === 'string' && actualToken.length > 10) {
      this.jwtToken = actualToken;
      this.log(`✅ JWT token stored successfully (${actualToken.length} chars)`);
      this.log(`🔑 Token preview: ${actualToken.substring(0, 20)}...`);
    } else {
      this.log(`❌ Invalid JWT token received: ${typeof token}, actualToken: ${typeof actualToken}, length: ${actualToken?.length}`);
      this.log(`❌ Full token structure:`, JSON.stringify(token));
    }
  }

  createAuthHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  clearTokens() {
    this.tokenCache.clear();
    this.tokenExpiry.clear();
    this.jwtToken = null;
    this.log('🧹 All tokens and cached data cleared');
  }

  log(message) {
    if (MODERNIZATION_CONFIG.features.enableLogging) {
      console.log(`[NPL Auth] ${message}`);
    }
  }
}

// ===== REQUEST ROUTER =====
class RequestRouter {
  constructor(authManager) {
    this.authManager = authManager;
    this.lastSavedDeviceId = null; // cache last created/updated device id for fallback
    this.deviceCache = new Map(); // cache created devices for immediate read-your-writes
  }

  findRoute(url, method) {
    const pathname = this.extractPathname(url);
    
    return MODERNIZATION_CONFIG.routes.find(route => {
      return route.pattern.test(pathname) && route.methods.includes(method);
    });
  }

  extractPathname(url) {
    try {
      return new URL(url).pathname;
    } catch {
      // If URL parsing fails, assume it's already a pathname
      return url.split('?')[0];
    }
  }

  async routeRequest(request, route) {
    const { target, feature } = route;

    // Check if this feature is enabled
    const featureFlag = `enable${feature.charAt(0).toUpperCase() + feature.slice(1)}Modernization`;
    if (!MODERNIZATION_CONFIG.features[featureFlag]) {
      this.log(`⏭️ Feature ${feature} modernization disabled, passing through`);
      return null; // Will fall back to original request
    }

    try {
      // Always get fresh auth token for modernized requests
      const authToken = await this.authManager.getAuthToken();

      if (target === 'nplEngine') {
        return await this.routeToNplEngine(request, route, authToken);
      } else if (target === 'graphql') {
        return await this.routeToGraphQL(request, route, authToken);
      } else {
        throw new Error(`Unknown target: ${target}`);
      }

    } catch (error) {
      this.log(`❌ Routing failed for ${route.feature} ${route.operation}: ${error.message}`);
      // Return null to fall back to original request
      return null;
    }
  }

  async routeToNplEngine(request, route, authToken) {
    const originalBody = await this.getRequestBody(request);
    
    // Get or create DeviceManagement instance dynamically
    const instanceId = await this.getOrCreateDeviceManagementInstance(authToken);
    if (!instanceId) {
      throw new Error('Failed to get or create DeviceManagement instance');
    }
    this.log(`✅ Using DeviceManagement instance ID: ${instanceId}`);

    // Use direct NPL API (tenant-specific instance works perfectly)
    const nplPayload = this.transformToNplPayload(originalBody, route, request);
    const permissionUrl = `${MODERNIZATION_CONFIG.services.nplEngine}/deviceManagement/DeviceManagement/${instanceId}/saveDevice`;
    this.log(`🔄 Calling direct NPL API: ${permissionUrl}`);
    this.log(`📦 NPL API payload:`, nplPayload);

    const response = await fetch(permissionUrl, {
      method: 'POST',
      headers: this.authManager.createAuthHeaders(authToken),
      body: JSON.stringify(nplPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.log(`❌ NPL API call failed: ${errorText}`);
      throw new Error(`NPL API call failed: ${response.status}`);
    }

    const nplResult = await response.json();
    const tbResponse = this.transformFromNplResponse(nplResult, route);

    this.log(`✅ NPL API call successful: ${response.status}`);
    this.log(`📤 Returning response to UI:`, tbResponse);
    
    return new Response(JSON.stringify(tbResponse), {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async routeToGraphQL(request, route, authToken) {
    const queryParams = this.extractQueryParams(request.url);
    const graphqlQuery = this.buildGraphQLQuery(route, queryParams, request);
    
    // All reads should go through GraphQL
    if (!graphqlQuery) {
      throw new Error(`No GraphQL query defined for ${route.graphqlQuery}`);
    }
    
    // Check cache first for device reads (read-your-writes)
    if (route.graphqlQuery === 'getDeviceInfo' && graphqlQuery.variables?.deviceId) {
      const cachedDevice = this.deviceCache.get(graphqlQuery.variables.deviceId);
      if (cachedDevice) {
        this.log(`🎯 Returning cached device for read-your-writes: ${graphqlQuery.variables.deviceId}`);
        return new Response(JSON.stringify(cachedDevice), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    this.log(`🔄 Routing to GraphQL: ${route.graphqlQuery}`);
    this.log(`📋 GraphQL query:`, graphqlQuery);

    // Try direct JWT token for GraphQL (same as NPL Engine)
    this.log(`🔄 Using direct JWT token for GraphQL (like NPL Engine)...`);

    const response = await fetch(MODERNIZATION_CONFIG.services.graphql, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: graphqlQuery.query,
        variables: graphqlQuery.variables
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.log(`❌ GraphQL request failed: ${response.status} - ${errorText}`);
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const graphqlResult = await response.json();
    const tbResponse = this.transformFromGraphQLResponse(graphqlResult, route);

    this.log(`✅ GraphQL response: ${response.status}`);
    this.log(`📤 GraphQL result:`, graphqlResult);

    return new Response(JSON.stringify(tbResponse), {
      status: 200,
      statusText: 'OK', 
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getRequestBody(request) {
    if (['GET', 'HEAD'].includes(request.method)) {
      return null;
    }
    
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  async getOrCreateDeviceManagementInstance(authToken) {
    // Check cache first (per-session)
    const cacheKey = 'deviceManagementInstance';
    const cached = this.authManager.tokenCache.get(cacheKey);
    if (cached) {
      this.log(`🎯 Using cached DeviceManagement instance: ${cached}`);
      return cached;
    }

    try {
      // Try to find existing instances
      this.log(`🔍 Discovering DeviceManagement instances...`);
      const listResponse = await fetch(`${MODERNIZATION_CONFIG.services.nplEngine}/deviceManagement/DeviceManagement/`, {
        method: 'GET',
        headers: this.authManager.createAuthHeaders(authToken)
      });

      if (listResponse.ok) {
        const listData = await listResponse.json();
        this.log(`📋 Found ${listData.items?.length || 0} existing instances`);
        if (listData.items && listData.items.length > 0) {
          const instanceId = listData.items[0]["@id"];
          this.log(`✅ Found existing DeviceManagement instance: ${instanceId}`);
          // Cache the instance ID
          this.authManager.tokenCache.set(cacheKey, instanceId);
          return instanceId;
        }
      }

      // No existing instance found, create new one
      this.log(`🏗️ Creating new DeviceManagement instance...`);
      const createPayload = {
        "@parties": [
          {
            "entity": { "preferred_username": ["sysadmin@thingsboard.org"] },
            "access": {}
          },
          {
            "entity": { "preferred_username": ["tenant@thingsboard.org"] },
            "access": {}
          },
          {
            "entity": { "preferred_username": ["user@thingsboard.org"] },
            "access": {}
          }
        ]
      };

      const createResponse = await fetch(`${MODERNIZATION_CONFIG.services.nplEngine}/deviceManagement/DeviceManagement/`, {
        method: 'POST',
        headers: this.authManager.createAuthHeaders(authToken),
        body: JSON.stringify(createPayload)
      });

      if (createResponse.ok) {
        const createData = await createResponse.json();
        const instanceId = createData["@id"];
        this.log(`✅ Created new DeviceManagement instance: ${instanceId}`);
        // Cache the instance ID
        this.authManager.tokenCache.set(cacheKey, instanceId);
        return instanceId;
      } else {
        const errorText = await createResponse.text();
        this.log(`❌ Failed to create DeviceManagement instance: ${errorText}`);
        return null;
      }

    } catch (error) {
      this.log(`💥 Error in getOrCreateDeviceManagementInstance: ${error.message}`);
      return null;
    }
  }

  toTbEntityId(id, entityType) {
    if (!id) {
      return null;
    }
    return { id, entityType };
  }

  toTbDeviceShape(deviceLike) {
    // deviceLike may come from NPL (fields as strings) or GraphQL
    const additionalInfo = (typeof deviceLike.additionalInfo === 'string')
      ? (() => { try { return JSON.parse(deviceLike.additionalInfo); } catch { return deviceLike.additionalInfo; } })()
      : (deviceLike.additionalInfo ?? null);

    return {
      id: this.toTbEntityId(deviceLike.id, 'DEVICE'),
      tenantId: this.toTbEntityId(deviceLike.tenantId, 'TENANT'),
      customerId: this.toTbEntityId(deviceLike.customerId, 'CUSTOMER'),
      deviceProfileId: this.toTbEntityId(deviceLike.deviceProfileId, 'DEVICE_PROFILE'),
      name: deviceLike.name,
      type: deviceLike.type,
      label: deviceLike.label ?? null,
      additionalInfo,
      createdTime: deviceLike.createdTime ?? Date.now()
    };
  }

  extractQueryParams(url) {
    try {
      return Object.fromEntries(new URL(url).searchParams);
    } catch {
      return {};
    }
  }

  transformToNplPayload(body, route, request) {
    this.log(`🔄 Transforming payload for NPL permission call`);
    
    // Extract device data from request
    const device = body || this.extractDeviceFromUrl(request.url);
    this.log(`📦 Original device payload:`, device);
    
    // Generate a unique device ID if not provided
    const deviceId = device.id || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Transform to NPL Device struct format (matching deviceManagement.npl exactly)
    // Extract IDs from complex objects if needed
    const extractId = (field) => {
      if (!field) return null;
      if (typeof field === 'string') return field;
      if (typeof field === 'object' && field.id) return field.id;
      return field;
    };

    return {
      "device": {
        "id": deviceId,
        "name": device.name || "DefaultDevice",
        "type": device.type || "default",
        "tenantId": extractId(device.tenantId) || "13814000-1dd2-11b2-8080-808080808080", // Default tenant
        "customerId": extractId(device.customerId) || null,
        "credentials": `token_${deviceId}_${Date.now()}`, // Default credentials
        "label": device.label || null,
        "deviceProfileId": extractId(device.deviceProfileId) || null,
        "firmwareId": extractId(device.firmwareId) || null,
        "softwareId": extractId(device.softwareId) || null,
        "externalId": device.externalId || null,
        "version": device.version || null,
        "additionalInfo": device.additionalInfo ? JSON.stringify(device.additionalInfo) : null,
        "createdTime": device.createdTime || Date.now(),
        "deviceData": device.deviceData || null
      }
    };
  }

  transformToEngineApiPayload(body, route, request) {
    this.log(`🔄 Transforming payload for Engine Core API action call`);
    
    // Extract device data from request
    const device = body || this.extractDeviceFromUrl(request.url);
    this.log(`📦 Original device payload:`, device);
    
    // Generate a unique device ID if not provided
    const deviceId = device.id || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Transform to Engine API format with ApiValue wrapper
    return {
      "arguments": [
        {
          "type": "Struct",
          "structName": "Device", 
          "value": {
            "id": deviceId,
            "name": device.name || "DefaultDevice",
            "type": device.type || "default",
            "tenantId": device.tenantId || "13814000-1dd2-11b2-8080-808080808080",
            "customerId": device.customerId || null,
            "credentials": `token_${deviceId}_${Date.now()}`,
            "label": device.label || null,
            "deviceProfileId": device.deviceProfileId || null,
            "firmwareId": device.firmwareId || null,
            "softwareId": device.softwareId || null,
            "externalId": device.externalId || null,
            "version": device.version || null,
            "additionalInfo": device.additionalInfo ? JSON.stringify(device.additionalInfo) : null,
            "createdTime": device.createdTime || Date.now(),
            "deviceData": device.deviceData || null
          }
        }
      ]
    };
  }

  transformFromNplResponse(nplResult, route) {
    // Transform NPL response back to ThingsBoard format
    this.log(`🔄 Transforming NPL response to ThingsBoard format:`, nplResult);
    
    // For device writes, NPL returns the saved device object
    if ((route.feature === 'device' && route.operation === 'write') || route.nplOperation === 'deviceManagement.DeviceManagement/saveDevice') {
      const device = nplResult;
      const shaped = this.toTbDeviceShape(device);
      this.lastSavedDeviceId = shaped?.id?.id || null;
      
      // Cache the device for immediate reads
      if (shaped?.id?.id) {
        this.deviceCache.set(shaped.id.id, shaped);
        this.log(`💾 Cached device ${shaped.id.id} for read-your-writes`);
      }
      
      this.log(`✅ Transformed device response with ID: ${shaped.id?.id}`);
      return shaped;
    }
    
    return nplResult;
  }

  buildGraphQLQuery(route, params, request) {
    // Build GraphQL queries based on the route
    switch (route.graphqlQuery) {
      case 'getDeviceById':
        return {
          query: `
            query GetDevice($deviceId: String!) {
              device(id: $deviceId) {
                id
                name
                type
                label
                deviceProfileId
                customerId
                tenantId
              }
            }
          `,
          variables: { deviceId: params.deviceId || this.extractIdFromUrl(params.url) }
        };
        
      case 'getDevices':
        return {
          query: `
            query GetDevices($limit: Int, $offset: Int) {
              devices(first: $limit, offset: $offset) {
                edges {
                  node {
                    id
                    name
                    type
                    label
                  }
                }
                totalCount
              }
            }
          `,
          variables: { 
            limit: parseInt(params.limit) || 20,
            offset: parseInt(params.offset) || 0
          }
        };

      case 'getTenantDeviceInfos':
        return {
          query: `
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
          `,
          variables: {}
        };

      case 'getDeviceInfo':
        {
          let deviceId = params.deviceId || this.extractIdFromUrl(request.url);
          if (!deviceId || deviceId === 'undefined') {
            if (this.lastSavedDeviceId) {
              this.log(`🛟 Using lastSavedDeviceId fallback for device info: ${this.lastSavedDeviceId}`);
              deviceId = this.lastSavedDeviceId;
            } else {
              this.log('⚠️ No deviceId found in URL or cache');
            }
          }
          return {
          query: `
            query GetDeviceInfo($deviceId: String!) {
              device(id: $deviceId) {
                id
                name
                type
                label
                deviceProfileId
                customerId
                tenantId
                additionalInfo
                createdTime
              }
            }
          `,
          variables: { deviceId }
        };
        }
        
      default:
        throw new Error(`Unknown GraphQL query: ${route.graphqlQuery}`);
    }
  }

  transformFromGraphQLResponse(graphqlResult, route) {
    // Transform GraphQL response to ThingsBoard format
    if (!graphqlResult || !graphqlResult.data) {
      return graphqlResult;
    }

    switch (route.graphqlQuery) {
      case 'getDeviceById':
      case 'getDeviceInfo': {
        const device = graphqlResult.data.device;
        return device ? this.toTbDeviceShape(device) : null;
      }
      case 'getDevices': {
        const edges = graphqlResult.data.devices?.edges || [];
        const data = edges.map(e => this.toTbDeviceShape(e.node));
        return {
          data,
          totalElements: graphqlResult.data.devices?.totalCount ?? data.length
        };
      }
      case 'getTenantDeviceInfos': {
        // Extract device struct data from NPL protocolFieldsStructs
        const protocolFieldsStructs = graphqlResult.data?.protocolFieldsStructs;
        const nodes = protocolFieldsStructs?.nodes || [];
        this.log(`📋 Found ${nodes.length} protocol field structs`);
        this.log(`📋 Raw GraphQL response:`, graphqlResult.data);
        
        // Group struct fields by protocolId to reconstruct Device objects
        const devicesByProtocol = {};
        nodes.forEach(fieldStruct => {
          const { protocolId, field, value } = fieldStruct;
          if (!devicesByProtocol[protocolId]) {
            devicesByProtocol[protocolId] = { protocolId };
          }
          // Parse the struct field value (it should be a UUID pointing to struct_fields_text)
          devicesByProtocol[protocolId][field] = value;
        });
        
        this.log(`📋 Devices grouped by protocol:`, devicesByProtocol);
        
        // Convert to ThingsBoard device format
        const data = Object.values(devicesByProtocol).map(deviceData => {
          const tbDevice = {
            id: { id: deviceData.protocolId, entityType: 'DEVICE' },
            tenantId: { id: '13814000-1dd2-11b2-8080-808080808080', entityType: 'TENANT' },
            customerId: null,
            deviceProfileId: { id: 'default', entityType: 'DEVICE_PROFILE' },
            name: `NPL Device ${deviceData.protocolId.slice(-8)}`,
            type: 'NPL_DEVICE',
            label: 'active',
            additionalInfo: {
              nplProtocolId: deviceData.protocolId,
              nplFieldData: deviceData
            },
            createdTime: Date.now(),
            deviceData: null,
            firmwareId: null,
            softwareId: null,
            externalId: null
          };
          
          this.log(`📋 Transformed NPL device:`, tbDevice);
          return tbDevice;
        });
        
        const result = {
          data,
          totalElements: data.length,
          totalPages: Math.ceil(data.length / 20),
          hasNext: false,
          hasPrevious: false,
          first: true,
          last: true,
          numberOfElements: data.length,
          size: 20,
          number: 0
        };
        
        this.log(`📋 Final response to UI:`, result);
        return result;
      }
      default:
        return graphqlResult.data;
    }
  }

  extractIdFromUrl(url) {
    if (!url) return null;
    const pathname = this.extractPathname(url);
    const match = pathname.match(/\/api\/device\/(?:info\/)?([^\/]+)/);
    const id = match ? match[1] : null;
    // Support TB-style nested id objects passed via query (?id=<uuid>) as a fallback
    if (!id) {
      const params = this.extractQueryParams(url);
      return params.id || null;
    }
    return id;
  }

  extractDeviceFromUrl(url) {
    // For device creation, we might need to extract info from URL params
    return {};
  }

  log(message) {
    if (MODERNIZATION_CONFIG.features.enableLogging) {
      console.log(`[NPL Router] ${message}`);
    }
  }
}

// ===== SERVICE WORKER EVENT HANDLERS =====
const authManager = new AuthManager(); // Create global authManager instance
const router = new RequestRouter(authManager); // Pass the same authManager instance

// Service Worker Installation
self.addEventListener('install', (event) => {
  console.log('🚀 NPL Modernization Service Worker installing...');
  event.waitUntil(self.skipWaiting());
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
  console.log('✅ NPL Modernization Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Main Request Interception
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;
  const method = request.method;

  // Skip non-HTTP requests
  if (!url.startsWith('http')) {
    return;
  }

  // Skip requests to our own modernized services to avoid loops
  if (url.includes('/api/npl/') || url.includes('/api/graphql/')) {
    return;
  }

  // Find matching modernization route
  const route = router.findRoute(url, method);
  
  if (!route) {
    // No modernization route found, let it pass through
    return;
  }

  // Route to modernized service
  event.respondWith(
    router.routeRequest(request.clone(), route)
      .then(response => {
        if (response) {
          return response;
        } else {
          // For modernized entities, return error instead of fallback
          if (route && (route.feature === 'device' || route.feature === 'tenant')) {
            router.log(`🚫 NO FALLBACK for modernized entity: ${method} ${url}`);
            return new Response(
              JSON.stringify({ 
                error: 'NPL_ROUTING_FAILED', 
                message: `${route.feature} requests must go through NPL engine` 
              }), 
              { 
                status: 502, 
                headers: { 'Content-Type': 'application/json' } 
              }
            );
          }
          
          // Fallback to original request for non-modernized entities
          router.log(`⚠️ Falling back to ThingsBoard for: ${method} ${url}`);
          return fetch(request);
        }
      })
      .catch(error => {
        router.log(`❌ Service Worker error: ${error.message}`);
        
        // For modernized entities, return error instead of fallback
        if (route && (route.feature === 'device' || route.feature === 'tenant')) {
          router.log(`🚫 NO FALLBACK for modernized entity on error: ${method} ${url}`);
          return new Response(
            JSON.stringify({ 
              error: 'NPL_SERVICE_WORKER_ERROR', 
              message: `${route.feature} routing failed: ${error.message}` 
            }), 
            { 
              status: 502, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Always fallback to original request on error for non-modernized
        return fetch(request);
      })
  );
});

// Handle service worker messages
self.addEventListener('message', (event) => {
  console.log('[NPL-SW] 📨 Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'JWT_TOKEN_UPDATE') {
    // Receive JWT token from main page
    console.log('[NPL-SW] 🔑 Processing JWT_TOKEN_UPDATE');
    authManager.setJWTToken(event.data.token);
    console.log('[NPL-SW] 🔑 Received JWT token from main page');
  } else if (event.data && event.data.type === 'JWT_TOKEN_RESPONSE') {
    // Response to our token request
    console.log('[NPL-SW] 🔑 Processing JWT_TOKEN_RESPONSE');
    authManager.setJWTToken(event.data.token);
    console.log('[NPL-SW] 🔑 Received JWT token response from main page');
  } else if (event.data && event.data.type === 'CLEAR_TOKEN') {
    // Clear cached tokens
    console.log('[NPL-SW] 🧹 Clearing cached tokens');
    authManager.clearTokens();
    console.log('[NPL-SW] ✅ All tokens cleared');
  } else {
    console.log('[NPL-SW] ⚠️ Unknown message type:', event.data?.type);
  }
});

console.log('📋 NPL Modernization Service Worker loaded with routes:', MODERNIZATION_CONFIG.routes.length);
// Updated: Sun Aug 10 01:55:00 CEST 2025 - FIXED: Enhanced debugging for GraphQL routing issues! 🎯✅
