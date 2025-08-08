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
  
  constructor(
    private nplService: NplClientService,
    private graphqlService: DeviceGraphQLService
  ) {}

  /**
   * Check if this is a device-related read operation that should go to GraphQL
   */
  isReadOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    const method = req.method;

    if (method !== 'GET') return false;

    // List of device read endpoints that should be routed to GraphQL
    const readEndpoints = [
      // Tenant device queries - these should come FIRST to avoid conflicts
      /^\/api\/tenant\/devices$/,                     // GET /api/tenant/devices
      /^\/api\/tenant\/deviceInfos$/,                 // GET /api/tenant/deviceInfos
      
      // Customer device queries - these should come BEFORE device patterns
      /^\/api\/customer\/([^\/]+)\/devices$/,         // GET /api/customer/{id}/devices
      /^\/api\/customer\/([^\/]+)\/deviceInfos$/,     // GET /api/customer/{id}/deviceInfos
      
      // Device queries and searches - these should come BEFORE specific device patterns
      /^\/api\/devices$/,                             // GET /api/devices (with params)
      /^\/api\/device\/types$/,                       // GET /api/device/types
      
      // Device counts
      /^\/api\/devices\/count\/([^\/]+)\/([^\/]+)$/,  // GET /api/devices/count/{type}/{profileId}
      
      // Enhanced features - Device limits (read operation)
      /^\/api\/device\/limits$/,                      // GET /api/device/limits
      
      // Basic device queries - these should come LAST to avoid conflicts
      /^\/api\/device\/([^\/]+)$/,                    // GET /api/device/{id}
      /^\/api\/device\/info\/([^\/]+)$/,              // GET /api/device/info/{id}
      
      // Device credentials
      /^\/api\/device\/([^\/]+)\/credentials$/,       // GET /api/device/{id}/credentials
      
      // Telemetry endpoints - these should fall back to ThingsBoard since NPL doesn't have telemetry yet
      /^\/api\/plugins\/telemetry\/DEVICE\/([^\/]+)\/values\/timeseries$/,  // GET telemetry timeseries
      /^\/api\/plugins\/telemetry\/DEVICE\/([^\/]+)\/values\/attributes$/,  // GET device attributes
    ];

    return readEndpoints.some(pattern => pattern.test(url));
  }

  /**
   * Check if this is a device-related write operation that should go to NPL
   */
  isWriteOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    const method = req.method;

    if (method === 'GET') return false;

    // List of device write endpoints that should be routed to NPL
    const deviceWriteEndpoints = [
      // Device CRUD
      { pattern: /^\/api\/device$/, methods: ['POST', 'PUT'] },                           // Create/Update device
      { pattern: /^\/api\/device\/([^\/]+)$/, methods: ['DELETE'] },                     // Delete device
      
      // Device-Customer assignment
      { pattern: /^\/api\/customer\/([^\/]+)\/device\/([^\/]+)$/, methods: ['POST'] },   // Assign to customer
      { pattern: /^\/api\/customer\/device\/([^\/]+)$/, methods: ['DELETE'] },           // Unassign from customer
      
      // Device credentials
      { pattern: /^\/api\/device\/credentials$/, methods: ['POST'] },                    // Save credentials
      
      // Device claiming
      { pattern: /^\/api\/customer\/device\/([^\/]+)\/claim$/, methods: ['POST', 'DELETE'] }, // Claim/Reclaim
      
      // Enhanced features - Bulk operations
      { pattern: /^\/api\/devices\/bulk$/, methods: ['POST'] },                          // Bulk create devices
      { pattern: /^\/api\/devices\/bulk\/import$/, methods: ['POST'] },                 // Bulk import devices
      
      // Enhanced features - Device limits management
      { pattern: /^\/api\/device\/limits$/, methods: ['PUT'] },                          // Update device limits
    ];

    // List of tenant write endpoints that should be routed to NPL
    const tenantWriteEndpoints = [
      // Tenant CRUD
      { pattern: /^\/api\/tenant$/, methods: ['POST', 'PUT'] },                          // Create/Update tenant
      { pattern: /^\/api\/tenant\/([^\/]+)$/, methods: ['DELETE'] },                     // Delete tenant
      
      // Tenant bulk operations
      { pattern: /^\/api\/tenants\/bulk$/, methods: ['POST'] },                          // Bulk create tenants
      { pattern: /^\/api\/tenants\/bulk\/import$/, methods: ['POST'] },                 // Bulk import tenants
      { pattern: /^\/api\/tenants\/bulk\/delete$/, methods: ['POST'] },                 // Bulk delete tenants
    ];

    return deviceWriteEndpoints.some(endpoint => 
      endpoint.pattern.test(url) && endpoint.methods.includes(method)
    ) || tenantWriteEndpoints.some(endpoint => 
      endpoint.pattern.test(url) && endpoint.methods.includes(method)
    );
  }

  /**
   * Transform read operations to use GraphQL
   */
  transformToGraphQL(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const url = req.url;
    const method = req.method;

    // GET /api/tenant/devices - List tenant devices
    if (method === 'GET' && url === '/api/tenant/devices') {
      const pageSize = parseInt(this.getQueryParam(req, 'pageSize') || '10');
      const page = parseInt(this.getQueryParam(req, 'page') || '0');
      
      return this.graphqlService.getTenantDevices(pageSize, page).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/tenant/deviceInfos - List tenant device infos
    if (method === 'GET' && url === '/api/tenant/deviceInfos') {
      const pageSize = parseInt(this.getQueryParam(req, 'pageSize') || '10');
      const page = parseInt(this.getQueryParam(req, 'page') || '0');
      const tenantId = this.getCurrentTenantId();
      
      return from(this.graphqlService.getTenantDeviceInfos(tenantId, pageSize, page)).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/customer/{customerId}/devices - List customer devices
    const customerDevicesMatch = url.match(/^\/api\/customer\/([^\/]+)\/devices$/);
    if (method === 'GET' && customerDevicesMatch) {
      const customerId = customerDevicesMatch[1];
      const pageSize = parseInt(this.getQueryParam(req, 'pageSize') || '10');
      const page = parseInt(this.getQueryParam(req, 'page') || '0');
      
      return this.graphqlService.getCustomerDevices(customerId, pageSize, page).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/customer/{customerId}/deviceInfos - List customer device infos
    const customerDeviceInfosMatch = url.match(/^\/api\/customer\/([^\/]+)\/deviceInfos$/);
    if (method === 'GET' && customerDeviceInfosMatch) {
      const customerId = customerDeviceInfosMatch[1];
      const pageSize = parseInt(this.getQueryParam(req, 'pageSize') || '10');
      const page = parseInt(this.getQueryParam(req, 'page') || '0');
      
      return this.graphqlService.getCustomerDeviceInfosObservable(customerId, pageSize, page).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/devices - Search devices
    if (method === 'GET' && url === '/api/devices') {
      const pageSize = parseInt(this.getQueryParam(req, 'pageSize') || '10');
      const page = parseInt(this.getQueryParam(req, 'page') || '0');
      const textSearch = this.getQueryParam(req, 'textSearch') || '';
      
      return this.graphqlService.getDevicesByQuery(textSearch, pageSize, page).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/device/types - Get device types
    if (method === 'GET' && url === '/api/device/types') {
      return this.graphqlService.getDeviceTypes().pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/devices/count/{type}/{profileId} - Get device count
    const countMatch = url.match(/^\/api\/devices\/count\/([^\/]+)\/([^\/]+)$/);
    if (method === 'GET' && countMatch) {
      const deviceType = countMatch[1];
      const profileId = countMatch[2];
      
      return this.graphqlService.countDevicesByProfile(profileId, deviceType).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/device/limits - Get device limits
    if (method === 'GET' && url === '/api/device/limits') {
      return from(this.graphqlService.getDeviceLimits()).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/device/{id} - Get device by ID
    const deviceMatch = url.match(/^\/api\/device\/([^\/]+)$/);
    if (method === 'GET' && deviceMatch) {
      const deviceId = deviceMatch[1];
      
      return this.graphqlService.getDeviceInfoByIdObservable(deviceId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/device/info/{id} - Get device info by ID
    const deviceInfoMatch = url.match(/^\/api\/device\/info\/([^\/]+)$/);
    if (method === 'GET' && deviceInfoMatch) {
      const deviceId = deviceInfoMatch[1];
      
      return this.graphqlService.getDeviceInfoByIdObservable(deviceId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // GET /api/device/{id}/credentials - Get device credentials
    const credentialsMatch = url.match(/^\/api\/device\/([^\/]+)\/credentials$/);
    if (method === 'GET' && credentialsMatch) {
      const deviceId = credentialsMatch[1];
      
      return this.graphqlService.getDeviceCredentials(deviceId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // If no specific handler found, throw error
    throw new Error(`Unhandled GraphQL transformation for: ${method} ${url}`);
  }

  /**
   * Transform write operations to use NPL Engine
   */
  transformToNPL(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const url = req.url;
    const method = req.method;

    // ==================== DEVICE OPERATIONS ====================

    // POST /api/device - Create device
    if (method === 'POST' && url === '/api/device') {
      const device = req.body as any;
      return this.nplService.saveDevice(device).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // PUT /api/device - Update device
    if (method === 'PUT' && url === '/api/device') {
      const device = req.body as any;
      return this.nplService.saveDevice(device).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/device/{id}
    const deleteMatch = url.match(/\/api\/device\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const deviceId = deleteMatch[1];
      return this.nplService.deleteDevice(deviceId).pipe(
        map(result => this.createHttpResponse(req, { success: result }))
      );
    }

    // POST /api/customer/{customerId}/device/{deviceId} - Assign device
    const assignMatch = url.match(/\/api\/customer\/([^/]+)\/device\/([^\/]+)$/);
    if (method === 'POST' && assignMatch) {
      const customerId = assignMatch[1];
      const deviceId = assignMatch[2];
      return this.nplService.assignDeviceToCustomer(deviceId, customerId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/customer/device/{deviceId} - Unassign device
    const unassignMatch = url.match(/\/api\/customer\/device\/([^\/]+)$/);
    if (method === 'DELETE' && unassignMatch) {
      const deviceId = unassignMatch[1];
      return this.nplService.unassignDeviceFromCustomer(deviceId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // POST /api/device/credentials - Save device credentials
    if (method === 'POST' && url === '/api/device/credentials') {
      const credentials = req.body as any;
      return this.nplService.updateDeviceCredentials(credentials.deviceId, credentials.credentialsValue).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // POST /api/customer/device/{deviceName}/claim - Claim device
    const claimMatch = url.match(/\/api\/customer\/device\/([^/]+)\/claim$/);
    if (method === 'POST' && claimMatch) {
      const deviceName = claimMatch[1];
      const secretKey = req.body?.secretKey || '';
      return this.nplService.claimDevice(deviceName, secretKey).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/customer/device/{deviceName}/claim - Reclaim device
    if (method === 'DELETE' && claimMatch) {
      const deviceName = claimMatch[1];
      return this.nplService.reclaimDevice(deviceName).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // ==================== TENANT OPERATIONS ====================

    // POST /api/tenant - Create tenant
    if (method === 'POST' && url === '/api/tenant') {
      const tenant = req.body as any;
      return this.nplService.createTenant(tenant).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // PUT /api/tenant - Update tenant
    if (method === 'PUT' && url === '/api/tenant') {
      const tenant = req.body as any;
      return this.nplService.updateTenant(tenant).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/tenant/{id}
    const deleteTenantMatch = url.match(/\/api\/tenant\/([^/]+)$/);
    if (method === 'DELETE' && deleteTenantMatch) {
      const tenantId = deleteTenantMatch[1];
      return this.nplService.deleteTenant(tenantId).pipe(
        map(result => this.createHttpResponse(req, { success: result }))
      );
    }

    // POST /api/tenants/bulk - Bulk create tenants
    if (method === 'POST' && url === '/api/tenants/bulk') {
      const tenants = req.body as any[];
      return this.nplService.bulkImportTenants(tenants).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // POST /api/tenants/bulk/import - Bulk import tenants
    if (method === 'POST' && url === '/api/tenants/bulk/import') {
      const tenants = req.body as any[];
      return this.nplService.bulkImportTenants(tenants).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // POST /api/tenants/bulk/delete - Bulk delete tenants
    if (method === 'POST' && url === '/api/tenants/bulk/delete') {
      const tenantIds = req.body as string[];
      return this.nplService.bulkDeleteTenants(tenantIds).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // If no specific handler found, throw error
    throw new Error(`Unhandled NPL transformation for: ${method} ${url}`);
  }

  private createHttpResponse<T>(req: HttpRequest<any>, body: T): HttpResponse<T> {
    return new HttpResponse({
      body: body,
      status: 200,
      statusText: 'OK',
      url: req.url
    });
  }

  private getQueryParam(req: HttpRequest<any>, param: string): string | null {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get(param);
  }

  private transformConnectionToThingsBoard(connection: any): any {
    return {
      pageSize: connection.pageSize,
      page: connection.page,
      totalElements: connection.totalElements,
      totalPages: connection.totalPages,
      hasNext: connection.hasNext,
      hasPrevious: connection.hasPrevious,
      data: connection.data || []
    };
  }

  private transformConnectionToDeviceInfos(connection: any): any {
    return {
      pageSize: connection.pageSize,
      page: connection.page,
      totalElements: connection.totalElements,
      totalPages: connection.totalPages,
      hasNext: connection.hasNext,
      hasPrevious: connection.hasPrevious,
      data: connection.data || []
    };
  }

  private getCurrentTenantId(): string {
    // This would need to be extracted from the JWT token or user context
    // For now, return a hardcoded tenant ID
    return '7211c450-742e-11f0-9d1a-913de8284e4f';
  }
} 