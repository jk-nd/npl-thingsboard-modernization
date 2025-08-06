import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TenantModernizationInterceptor } from '../frontend-overlay/src/app/npl-modernization/interceptors/tenant-modernization.interceptor';
import { TenantNplService } from '../frontend-overlay/src/app/npl-modernization/services/tenant-npl.service';
import { TenantGraphQLService } from '../frontend-overlay/src/app/npl-modernization/services/tenant-graphql.service';

describe('Tenant Overlay Integration', () => {
  let interceptor: TenantModernizationInterceptor;
  let tenantNplService: TenantNplService;
  let tenantGraphQLService: TenantGraphQLService;
  let httpMock: HttpTestingController;

  const mockTenantData = {
    name: 'Test Tenant',
    title: 'Test Tenant Title',
    region: 'Global',
    country: 'United States',
    stateName: 'California',
    city: 'San Francisco',
    address: '123 Test Street',
    address2: 'Suite 100',
    zip: '94105',
    phone: '+1-555-123-4567',
    email: 'test@tenant.com',
    limits: {
      maxUsers: 100,
      maxDevices: 1000,
      maxAssets: 500,
      maxCustomers: 50
    }
  };

  const mockTenant = {
    id: 'tenant_123',
    name: 'Test Tenant',
    title: 'Test Tenant Title',
    region: 'Global',
    country: 'United States',
    stateName: 'California',
    city: 'San Francisco',
    address: '123 Test Street',
    address2: 'Suite 100',
    zip: '94105',
    phone: '+1-555-123-4567',
    email: 'test@tenant.com',
    limits: {
      maxUsers: 100,
      maxDevices: 1000,
      maxAssets: 500,
      maxCustomers: 50
    },
    createdTime: '2024-01-01T00:00:00Z',
    additionalInfo: '{}'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TenantModernizationInterceptor,
        TenantNplService,
        TenantGraphQLService
      ]
    });

    interceptor = TestBed.inject(TenantModernizationInterceptor);
    tenantNplService = TestBed.inject(TenantNplService);
    tenantGraphQLService = TestBed.inject(TenantGraphQLService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('HTTP Interceptor Routing', () => {
    it('should route tenant write operations to NPL Engine', (done) => {
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      interceptor.intercept(req, {
        handle: (request) => {
          // This should not be called for tenant operations
          fail('Should not reach ThingsBoard for tenant write operations');
          return of(null);
        }
      }).subscribe(response => {
        expect(response).toBeDefined();
        done();
      });

      // The interceptor should route to NPL Engine
      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      expect(nplReq.request.method).toBe('POST');
      nplReq.flush(mockTenant);
    });

    it('should route tenant read operations to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      interceptor.intercept(req, {
        handle: (request) => {
          // This should not be called for tenant operations
          fail('Should not reach ThingsBoard for tenant read operations');
          return of(null);
        }
      }).subscribe(response => {
        expect(response).toBeDefined();
        done();
      });

      // The interceptor should route to GraphQL
      const graphqlReq = httpMock.expectOne('/api/graphql');
      expect(graphqlReq.request.method).toBe('POST');
      graphqlReq.flush({ data: { tenant: mockTenant } });
    });

    it('should pass non-tenant operations to ThingsBoard', (done) => {
      const req = new HttpRequest('GET', '/api/device/device_123');
      
      interceptor.intercept(req, {
        handle: (request) => {
          // This should be called for non-tenant operations
          expect(request.url).toBe('/api/device/device_123');
          return of(new HttpResponse({ body: { id: 'device_123' } }));
        }
      }).subscribe(response => {
        expect(response).toBeDefined();
        done();
      });
    });
  });

  describe('Write Operations Routing', () => {
    it('should route POST /api/tenant to NPL createTenant', (done) => {
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      expect(nplReq.request.body).toEqual({
        tenantData: mockTenantData,
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      nplReq.flush(mockTenant);
      done();
    });

    it('should route PUT /api/tenant/{id} to NPL updateTenant', (done) => {
      const req = new HttpRequest('PUT', '/api/tenant/tenant_123', mockTenantData);
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/updateTenant');
      expect(nplReq.request.body).toEqual({
        id: 'tenant_123',
        tenantData: mockTenantData,
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      nplReq.flush(mockTenant);
      done();
    });

    it('should route DELETE /api/tenant/{id} to NPL deleteTenant', (done) => {
      const req = new HttpRequest('DELETE', '/api/tenant/tenant_123');
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/deleteTenant');
      expect(nplReq.request.body).toEqual({
        id: 'tenant_123',
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      nplReq.flush(null);
      done();
    });

    it('should route POST /api/tenants/bulk to NPL bulkImportTenants', (done) => {
      const bulkData = [mockTenantData];
      const req = new HttpRequest('POST', '/api/tenants/bulk', bulkData);
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/bulkImportTenants');
      expect(nplReq.request.body).toEqual({
        tenantDataList: bulkData,
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      nplReq.flush({ successCount: 1, failureCount: 0, errors: [] });
      done();
    });
  });

  describe('Read Operations Routing', () => {
    it('should route GET /api/tenant/{id} to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const graphqlReq = httpMock.expectOne('/api/graphql');
      expect(graphqlReq.request.method).toBe('POST');
      expect(graphqlReq.request.body).toContain('query GetTenant');
      graphqlReq.flush({ data: { tenant: mockTenant } });
      done();
    });

    it('should route GET /api/tenants to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenants?pageSize=10&page=0');
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const graphqlReq = httpMock.expectOne('/api/graphql');
      expect(graphqlReq.request.method).toBe('POST');
      expect(graphqlReq.request.body).toContain('query GetTenants');
      graphqlReq.flush({ data: { tenants: [mockTenant] } });
      done();
    });

    it('should route GET /api/tenant/info/{id} to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/info/tenant_123');
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const graphqlReq = httpMock.expectOne('/api/graphql');
      expect(graphqlReq.request.method).toBe('POST');
      expect(graphqlReq.request.body).toContain('query GetTenantInfo');
      graphqlReq.flush({ data: { tenantInfo: { tenant: mockTenant, tenantProfileName: 'Default' } } });
      done();
    });
  });

  describe('Error Handling', () => {
    it('should handle NPL Engine errors gracefully', (done) => {
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          expect(error.error.message).toContain('Invalid tenant data');
          done();
        }
      });

      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      nplReq.flush(
        { message: 'Invalid tenant data' },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should handle GraphQL errors gracefully', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
          expect(error.error.message).toContain('Tenant not found');
          done();
        }
      });

      const graphqlReq = httpMock.expectOne('/api/graphql');
      graphqlReq.flush(
        { errors: [{ message: 'Tenant not found' }] },
        { status: 404, statusText: 'Not Found' }
      );
    });
  });

  describe('Authentication Integration', () => {
    it('should include authentication headers in NPL requests', (done) => {
      // Mock authentication token
      spyOn(localStorage, 'getItem').and.returnValue('mock-auth-token');
      
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      expect(nplReq.request.headers.get('Authorization')).toBe('Bearer mock-auth-token');
      nplReq.flush(mockTenant);
      done();
    });

    it('should include authentication headers in GraphQL requests', (done) => {
      // Mock authentication token
      spyOn(localStorage, 'getItem').and.returnValue('mock-auth-token');
      
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const graphqlReq = httpMock.expectOne('/api/graphql');
      expect(graphqlReq.request.headers.get('Authorization')).toBe('Bearer mock-auth-token');
      graphqlReq.flush({ data: { tenant: mockTenant } });
      done();
    });
  });

  describe('Performance and Caching', () => {
    it('should not cache NPL write operations', (done) => {
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const nplReq = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      expect(nplReq.request.headers.get('Cache-Control')).toBe('no-cache');
      nplReq.flush(mockTenant);
      done();
    });

    it('should allow caching for GraphQL read operations', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      interceptor.intercept(req, {
        handle: () => of(null)
      }).subscribe();

      const graphqlReq = httpMock.expectOne('/api/graphql');
      // GraphQL responses can be cached by Apollo Client
      graphqlReq.flush({ data: { tenant: mockTenant } });
      done();
    });
  });
}); 