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
    graphql: '/api/graphql', 
    oidcProxy: '/api/auth'
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
      nplOperation: 'deviceManagement.DeviceManagement/saveDevice'
    },
    {
      pattern: /^\/api\/device\/([^\/]+)$/,
      methods: ['PUT'],
      feature: 'device', 
      operation: 'write',
      target: 'nplEngine',
      nplOperation: 'deviceManagement.DeviceManagement/saveDevice'
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
  }

  async getAuthToken() {
    const cached = this.tokenCache.get('access_token');
    const expiry = this.tokenExpiry.get('access_token');
    
    // Check if we have a valid cached token
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    try {
      // Get new token from OIDC proxy
      const response = await fetch(`${MODERNIZATION_CONFIG.services.oidcProxy}/protocol/openid-connect/token/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

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

  createAuthHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  log(message) {
    if (MODERNIZATION_CONFIG.features.enableLogging) {
      console.log(`[NPL Auth] ${message}`);
    }
  }
}

// ===== REQUEST ROUTER =====
class RequestRouter {
  constructor() {
    this.authManager = new AuthManager();
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
    const nplPayload = this.transformToNplPayload(originalBody, route, request);
    
    const nplUrl = `${MODERNIZATION_CONFIG.services.nplEngine}/${route.nplOperation}`;
    
    this.log(`🔄 Routing to NPL Engine: ${route.nplOperation}`);

    const response = await fetch(nplUrl, {
      method: 'POST', // NPL operations are always POST
      headers: this.authManager.createAuthHeaders(authToken),
      body: JSON.stringify(nplPayload)
    });

    if (!response.ok) {
      throw new Error(`NPL Engine request failed: ${response.status}`);
    }

    const nplResult = await response.json();
    const tbResponse = this.transformFromNplResponse(nplResult, route);

    this.log(`✅ NPL Engine response: ${response.status}`);
    
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
    const graphqlQuery = this.buildGraphQLQuery(route, queryParams);
    
    this.log(`🔄 Routing to GraphQL: ${route.graphqlQuery}`);

    const response = await fetch(MODERNIZATION_CONFIG.services.graphql, {
      method: 'POST',
      headers: this.authManager.createAuthHeaders(authToken),
      body: JSON.stringify({
        query: graphqlQuery.query,
        variables: graphqlQuery.variables
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const graphqlResult = await response.json();
    const tbResponse = this.transformFromGraphQLResponse(graphqlResult, route);

    this.log(`✅ GraphQL response: ${response.status}`);

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

  extractQueryParams(url) {
    try {
      return Object.fromEntries(new URL(url).searchParams);
    } catch {
      return {};
    }
  }

  transformToNplPayload(body, route, request) {
    // Transform ThingsBoard request format to NPL format
    switch (route.nplOperation) {
      case 'deviceManagement.DeviceManagement/saveDevice':
        return {
          device: body || this.extractDeviceFromUrl(request.url)
        };
      
      case 'deviceManagement.DeviceManagement/deleteDevice':
        return {
          id: this.extractIdFromUrl(request.url)
        };
        
      case 'deviceManagement.DeviceManagement/saveDeviceCredentials':
        return {
          deviceId: this.extractIdFromUrl(request.url),
          credentials: body
        };
        
      case 'deviceManagement.DeviceManagement/assignDeviceToCustomer':
        return {
          deviceId: this.extractIdFromUrl(request.url),
          customerId: body?.customerId
        };
        
      default:
        return body;
    }
  }

  transformFromNplResponse(nplResult, route) {
    // Transform NPL response back to ThingsBoard format
    // This depends on what ThingsBoard expects
    return nplResult;
  }

  buildGraphQLQuery(route, params) {
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
        
      default:
        throw new Error(`Unknown GraphQL query: ${route.graphqlQuery}`);
    }
  }

  transformFromGraphQLResponse(graphqlResult, route) {
    // Transform GraphQL response to ThingsBoard format
    return graphqlResult.data;
  }

  extractIdFromUrl(url) {
    const pathname = this.extractPathname(url);
    const match = pathname.match(/\/api\/device\/([^\/]+)/);
    return match ? match[1] : null;
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
const router = new RequestRouter();

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
          // Fallback to original request
          router.log(`⚠️ Falling back to ThingsBoard for: ${method} ${url}`);
          return fetch(request);
        }
      })
      .catch(error => {
        router.log(`❌ Service Worker error: ${error.message}`);
        // Always fallback to original request on error
        return fetch(request);
      })
  );
});

// Handle service worker messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('📋 NPL Modernization Service Worker loaded with routes:', MODERNIZATION_CONFIG.routes.length);
