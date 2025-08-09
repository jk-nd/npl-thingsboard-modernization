import { TenantSyncService, TenantData, NplEngineService, ThingsBoardService } from '@services/tenant-sync.service';
import { expect, jest, describe, beforeEach, test } from '@jest/globals';

describe('TenantSyncService', () => {
  let tenantSyncService: TenantSyncService;
  let mockNplEngineService: NplEngineService;
  let mockThingsBoardService: ThingsBoardService;

  const mockTenant: TenantData = {
    id: 'tenant-123',
    name: 'test-tenant',
    title: 'Test Tenant',
    region: 'US',
    country: 'United States',
    stateName: 'California',
    city: 'San Francisco',
    address: '123 Main St',
    address2: 'Suite 100',
    zip: '94105',
    phone: '+1-555-123-4567',
    email: 'test@example.com',
    limits: { maxUsers: 100, maxDevices: 1000, maxAssets: 500, maxCustomers: 50 },
    createdTime: new Date().toISOString(),
    additionalInfo: '{}'
  };

  beforeEach(() => {
    mockNplEngineService = {
      getAllTenants: jest.fn(async () => [mockTenant]),
      getTenantCount: jest.fn(async () => 1),
      createTenant: jest.fn(async (t: TenantData) => t)
    };

    mockThingsBoardService = {
      getAllTenants: jest.fn(async () => []),
      getTenantCount: jest.fn(async () => 0),
      createTenant: jest.fn(async (t: any) => t),
      updateTenant: jest.fn(async (id: string, t: any) => t),
      deleteTenant: jest.fn(async (id: string) => {})
    };

    tenantSyncService = new TenantSyncService(mockNplEngineService, mockThingsBoardService);
  });

  test('syncs tenant creation to ThingsBoard', async () => {
    await tenantSyncService.syncTenantToThingsBoard(mockTenant, 'create');
    expect(mockThingsBoardService.createTenant).toHaveBeenCalledWith(expect.objectContaining({ id: mockTenant.id }));
  });

  test('syncs tenant update to ThingsBoard', async () => {
    const updated = { ...mockTenant, title: 'Updated' };
    await tenantSyncService.syncTenantToThingsBoard(updated, 'update');
    expect(mockThingsBoardService.updateTenant).toHaveBeenCalledWith(updated.id, expect.objectContaining({ title: 'Updated' }));
  });

  test('syncs tenant deletion to ThingsBoard', async () => {
    await tenantSyncService.syncTenantToThingsBoard(mockTenant, 'delete');
    expect(mockThingsBoardService.deleteTenant).toHaveBeenCalledWith(mockTenant.id);
  });

  test('full sync creates missing tenants in ThingsBoard', async () => {
    (mockThingsBoardService.getAllTenants as any).mockResolvedValueOnce([]);
    (mockNplEngineService.getAllTenants as any).mockResolvedValueOnce([mockTenant]);

    await tenantSyncService.syncAllTenantsFromNplToThingsBoard();

    expect(mockThingsBoardService.createTenant).toHaveBeenCalledWith(expect.objectContaining({ id: mockTenant.id }));
  });

  test('getSyncStatus returns both counts and status', async () => {
    const status = await tenantSyncService.getSyncStatus();
    expect(status).toEqual(expect.objectContaining({ nplTenantCount: 1, thingsBoardTenantCount: 0, syncInProgress: false }));
  });
});