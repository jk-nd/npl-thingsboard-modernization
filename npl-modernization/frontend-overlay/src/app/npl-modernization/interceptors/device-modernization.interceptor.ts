import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class DeviceModernizationInterceptor implements HttpInterceptor {
  
  // Device read endpoints (GraphQL)
  private readonly readEndpoints = [
    '/api/device/{id}',
    '/api/device/info/{id}',
    '/api/devices',
    '/api/deviceInfos',
    '/api/device/{deviceId}/credentials',
    '/api/device/{deviceId}/relations',
    '/api/device/{deviceId}/alarms',
    '/api/device/{deviceId}/events',
    '/api/device/{deviceId}/telemetry'
  ];

  // Device write endpoints (NPL Engine)
  private readonly writeEndpoints = [
    '/api/device', // POST/PUT
    '/api/device/{id}', // DELETE
    '/api/device/{deviceId}/assign',
    '/api/device/{deviceId}/unassign',
    '/api/devices/bulk', // POST
    '/api/devices/bulk/delete', // POST
    '/api/device/{deviceId}/credentials'
  ];

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = request.url;
    const method = request.method;

    // Check if this is a device-related request
    if (this.isDeviceRequest(url)) {
      if (this.isWriteOperation(url, method)) {
        // Route write operations to NPL Engine
        return this.routeToNplEngine(request, next);
      } else {
        // Route read operations to GraphQL
        return this.routeToGraphQL(request, next);
      }
    }

    // Pass through non-device requests to ThingsBoard
    return next.handle(request);
  }

  private isDeviceRequest(url: string): boolean {
    return url.includes('/api/device') || url.includes('/api/devices');
  }

  private isWriteOperation(url: string, method: string): boolean {
    // Check if it's a write operation
    const isWriteMethod = method === 'POST' || method === 'PUT' || method === 'DELETE';
    
    // Check if URL matches write endpoints
    const matchesWriteEndpoint = this.writeEndpoints.some(endpoint => {
      const pattern = endpoint.replace(/\{.*?\}/g, '[^/]+');
      const regex = new RegExp(pattern.replace(/\//g, '\\/'));
      return regex.test(url);
    });

    return isWriteMethod && matchesWriteEndpoint;
  }

  private routeToNplEngine(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const nplUrl = this.transformToNplUrl(request.url);
    
    console.log(`🔄 Device Interceptor: Routing to NPL Engine: ${request.url} -> ${nplUrl}`);
    
    const nplRequest = request.clone({
      url: nplUrl,
      headers: request.headers.set('X-NPL-Modernization', 'device')
    });

    return next.handle(nplRequest).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          console.log(`✅ Device NPL Engine Response: ${event.status}`);
        }
      })
    );
  }

  private routeToGraphQL(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const graphqlUrl = this.transformToGraphQLUrl(request.url);
    
    console.log(`🔄 Device Interceptor: Routing to GraphQL: ${request.url} -> ${graphqlUrl}`);
    
    const graphqlRequest = request.clone({
      url: graphqlUrl,
      headers: request.headers.set('X-GraphQL-Modernization', 'device')
    });

    return next.handle(graphqlRequest).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          console.log(`✅ Device GraphQL Response: ${event.status}`);
        }
      })
    );
  }

  private transformToNplUrl(originalUrl: string): string {
    // Transform ThingsBoard device URLs to NPL Engine URLs
    const nplBaseUrl = 'http://localhost:12000/api';
    
    if (originalUrl.includes('/api/device') && !originalUrl.includes('/api/devices')) {
      // Single device operations
      if (originalUrl.includes('/assign')) {
        return `${nplBaseUrl}/deviceManagement.DeviceManagement/assignDeviceToCustomer`;
      } else if (originalUrl.includes('/unassign')) {
        return `${nplBaseUrl}/deviceManagement.DeviceManagement/unassignDeviceFromCustomer`;
      } else if (originalUrl.includes('/credentials')) {
        return `${nplBaseUrl}/deviceManagement.DeviceManagement/updateDeviceCredentials`;
      } else {
        return `${nplBaseUrl}/deviceManagement.DeviceManagement/saveDevice`;
      }
    } else if (originalUrl.includes('/api/devices/bulk')) {
      return `${nplBaseUrl}/deviceManagement.DeviceManagement/bulkImportDevices`;
    } else if (originalUrl.includes('/api/devices/bulk/delete')) {
      return `${nplBaseUrl}/deviceManagement.DeviceManagement/bulkDeleteDevices`;
    }
    
    return originalUrl;
  }

  private transformToGraphQLUrl(originalUrl: string): string {
    // Transform to GraphQL endpoint
    return 'http://localhost:4000/graphql';
  }
} 