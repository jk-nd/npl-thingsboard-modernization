import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse, HttpEvent } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DeviceGraphQLService, DevicesConnection } from './device-graphql.service';
import { NplClientService, Device } from './npl-client.service';

export interface TransformationResult {
  observable: Observable<HttpEvent<any>>;
  shouldTransform: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RequestTransformerService {
  
  // We'll need to store a protocol instance ID for NPL operations
  private protocolId: string | null = null;

  constructor(
    private graphqlService: DeviceGraphQLService,
    private nplService: NplClientService
  ) {
    this.initializeProtocolInstance();
  }

  /**
   * Initialize NPL protocol instance (in a real app, this might come from user context)
   */
  private async initializeProtocolInstance(): Promise<void> {
    try {
      // For demo purposes, create a simple protocol instance
      const parties = [
        {
          entity: { email: ['tenant@thingsboard.org'] },
          access: {}
        }
      ];

      const instance = await this.nplService.instantiateProtocol(parties).toPromise();
      this.protocolId = instance?.protocolId || null;
      console.log('NPL Protocol instance initialized:', this.protocolId);
    } catch (error) {
      console.error('Failed to initialize NPL protocol instance:', error);
    }
  }

  /**
   * Check if this is a device-related read operation
   */
  isReadOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    return req.method === 'GET' && (
      !!url.match(/\/api\/device\/[^/]+$/) ||                    // GET /api/device/{id}
      url.includes('/api/tenant/devices') ||                   // GET /api/tenant/devices
      (url.includes('/api/customer') && url.includes('/devices')) ||  // GET /api/customer/{customerId}/devices
      (url.includes('/api/devices') && url.includes('textSearch')) || // GET /api/devices?textSearch=X
      url.includes('/api/tenant/device-infos') ||              // GET /api/tenant/device-infos
      (url.includes('/api/customer') && url.includes('/device-infos')) // GET /api/customer/{customerId}/device-infos
    );
  }

  /**
   * Check if this is a device-related write operation
   */
  isWriteOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    return url.includes('/api/device') && (
      req.method === 'POST' ||    // Create device
      req.method === 'PUT' ||     // Update device  
      req.method === 'DELETE'     // Delete device
    ) && !url.includes('/credentials') && !url.includes('/claim'); // Exclude credential/claim operations for now
  }

  /**
   * Transform GET request to GraphQL query
   */
  transformToGraphQL(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const url = req.url;

    // GET /api/device/{id}
    const deviceIdMatch = url.match(/\/api\/device\/([^/]+)$/);
    if (deviceIdMatch) {
      const deviceId = deviceIdMatch[1];
      return this.graphqlService.getDeviceById(deviceId).pipe(
        map(device => this.createHttpResponse(req, device))
      );
    }

    // GET /api/tenant/devices with pagination
    if (url.includes('/api/tenant/devices')) {
      const params = this.extractQueryParams(url);
      const pageSize = parseInt(params['pageSize']) || 20;
      const page = parseInt(params['page']) || 0;
      
      return this.graphqlService.getTenantDevices(pageSize, page).pipe(
        map(connection => this.createHttpResponse(req, this.transformConnectionToThingsBoard(connection)))
      );
    }

    // GET /api/devices?textSearch=X
    if (url.includes('/api/devices') && url.includes('textSearch')) {
      const params = this.extractQueryParams(url);
      const textSearch = params['textSearch'] || '';
      const pageSize = parseInt(params['pageSize']) || 20;
      const page = parseInt(params['page']) || 0;

      return this.graphqlService.searchDevices(textSearch, pageSize, page).pipe(
        map(connection => this.createHttpResponse(req, this.transformConnectionToThingsBoard(connection)))
      );
    }

    // GET /api/customer/{customerId}/devices
    const customerDevicesMatch = url.match(/\/api\/customer\/([^/]+)\/devices/);
    if (customerDevicesMatch) {
      const customerId = customerDevicesMatch[1];
      const params = this.extractQueryParams(url);
      const pageSize = parseInt(params['pageSize']) || 20;
      const page = parseInt(params['page']) || 0;

      return this.graphqlService.getCustomerDevices(customerId, pageSize, page).pipe(
        map(connection => this.createHttpResponse(req, this.transformConnectionToThingsBoard(connection)))
      );
    }

    // Default fallback
    return this.graphqlService.getDevices().pipe(
      map(connection => this.createHttpResponse(req, this.transformConnectionToThingsBoard(connection)))
    );
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
      const device = req.body as Device;
      return this.nplService.saveDevice(this.protocolId, device).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // PUT /api/device - Update device
    if (method === 'PUT' && url === '/api/device') {
      const device = req.body as Device;
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
    const assignMatch = url.match(/\/api\/customer\/([^/]+)\/device\/([^/]+)$/);
    if (method === 'POST' && assignMatch) {
      const customerId = assignMatch[1];
      const deviceId = assignMatch[2];
      return this.nplService.assignDeviceToCustomer(this.protocolId, deviceId, customerId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    // DELETE /api/customer/device/{deviceId} - Unassign device
    const unassignMatch = url.match(/\/api\/customer\/device\/([^/]+)$/);
    if (method === 'DELETE' && unassignMatch) {
      const deviceId = unassignMatch[1];
      return this.nplService.unassignDeviceFromCustomer(this.protocolId, deviceId).pipe(
        map(result => this.createHttpResponse(req, result))
      );
    }

    throw new Error(`Unsupported NPL operation: ${method} ${url}`);
  }

  /**
   * Extract query parameters from URL
   */
  private extractQueryParams(url: string): { [key: string]: string } {
    const params: { [key: string]: string } = {};
    const queryString = url.split('?')[1];
    
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
    
    return params;
  }

  /**
   * Transform GraphQL connection format to ThingsBoard API format
   */
  private transformConnectionToThingsBoard(connection: DevicesConnection): any {
    return {
      data: connection.edges.map(edge => edge.node),
      totalPages: Math.ceil(connection.totalCount / 20), // Assuming 20 per page
      totalElements: connection.totalCount,
      hasNext: connection.pageInfo.hasNextPage,
      hasPrevious: connection.pageInfo.hasPreviousPage
    };
  }

  /**
   * Create HTTP response object
   */
  private createHttpResponse(req: HttpRequest<any>, body: any): HttpEvent<any> {
    return new HttpResponse({
      url: req.url,
      status: 200,
      statusText: 'OK',
      body: body,
      headers: req.headers
    });
  }

  /**
   * Get the current protocol ID (for testing/debugging)
   */
  getProtocolId(): string | null {
    return this.protocolId;
  }

  /**
   * Manually set protocol ID (for testing)
   */
  setProtocolId(protocolId: string): void {
    this.protocolId = protocolId;
  }
} 