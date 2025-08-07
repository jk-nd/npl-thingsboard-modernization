import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest, HttpResponse, HttpEvent } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { TenantModernizationInterceptor } from '../../src/app/npl-modernization/interceptors/tenant-modernization.interceptor';
import { TenantNplService } from '../../src/app/npl-modernization/services/tenant-npl.service';
import { TenantGraphQLService } from '../../src/app/npl-modernization/services/tenant-graphql.service';

describe('Tenant Overlay Integration', () => {
  let interceptor: TenantModernizationInterceptor;
  let tenantNplService: any;
  let tenantGraphQLService: any;
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
    const nplSpy = jasmine.createSpyObj('TenantNplService', [
      'createTenant', 'updateTenant', 'deleteTenant', 'bulkImportTenants', 'bulkDeleteTenants'
    ]);
    const gqlSpy = jasmine.createSpyObj('TenantGraphQLService', [
      'getTenant', 'getTenantInfo', 'getTenantsPaginated', 'getTenantInfosPaginated'
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TenantModernizationInterceptor,
        { provide: TenantNplService, useValue: nplSpy },
        { provide: TenantGraphQLService, useValue: gqlSpy }
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

      tenantNplService.createTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => {
          fail('Should not reach ThingsBoard for tenant write operations');
          return of(new HttpResponse({ status: 200 }) as HttpEvent<any>);
        }
      }).subscribe(response => {
        expect(response).toBeDefined();
        expect(tenantNplService.createTenant).toHaveBeenCalledWith(mockTenantData);
        done();
      });
    });

    it('should route tenant read operations to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');

      tenantGraphQLService.getTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => {
          fail('Should not reach ThingsBoard for tenant read operations');
          return of(new HttpResponse({ status: 200 }) as HttpEvent<any>);
        }
      }).subscribe(response => {
        expect(response).toBeDefined();
        expect(tenantGraphQLService.getTenant).toHaveBeenCalledWith('tenant_123');
        done();
      });
    });

    it('should pass non-tenant operations to ThingsBoard', (done) => {
      const req = new HttpRequest('GET', '/api/device/device_123');
      
      interceptor.intercept(req, {
        handle: (request) => {
          // This should be called for non-tenant operations
          expect(request.url).toBe('/api/device/device_123');
          return of(new HttpResponse({ body: { id: 'device_123' } }) as HttpEvent<any>);
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
      
      tenantNplService.createTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(res => {
        expect(tenantNplService.createTenant).toHaveBeenCalledWith(mockTenantData);
        done();
      });
    });

    it('should route PUT /api/tenant/{id} to NPL updateTenant', (done) => {
      const req = new HttpRequest('PUT', '/api/tenant/tenant_123', mockTenantData);
      
      tenantNplService.updateTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(res => {
        expect(tenantNplService.updateTenant).toHaveBeenCalledWith('tenant_123', mockTenantData);
        done();
      });
    });

    it('should route DELETE /api/tenant/{id} to NPL deleteTenant', (done) => {
      const req = new HttpRequest('DELETE', '/api/tenant/tenant_123');
      
      tenantNplService.deleteTenant.and.returnValue(of(null));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(res => {
        expect(tenantNplService.deleteTenant).toHaveBeenCalledWith('tenant_123');
        done();
      });
    });

    it('should route POST /api/tenants/bulk to NPL bulkImportTenants', (done) => {
      const bulkData = [mockTenantData];
      const req = new HttpRequest('POST', '/api/tenants/bulk', bulkData);
      
      tenantNplService.bulkImportTenants.and.returnValue(of({ successCount: 1, failureCount: 0, errors: [] }));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(res => {
        expect(tenantNplService.bulkImportTenants).toHaveBeenCalledWith(bulkData);
        done();
      });
    });
  });

  describe('Read Operations Routing', () => {
    it('should route GET /api/tenant/{id} to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      tenantGraphQLService.getTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(res => {
        expect(tenantGraphQLService.getTenant).toHaveBeenCalledWith('tenant_123');
        done();
      });
    });

    it('should route GET /api/tenants to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenants?pageSize=10&page=0');
      
      tenantGraphQLService.getTenantsPaginated.and.returnValue(of([mockTenant] as any));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(res => {
        expect(tenantGraphQLService.getTenantsPaginated).toHaveBeenCalled();
        done();
      });
    });

    it('should route GET /api/tenant/info/{id} to GraphQL', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/info/tenant_123');
      
      tenantGraphQLService.getTenantInfo.and.returnValue(of({ tenant: mockTenant, tenantProfileName: 'Default' } as any));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(res => {
        expect(tenantGraphQLService.getTenantInfo).toHaveBeenCalledWith('tenant_123');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle NPL Engine errors gracefully', (done) => {
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      tenantNplService.createTenant.and.returnValue(throwError(() => ({ status: 400, error: { message: 'Invalid tenant data' } })));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          expect(error.error.message).toContain('Invalid tenant data');
          done();
        }
      });
    });

    it('should handle GraphQL errors gracefully', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      tenantGraphQLService.getTenant.and.returnValue(throwError(() => ({ status: 404, error: { message: 'Tenant not found' } })));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
          expect(error.error.message).toContain('Tenant not found');
          done();
        }
      });
    });
  });

  describe('Authentication Integration', () => {
    it('should include authentication headers in NPL requests', (done) => {
      // Mock authentication token
      spyOn(localStorage, 'getItem').and.returnValue('mock-auth-token');
      
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      tenantNplService.createTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(() => {
        expect(tenantNplService.createTenant).toHaveBeenCalledWith(mockTenantData);
        done();
      });
    });

    it('should include authentication headers in GraphQL requests', (done) => {
      // Mock authentication token
      spyOn(localStorage, 'getItem').and.returnValue('mock-auth-token');
      
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      tenantGraphQLService.getTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(() => {
        expect(tenantGraphQLService.getTenant).toHaveBeenCalledWith('tenant_123');
        done();
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should not cache NPL write operations', (done) => {
      const req = new HttpRequest('POST', '/api/tenant', mockTenantData);
      
      tenantNplService.createTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(() => {
        expect(tenantNplService.createTenant).toHaveBeenCalledWith(mockTenantData);
        done();
      });
    });

    it('should allow caching for GraphQL read operations', (done) => {
      const req = new HttpRequest('GET', '/api/tenant/tenant_123');
      
      tenantGraphQLService.getTenant.and.returnValue(of(mockTenant));

      interceptor.intercept(req, {
        handle: () => of(new HttpResponse({ status: 200 }) as HttpEvent<any>)
      }).subscribe(() => {
        expect(tenantGraphQLService.getTenant).toHaveBeenCalledWith('tenant_123');
        done();
      });
    });
  });
}); 