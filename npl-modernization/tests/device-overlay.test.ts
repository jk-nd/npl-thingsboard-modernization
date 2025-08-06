import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpResponse, HttpHandler } from '@angular/common/http';
import { of } from 'rxjs';
import { DeviceModernizationInterceptor } from '../frontend-overlay/src/app/npl-modernization/interceptors/device-modernization.interceptor';

describe('DeviceModernizationInterceptor', () => {
  let interceptor: DeviceModernizationInterceptor;
  let mockHandler: jasmine.SpyObj<HttpHandler>;

  beforeEach(() => {
    mockHandler = jasmine.createSpyObj('HttpHandler', ['handle']);
    TestBed.configureTestingModule({
      providers: [DeviceModernizationInterceptor]
    });
    interceptor = TestBed.inject(DeviceModernizationInterceptor);
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  describe('Device Request Detection', () => {
    it('should identify device requests correctly', () => {
      const deviceUrls = [
        '/api/device/123',
        '/api/devices',
        '/api/device/info/456',
        '/api/device/789/credentials'
      ];

      deviceUrls.forEach(url => {
        expect(interceptor['isDeviceRequest'](url)).toBe(true);
      });
    });

    it('should not identify non-device requests', () => {
      const nonDeviceUrls = [
        '/api/tenant/123',
        '/api/customer/456',
        '/api/user/789',
        '/api/asset/101'
      ];

      nonDeviceUrls.forEach(url => {
        expect(interceptor['isDeviceRequest'](url)).toBe(false);
      });
    });
  });

  describe('Write Operation Detection', () => {
    it('should identify write operations correctly', () => {
      const writeRequests = [
        { url: '/api/device', method: 'POST' },
        { url: '/api/device/123', method: 'PUT' },
        { url: '/api/device/456', method: 'DELETE' },
        { url: '/api/devices/bulk', method: 'POST' },
        { url: '/api/devices/bulk/delete', method: 'POST' },
        { url: '/api/device/789/assign', method: 'POST' },
        { url: '/api/device/101/unassign', method: 'POST' },
        { url: '/api/device/202/credentials', method: 'POST' }
      ];

      writeRequests.forEach(({ url, method }) => {
        expect(interceptor['isWriteOperation'](url, method)).toBe(true);
      });
    });

    it('should not identify read operations as write', () => {
      const readRequests = [
        { url: '/api/device/123', method: 'GET' },
        { url: '/api/devices', method: 'GET' },
        { url: '/api/device/info/456', method: 'GET' },
        { url: '/api/device/789/credentials', method: 'GET' }
      ];

      readRequests.forEach(({ url, method }) => {
        expect(interceptor['isWriteOperation'](url, method)).toBe(false);
      });
    });
  });

  describe('URL Transformation', () => {
    it('should transform device URLs to NPL Engine URLs', () => {
      const transformations = [
        {
          original: '/api/device',
          expected: 'http://localhost:12000/api/deviceManagement.DeviceManagement/saveDevice'
        },
        {
          original: '/api/device/123/assign',
          expected: 'http://localhost:12000/api/deviceManagement.DeviceManagement/assignDeviceToCustomer'
        },
        {
          original: '/api/device/456/unassign',
          expected: 'http://localhost:12000/api/deviceManagement.DeviceManagement/unassignDeviceFromCustomer'
        },
        {
          original: '/api/device/789/credentials',
          expected: 'http://localhost:12000/api/deviceManagement.DeviceManagement/updateDeviceCredentials'
        },
        {
          original: '/api/devices/bulk',
          expected: 'http://localhost:12000/api/deviceManagement.DeviceManagement/bulkImportDevices'
        },
        {
          original: '/api/devices/bulk/delete',
          expected: 'http://localhost:12000/api/deviceManagement.DeviceManagement/bulkDeleteDevices'
        }
      ];

      transformations.forEach(({ original, expected }) => {
        expect(interceptor['transformToNplUrl'](original)).toBe(expected);
      });
    });

    it('should transform URLs to GraphQL endpoint', () => {
      const graphqlUrl = 'http://localhost:4000/graphql';
      expect(interceptor['transformToGraphQLUrl']('/api/device/123')).toBe(graphqlUrl);
      expect(interceptor['transformToGraphQLUrl']('/api/devices')).toBe(graphqlUrl);
    });
  });

  describe('Request Routing', () => {
    it('should route write operations to NPL Engine', (done) => {
      const request = new HttpRequest('POST', '/api/device', { name: 'Test Device' });
      const mockResponse = new HttpResponse({ status: 200 });

      mockHandler.handle.and.returnValue(of(mockResponse));

      interceptor.intercept(request, mockHandler).subscribe(response => {
        expect(mockHandler.handle).toHaveBeenCalled();
        const nplRequest = mockHandler.handle.calls.mostRecent().args[0];
        expect(nplRequest.url).toContain('deviceManagement.DeviceManagement');
        expect(nplRequest.headers.get('X-NPL-Modernization')).toBe('device');
        done();
      });
    });

    it('should route read operations to GraphQL', (done) => {
      const request = new HttpRequest('GET', '/api/device/123');
      const mockResponse = new HttpResponse({ status: 200 });

      mockHandler.handle.and.returnValue(of(mockResponse));

      interceptor.intercept(request, mockHandler).subscribe(response => {
        expect(mockHandler.handle).toHaveBeenCalled();
        const graphqlRequest = mockHandler.handle.calls.mostRecent().args[0];
        expect(graphqlRequest.url).toBe('http://localhost:4000/graphql');
        expect(graphqlRequest.headers.get('X-GraphQL-Modernization')).toBe('device');
        done();
      });
    });

    it('should pass through non-device requests', (done) => {
      const request = new HttpRequest('GET', '/api/tenant/123');
      const mockResponse = new HttpResponse({ status: 200 });

      mockHandler.handle.and.returnValue(of(mockResponse));

      interceptor.intercept(request, mockHandler).subscribe(response => {
        expect(mockHandler.handle).toHaveBeenCalledWith(request);
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle NPL Engine errors gracefully', (done) => {
      const request = new HttpRequest('POST', '/api/device', { name: 'Test Device' });
      const errorResponse = new HttpResponse({ status: 500 });

      mockHandler.handle.and.returnValue(of(errorResponse));

      interceptor.intercept(request, mockHandler).subscribe({
        next: (response) => {
          expect(response.status).toBe(500);
          done();
        },
        error: (error) => {
          fail('Should not throw error');
        }
      });
    });

    it('should handle GraphQL errors gracefully', (done) => {
      const request = new HttpRequest('GET', '/api/device/123');
      const errorResponse = new HttpResponse({ status: 404 });

      mockHandler.handle.and.returnValue(of(errorResponse));

      interceptor.intercept(request, mockHandler).subscribe({
        next: (response) => {
          expect(response.status).toBe(404);
          done();
        },
        error: (error) => {
          fail('Should not throw error');
        }
      });
    });
  });

  describe('Header Management', () => {
    it('should add NPL modernization header for write operations', (done) => {
      const request = new HttpRequest('POST', '/api/device', { name: 'Test Device' });
      const mockResponse = new HttpResponse({ status: 200 });

      mockHandler.handle.and.returnValue(of(mockResponse));

      interceptor.intercept(request, mockHandler).subscribe(() => {
        const nplRequest = mockHandler.handle.calls.mostRecent().args[0];
        expect(nplRequest.headers.get('X-NPL-Modernization')).toBe('device');
        done();
      });
    });

    it('should add GraphQL modernization header for read operations', (done) => {
      const request = new HttpRequest('GET', '/api/device/123');
      const mockResponse = new HttpResponse({ status: 200 });

      mockHandler.handle.and.returnValue(of(mockResponse));

      interceptor.intercept(request, mockHandler).subscribe(() => {
        const graphqlRequest = mockHandler.handle.calls.mostRecent().args[0];
        expect(graphqlRequest.headers.get('X-GraphQL-Modernization')).toBe('device');
        done();
      });
    });

    it('should preserve existing headers', (done) => {
      const request = new HttpRequest('POST', '/api/device', { name: 'Test Device' }, null, {
        headers: { 'Authorization': 'Bearer token123', 'Content-Type': 'application/json' }
      });
      const mockResponse = new HttpResponse({ status: 200 });

      mockHandler.handle.and.returnValue(of(mockResponse));

      interceptor.intercept(request, mockHandler).subscribe(() => {
        const nplRequest = mockHandler.handle.calls.mostRecent().args[0];
        expect(nplRequest.headers.get('Authorization')).toBe('Bearer token123');
        expect(nplRequest.headers.get('Content-Type')).toBe('application/json');
        expect(nplRequest.headers.get('X-NPL-Modernization')).toBe('device');
        done();
      });
    });
  });
}); 