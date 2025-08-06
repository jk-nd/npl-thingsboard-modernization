import { Injectable } from '@angular/core';
import { HttpRequest, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { from } from 'rxjs'; // Added for from

import { NplClientService } from './npl-client.service';
import { DeviceGraphQLService } from './device-graphql.service';

@Injectable({
  providedIn: 'root'
})
export class RequestTransformerService {
  
  // We'll need to store a protocol instance ID for NPL operations
  private protocolId: string | null = null

  constructor(
    private nplService: NplClientService,
    private graphqlService: DeviceGraphQLService
  ) {}

  /**
   * Check if this is a read operation that should go to GraphQL
   */
  isReadOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    const method = req.method;

    if (method !== 'GET') return false;

    // List of read endpoints that should be routed to GraphQL
    const readEndpoints = [
      // Tenant management queries (READ operations)
      /^\/api\/tenant\/([^\/]+)$/,                    // GET /api/tenant/{id}
      /^\/api\/tenant\/info\/([^\/]+)$/,              // GET /api/tenant/info/{id}
      /^\/api\/tenants$/,                             // GET /api/tenants (with params)
      /^\/api\/tenantInfos$/,                         // GET /api/tenantInfos (with params)
      
      // Device queries (READ operations)
      /^\/api\/devices$/,                             // GET /api/devices (with params)
      /^\/api\/device\/types$/,                       // GET /api/device/types
      /^\/api\/device\/([^\/]+)$/,                    // GET /api/device/{id}
      /^\/api\/device\/info\/([^\/]+)$/,              // GET /api/device/info/{id}
      /^\/api\/device\/([^\/]+)\/credentials$/,       // GET /api/device/{id}/credentials
      /^\/api\/device\/limits$/,                      // GET /api/device/limits
      
      // Customer queries (READ operations)
      /^\/api\/customer\/([^\/]+)\/devices$/,         // GET /api/customer/{id}/devices
      /^\/api\/customer\/([^\/]+)\/deviceInfos$/,     // GET /api/customer/{id}/deviceInfos
      
      // Telemetry endpoints - these should fall back to ThingsBoard since NPL doesn't have telemetry yet
      /^\/api\/plugins\/telemetry\/DEVICE\/([^\/]+)\/values\/timeseries$/,  // GET telemetry timeseries
      /^\/api\/plugins\/telemetry\/DEVICE\/([^\/]+)\/values\/attributes$/,  // GET device attributes
    ];

    return readEndpoints.some(pattern => pattern.test(url));
  }

  /**
   * Check if this is a write operation that should go to NPL
   */
  isWriteOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    const method = req.method;

    if (method === 'GET') return false;

    // List of write endpoints that should be routed to NPL
    const writeEndpoints = [
      // Tenant management operations (WRITE operations only)
      { pattern: /^\/api\/tenant$/, methods: ['POST', 'PUT'] },                         // Create/Update tenant
      { pattern: /^\/api\/tenant\/([^\/]+)$/, methods: ['DELETE'] },                    // Delete tenant
      { pattern: /^\/api\/tenants\/bulk$/, methods: ['POST'] },                         // Bulk import tenants
      { pattern: /^\/api\/tenants\/bulk\/delete$/, methods: ['POST'] },                 // Bulk delete tenants
      
      // Device operations (WRITE operations only)
      { pattern: /^\/api\/device$/, methods: ['POST', 'PUT'] },                           // Create/Update device
      { pattern: /^\/api\/device\/([^\/]+)$/, methods: ['DELETE'] },                     // Delete device
      { pattern: /^\/api\/device\/credentials$/, methods: ['POST'] },                    // Save credentials
      { pattern: /^\/api\/devices\/bulk$/, methods: ['POST'] },                          // Bulk create devices
      { pattern: /^\/api\/devices\/bulk\/import$/, methods: ['POST'] },                 // Bulk import devices
      { pattern: /^\/api\/device\/limits$/, methods: ['PUT'] },                          // Update device limits
      
      // Device-Customer assignment (WRITE operations)
      { pattern: /^\/api\/customer\/([^\/]+)\/device\/([^\/]+)$/, methods: ['POST'] },   // Assign to customer
      { pattern: /^\/api\/customer\/device\/([^\/]+)$/, methods: ['DELETE'] },           // Unassign from customer
      { pattern: /^\/api\/customer\/device\/([^\/]+)\/claim$/, methods: ['POST', 'DELETE'] }, // Claim/Reclaim
    ];

    return writeEndpoints.some(endpoint => 
      endpoint.pattern.test(url) && endpoint.methods.includes(method)
    );
  }

  /**
   * Transform a read operation to a GraphQL query
   */
  transformToGraphQL(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const fullUrl = req.url;
    // Extract pathname without query parameters for pattern matching
    const url = fullUrl.split('?')[0];
    
    // Telemetry endpoints - fall back to ThingsBoard since NPL doesn't have telemetry yet
    const telemetryMatch = url.match(/^\/api\/plugins\/telemetry\/DEVICE\/([^\/]+)\/values\/(timeseries|attributes)$/);
    if (telemetryMatch) {
      // For now, telemetry requests should fall back to ThingsBoard
      // In the future, this could be routed to NPL telemetry services
      throw new Error('Telemetry not implemented in NPL yet - falling back to ThingsBoard');
    }
    
    // NEW: Device search by name
    const deviceNameMatch = fullUrl.match(/^\/api\/tenant\/devices\?deviceName=(.+)$/);
    if (deviceNameMatch) {
      const deviceName = decodeURIComponent(deviceNameMatch[1]);
      const tenantId = this.getCurrentTenantId(); // You'll need to implement this
      return from(this.graphqlService.getTenantDeviceByName(tenantId, deviceName))
        .pipe(map(result => new HttpResponse({ body: result })));
    }
    
    // NEW: Complex device search
    const queryMatch = fullUrl.match(/^\/api\/devices\?query=(.+)$/);
    if (queryMatch) {
      const queryParams = new URLSearchParams(fullUrl.split('?')[1]);
      const entityId = queryParams.get('entityId') || '';
      const deviceTypes = queryParams.get('deviceTypes')?.split(',') || [];
      const textSearch = queryParams.get('textSearch') || undefined;
      const limit = parseInt(queryParams.get('limit') || '50');
      
      return from(this.graphqlService.findDevicesByQuery(entityId, deviceTypes, textSearch, limit))
        .pipe(map(result => new HttpResponse({ body: result })));
    }
    
    // NEW: Enhanced device info
    const deviceInfoMatch = url.match(/^\/api\/device\/([^\/]+)\/info$/);
    if (deviceInfoMatch) {
      const deviceId = deviceInfoMatch[1];
      return from(this.graphqlService.getDeviceInfoById(deviceId))
        .pipe(map(result => new HttpResponse({ body: result })));
    }
    
    // NEW: Tenant device infos with pagination
    const tenantDeviceInfoMatch = fullUrl.match(/^\/api\/tenant\/deviceInfos/);
    if (tenantDeviceInfoMatch) {
      const queryParams = new URLSearchParams(fullUrl.split('?')[1]);
      const tenantId = this.getCurrentTenantId();
      const pageSize = parseInt(queryParams.get('pageSize') || '20');
      const page = parseInt(queryParams.get('page') || '0');
      const deviceType = queryParams.get('type') || undefined;
      const active = queryParams.get('active') ? queryParams.get('active') === 'true' : undefined;
      
      return from(this.graphqlService.getTenantDeviceInfos(tenantId, pageSize, page, deviceType, active))
        .pipe(map(result => new HttpResponse({ body: result })));
    }
    
    // NEW: Customer device infos with pagination
    const customerDeviceInfoMatch = fullUrl.match(/^\/api\/customer\/([^\/]+)\/deviceInfos/);
    if (customerDeviceInfoMatch) {
      const customerId = customerDeviceInfoMatch[1];
      const queryParams = new URLSearchParams(fullUrl.split('?')[1]);
      const pageSize = parseInt(queryParams.get('pageSize') || '20');
      const page = parseInt(queryParams.get('page') || '0');
      const deviceType = queryParams.get('type') || undefined;
      
      return from(this.graphqlService.getCustomerDeviceInfos(customerId, pageSize, page, deviceType))
        .pipe(map(result => new HttpResponse({ body: result })));
    }

    // GET /api/device/{deviceId}
    const deviceByIdMatch = url.match(/^\/api\/device\/([^\/]+)$/);
    if (deviceByIdMatch) {
      const deviceId = deviceByIdMatch[1];
      return from(this.graphqlService.getDeviceById(deviceId)).pipe(
        map(device => this.createHttpResponse(req, device))
      );
    }

    // GET /api/device/info/{deviceId}
    const deviceInfoMatch2 = url.match(/^\/api\/device\/info\/([^\/]+)$/);
    if (deviceInfoMatch2) {
      const deviceId = deviceInfoMatch2[1];
      return from(this.graphqlService.getDeviceInfoById(deviceId))
        .pipe(map(deviceInfo => this.createHttpResponse(req, deviceInfo)));
    }

    // GET /api/tenant/devices (with filters)
    const tenantDevicesMatch = fullUrl.match(/^\/api\/tenant\/devices(\?.*)?$/);
    if (tenantDevicesMatch) {
      const queryParams = new URLSearchParams(fullUrl.split('?')[1] || '');
      const pageSize = parseInt(queryParams.get('pageSize') || '20');
      const page = parseInt(queryParams.get('page') || '0');
      const type = queryParams.get('type') || undefined;
      const textSearch = queryParams.get('textSearch') || undefined;

      return this.graphqlService.getTenantDevices(pageSize, page).pipe(
        map(devices => this.createHttpResponse(req, devices))
      );
    }

    // GET /api/tenant/deviceInfos
    if (url === '/api/tenant/deviceInfos') {
      const pageSize = this.getQueryParam(req, 'pageSize') || 10;
      const page = this.getQueryParam(req, 'page') || 0;
      return this.graphqlService.getTenantDevices(+pageSize, +page).pipe(
        map(connection => this.createHttpResponse(req, this.transformConnectionToDeviceInfos(connection)))
      );
    }

    // GET /api/customer/{customerId}/devices
    const customerDevicesMatch = url.match(/^\/api\/customer\/([^\/]+)\/devices$/);
    if (customerDevicesMatch) {
      const customerId = customerDevicesMatch[1];
      const pageSize = this.getQueryParam(req, 'pageSize') || 10;
      const page = this.getQueryParam(req, 'page') || 0;
      return this.graphqlService.getCustomerDevices(customerId, +pageSize, +page).pipe(
        map(connection => this.transformConnectionToThingsBoard(connection))
      );
    }

    // GET /api/customer/{customerId}/deviceInfos
    const customerDeviceInfosMatch = url.match(/^\/api\/customer\/([^\/]+)\/deviceInfos$/);
    if (customerDeviceInfosMatch) {
      const customerId = customerDeviceInfosMatch[1];
      const pageSize = this.getQueryParam(req, 'pageSize') || 10;
      const page = this.getQueryParam(req, 'page') || 0;
      return from(this.graphqlService.getCustomerDeviceInfos(customerId, +pageSize, +page)).pipe(
        map((deviceInfos: any) => this.createHttpResponse(req, { data: deviceInfos, totalElements: deviceInfos.length }))
      );
    }

    // GET /api/device/{deviceId}/credentials
    const deviceCredentialsMatch = url.match(/^\/api\/device\/([^\/]+)\/credentials$/);
    if (deviceCredentialsMatch) {
      const deviceId = deviceCredentialsMatch[1];
      return this.graphqlService.getDeviceCredentials(deviceId).pipe(
        map(credentials => this.createHttpResponse(req, credentials))
      );
    }

    // GET /api/devices with query parameters
    if (url.startsWith('/api/devices')) {
      const deviceIds = this.getQueryParam(req, 'deviceIds');
      const deviceName = this.getQueryParam(req, 'deviceName');
      
      // GET /api/devices?deviceIds=x,y,z
      if (deviceIds) {
        const idsArray = deviceIds.split(',');
        return this.graphqlService.getDevicesByIds(idsArray).pipe(
          map(devices => this.createHttpResponse(req, devices))
        );
      }
      
      // GET /api/devices?deviceName=xyz
      if (deviceName) {
        const pageSize = this.getQueryParam(req, 'pageSize') || 10;
        const page = this.getQueryParam(req, 'page') || 0;
        return this.graphqlService.getDevicesByQuery(deviceName, +pageSize, +page).pipe(
          map(connection => this.transformConnectionToThingsBoard(connection))
        );
      }
      
      // Default tenant devices for /api/devices
      const pageSize = this.getQueryParam(req, 'pageSize') || 10;
      const page = this.getQueryParam(req, 'page') || 0;
      return this.graphqlService.getTenantDevices(+pageSize, +page).pipe(
        map(connection => this.transformConnectionToThingsBoard(connection))
      );
    }

    // GET /api/device/types
    if (url === '/api/device/types') {
      return this.graphqlService.getDeviceTypes().pipe(
        map(types => this.createHttpResponse(req, types))
      );
    }

    // GET /api/devices/count/{otaPackageType}/{deviceProfileId}
    const deviceCountMatch = url.match(/^\/api\/devices\/count\/([^\/]+)\/([^\/]+)$/);
    if (deviceCountMatch) {
      const otaPackageType = deviceCountMatch[1];
      const deviceProfileId = deviceCountMatch[2];
      return this.graphqlService.countDevicesByProfile(deviceProfileId, otaPackageType).pipe(
        map(count => this.createHttpResponse(req, count))
      );
    }

    // GET /api/device/limits
    if (url === '/api/device/limits') {
      return from(this.graphqlService.getDeviceLimits())
        .pipe(map(result => new HttpResponse({ body: result })));
    }

    // If no GraphQL route matches, throw an error
    throw new Error(`No GraphQL route found for: ${fullUrl}`);
  }

  /**
   * Transform POST/PUT/DELETE request to NPL operation
   */
  transformToNPL(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    if (!this.protocolId) {
      throw new Error('NPL protocol instance not initialized');
    }

    const url = req.url;
    const method = req.method;

    // POST /api/device - Create device
    if (method === 'POST' && url === '/api/device') {
      const device = req.body as any; // Assuming Device type is not directly imported here
      return this.nplService.saveDevice(this.protocolId, device).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // PUT /api/device - Update device
    if (method === 'PUT' && url === '/api/device') {
      const device = req.body as any; // Assuming Device type is not directly imported here
      return this.nplService.saveDevice(this.protocolId, device).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/device/{id}
    const deleteMatch = url.match(/\/api\/device\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const deviceId = deleteMatch[1];
      return this.nplService.deleteDevice(this.protocolId, deviceId).pipe(
        map(result => this.createHttpResponse(req, { success: result }))
      );
    }

    // POST /api/customer/{customerId}/device/{deviceId} - Assign device
    const assignMatch = url.match(/\/api\/customer\/([^/]+)\/device\/([^\/]+)$/);
    if (method === 'POST' && assignMatch) {
      const customerId = assignMatch[1];
      const deviceId = assignMatch[2];
      return this.nplService.assignDeviceToCustomer(this.protocolId, deviceId, customerId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/customer/device/{deviceId} - Unassign device
    const unassignMatch = url.match(/\/api\/customer\/device\/([^\/]+)$/);
    if (method === 'DELETE' && unassignMatch) {
      const deviceId = unassignMatch[1];
      return this.nplService.unassignDeviceFromCustomer(this.protocolId, deviceId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // POST /api/device/credentials - Save device credentials
    if (method === 'POST' && url === '/api/device/credentials') {
      const credentials = req.body as any;
      return this.nplService.updateDeviceCredentials(this.protocolId, credentials.deviceId, credentials.credentialsValue).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // POST /api/customer/device/{deviceName}/claim - Claim device
    const claimMatch = url.match(/\/api\/customer\/device\/([^/]+)\/claim$/);
    if (method === 'POST' && claimMatch) {
      const deviceName = claimMatch[1];
      const secretKey = req.body?.secretKey || '';
      return this.nplService.claimDevice(this.protocolId, deviceName, secretKey).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/customer/device/{deviceName}/claim - Reclaim device
    if (method === 'DELETE' && claimMatch) {
      const deviceName = claimMatch[1];
      return this.nplService.reclaimDevice(this.protocolId, deviceName).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // If no specific handler found, throw error
    throw new Error(`Unhandled NPL transformation for: ${method} ${url}`);
  }

  /**
   * Initialize NPL protocol instance
   */
  initializeProtocol(): Observable<string> {
    // Create a simple protocol instance for the current user
    const parties = [
      {
        entity: { email: ['tenant@thingsboard.org'] },
        access: {}
      }
    ];

    return this.nplService.instantiateProtocol(parties).pipe(
      map((instance: any) => {
        this.protocolId = instance.protocolId;
        if (!this.protocolId) {
          throw new Error('Failed to initialize NPL protocol instance');
        }
        return this.protocolId;
      })
    );
  }

  private createHttpResponse<T>(req: HttpRequest<any>, body: T): HttpResponse<T> {
    return new HttpResponse({
      body,
      headers: req.headers,
      status: 200,
      statusText: 'OK',
      url: req.url
    });
  }

  private getQueryParam(req: HttpRequest<any>, param: string): string | null {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get(param);
  }

  /**
   * Transform GraphQL DevicesConnection to ThingsBoard PageData format
   */
  private transformConnectionToThingsBoard(connection: any): any {
    if (!connection) {
      return { data: [], totalElements: 0, totalPages: 0 };
    }

    // Group edges by protocolId to reconstruct complete device objects
    const deviceGroups = new Map<string, any>();
    
    connection.edges?.forEach((edge: any) => {
      const protocolId = edge.node.protocolId;
      if (!deviceGroups.has(protocolId)) {
        deviceGroups.set(protocolId, {});
      }
      const device = deviceGroups.get(protocolId);
      device[edge.node.field] = edge.node.value;
      device.protocolId = protocolId;
    });

    const devices = Array.from(deviceGroups.values());

    return {
      data: devices,
      totalElements: connection.totalCount || 0,
      totalPages: Math.ceil((connection.totalCount || 0) / 10), // Assuming default page size
      hasNext: connection.pageInfo?.hasNextPage || false
    };
  }

  /**
   * Transform GraphQL DevicesConnection to DeviceInfo array
   */
  private transformConnectionToDeviceInfos(connection: any): any {
    if (!connection) {
      return { data: [], totalElements: 0 };
    }

    // Group edges by protocolId to reconstruct complete device objects
    const deviceGroups = new Map<string, any>();
    
    connection.edges?.forEach((edge: any) => {
      const protocolId = edge.node.protocolId;
      if (!deviceGroups.has(protocolId)) {
        deviceGroups.set(protocolId, {});
      }
      const device = deviceGroups.get(protocolId);
      device[edge.node.field] = edge.node.value;
      device.protocolId = protocolId;
    });

    // Convert to DeviceInfo format
    const deviceInfos = Array.from(deviceGroups.values()).map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      label: device.label,
      deviceProfileId: device.deviceProfileId,
      deviceProfileName: device.deviceProfileName || device.type, // Fallback
      customerId: device.customerId,
      customerTitle: device.customerTitle,
      active: true, // Would need additional logic
      lastActivityTime: device.createdTime
    }));

    return {
      data: deviceInfos,
      totalElements: connection.totalCount || 0,
      totalPages: Math.ceil((connection.totalCount || 0) / 10),
      hasNext: connection.pageInfo?.hasNextPage || false
    };
  }

  // Helper method to get current tenant ID (implement based on your auth system)
  private getCurrentTenantId(): string {
    // TODO: Implement based on your authentication system
    // This might come from JWT token, session, or user context
    return 'default-tenant-id';
  }
} 