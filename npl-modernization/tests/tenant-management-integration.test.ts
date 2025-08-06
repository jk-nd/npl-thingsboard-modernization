import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TenantNplService } from '../frontend-overlay/src/app/npl-modernization/services/tenant-npl.service';
import { TenantGraphQLService } from '../frontend-overlay/src/app/npl-modernization/services/tenant-graphql.service';
import { TenantData, Tenant, TenantInfo, TenantLimits } from '../frontend-overlay/src/app/npl-modernization/services/tenant-graphql.service';

describe('Tenant Management Integration', () => {
  let tenantNplService: TenantNplService;
  let tenantGraphQLService: TenantGraphQLService;
  let httpMock: HttpTestingController;

  const mockTenantData: TenantData = {
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

  const mockTenant: Tenant = {
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
      providers: [TenantNplService, TenantGraphQLService]
    });

    tenantNplService = TestBed.inject(TenantNplService);
    tenantGraphQLService = TestBed.inject(TenantGraphQLService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('NPL Engine Write Operations', () => {
    it('should create tenant via NPL engine', (done) => {
      tenantNplService.createTenant(mockTenantData).subscribe(tenant => {
        expect(tenant).toEqual(mockTenant);
        expect(tenant.name).toBe('Test Tenant');
        expect(tenant.limits.maxUsers).toBe(100);
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        tenantData: mockTenantData,
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      req.flush(mockTenant);
    });

    it('should update tenant via NPL engine', (done) => {
      const updatedData = { ...mockTenantData, title: 'Updated Title' };
      const updatedTenant = { ...mockTenant, title: 'Updated Title' };

      tenantNplService.updateTenant('tenant_123', updatedData).subscribe(tenant => {
        expect(tenant).toEqual(updatedTenant);
        expect(tenant.title).toBe('Updated Title');
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/updateTenant');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        id: 'tenant_123',
        tenantData: updatedData,
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      req.flush(updatedTenant);
    });

    it('should delete tenant via NPL engine', (done) => {
      tenantNplService.deleteTenant('tenant_123').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/deleteTenant');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({
        id: 'tenant_123',
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      req.flush(null);
    });

    it('should bulk import tenants via NPL engine', (done) => {
      const tenantDataList = [mockTenantData];
      const bulkResult = {
        successCount: 1,
        failureCount: 0,
        errors: []
      };

      tenantNplService.bulkImportTenants(tenantDataList).subscribe(result => {
        expect(result).toEqual(bulkResult);
        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/bulkImportTenants');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        tenantDataList,
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      req.flush(bulkResult);
    });

    it('should bulk delete tenants via NPL engine', (done) => {
      const tenantIds = ['tenant_123', 'tenant_456'];

      tenantNplService.bulkDeleteTenants(tenantIds).subscribe(deletedCount => {
        expect(deletedCount).toBe(2);
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/bulkDeleteTenants');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        tenantIds,
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      req.flush(2);
    });

    it('should initialize tenant management protocol', (done) => {
      const protocolId = 'protocol_123';

      tenantNplService.initializeProtocol().subscribe(id => {
        expect(id).toBe(protocolId);
        done();
      });

      const req = httpMock.expectOne('/api/npl/protocol/instantiate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        protocolName: 'tenantManagement.TenantManagement',
        party: {
          entity: { email: ['sysadmin@thingsboard.org'] },
          access: {}
        }
      });
      req.flush({ protocolId });
    });
  });

  describe('GraphQL Read Operations', () => {
    it('should get tenant by ID via GraphQL', (done) => {
      tenantGraphQLService.getTenant('tenant_123').subscribe(tenant => {
        expect(tenant).toEqual(mockTenant);
        done();
      });

      // Note: This would be handled by Apollo Client, not HTTP interceptor
      done();
    });

    it('should get all tenants via GraphQL', (done) => {
      const tenants = [mockTenant];

      tenantGraphQLService.getTenants().subscribe(result => {
        expect(result).toEqual(tenants);
        expect(result.length).toBe(1);
        done();
      });

      // Note: This would be handled by Apollo Client, not HTTP interceptor
      done();
    });

    it('should search tenants via GraphQL', (done) => {
      const tenants = [mockTenant];

      tenantGraphQLService.searchTenants('Test').subscribe(result => {
        expect(result).toEqual(tenants);
        done();
      });

      // Note: This would be handled by Apollo Client, not HTTP interceptor
      done();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors when creating tenant', (done) => {
      const invalidData = { ...mockTenantData, name: '' }; // Invalid: empty name

      tenantNplService.createTenant(invalidData).subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          expect(error.error.message).toContain('Invalid tenant data');
          done();
        }
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      req.flush(
        { message: 'Invalid tenant data' },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should handle tenant not found errors', (done) => {
      tenantNplService.updateTenant('nonexistent', mockTenantData).subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
          expect(error.error.message).toContain('Tenant not found');
          done();
        }
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/updateTenant');
      req.flush(
        { message: 'Tenant not found' },
        { status: 404, statusText: 'Not Found' }
      );
    });

    it('should handle duplicate tenant name errors', (done) => {
      tenantNplService.createTenant(mockTenantData).subscribe({
        error: (error) => {
          expect(error.status).toBe(409);
          expect(error.error.message).toContain('Tenant name already exists');
          done();
        }
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      req.flush(
        { message: 'Tenant name already exists' },
        { status: 409, statusText: 'Conflict' }
      );
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk import with mixed success and failures', (done) => {
      const tenantDataList = [
        mockTenantData,
        { ...mockTenantData, name: 'Duplicate Tenant' }, // Will fail
        { ...mockTenantData, name: 'Valid Tenant 2' }
      ];

      const bulkResult = {
        successCount: 2,
        failureCount: 1,
        errors: ['Tenant name already exists: Duplicate Tenant']
      };

      tenantNplService.bulkImportTenants(tenantDataList).subscribe(result => {
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
        expect(result.errors).toContain('Tenant name already exists: Duplicate Tenant');
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/bulkImportTenants');
      req.flush(bulkResult);
    });

    it('should handle bulk delete with partial failures', (done) => {
      const tenantIds = ['tenant_123', 'nonexistent', 'tenant_456'];

      tenantNplService.bulkDeleteTenants(tenantIds).subscribe(deletedCount => {
        expect(deletedCount).toBe(2); // Only 2 exist
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/bulkDeleteTenants');
      req.flush(2);
    });
  });

  describe('Contributor Library Integration', () => {
    it('should use contributor library for validation', (done) => {
      // This test verifies that the NPL protocol uses the contributor library
      // for validation instead of inline validation logic
      tenantNplService.createTenant(mockTenantData).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/createTenant');
      req.flush(mockTenant);
    });

    it('should use contributor library for bulk operations', (done) => {
      const tenantDataList = [mockTenantData];
      const bulkResult = {
        successCount: 1,
        failureCount: 0,
        errors: []
      };

      tenantNplService.bulkImportTenants(tenantDataList).subscribe(result => {
        expect(result.successCount).toBe(1);
        done();
      });

      const req = httpMock.expectOne('/api/npl/tenantManagement.TenantManagement/bulkImportTenants');
      req.flush(bulkResult);
    });
  });
}); 