import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantSyncService } from '../services/tenant-sync.service';
import { NplEngineService } from '../services/npl-engine.service';
import { ThingsBoardService } from '../services/thingsboard.service';

describe('TenantSyncService', () => {
  let service: TenantSyncService;
  let nplEngineService: jest.Mocked<NplEngineService>;
  let thingsBoardService: jest.Mocked<ThingsBoardService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

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

  const mockThingsBoardTenant = {
    id: 'tenant_123',
    name: 'Test Tenant',
    title: 'Test Tenant Title',
    region: 'Global',
    country: 'United States',
    state: 'California',
    city: 'San Francisco',
    address: '123 Test Street',
    address2: 'Suite 100',
    zip: '94105',
    phone: '+1-555-123-4567',
    email: 'test@tenant.com',
    additionalInfo: '{}',
    tenantProfileId: 'default-profile-id'
  };

  beforeEach(async () => {
    const mockNplEngineService = {
      getAllTenants: jest.fn(),
      getTenantCount: jest.fn(),
      createTenant: jest.fn()
    };

    const mockThingsBoardService = {
      getAllTenants: jest.fn(),
      getTenantCount: jest.fn(),
      createTenant: jest.fn(),
      updateTenant: jest.fn(),
      deleteTenant: jest.fn()
    };

    const mockEventEmitter = {
      on: jest.fn(),
      emit: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantSyncService,
        {
          provide: NplEngineService,
          useValue: mockNplEngineService
        },
        {
          provide: ThingsBoardService,
          useValue: mockThingsBoardService
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter
        }
      ]
    }).compile();

    service = module.get<TenantSyncService>(TenantSyncService);
    nplEngineService = module.get(NplEngineService);
    thingsBoardService = module.get(ThingsBoardService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('Event Listeners', () => {
    it('should setup event listeners for tenant events', () => {
      expect(eventEmitter.on).toHaveBeenCalledWith('tenantCreated', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('tenantUpdated', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('tenantDeleted', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('tenantsBulkImported', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('tenantsBulkDeleted', expect.any(Function));
    });
  });

  describe('Sync to ThingsBoard', () => {
    it('should sync tenant creation to ThingsBoard', async () => {
      await service.syncTenantToThingsBoard(mockTenant, 'create');

      expect(thingsBoardService.createTenant).toHaveBeenCalledWith({
        id: mockTenant.id,
        name: mockTenant.name,
        title: mockTenant.title,
        region: mockTenant.region,
        country: mockTenant.country,
        state: mockTenant.stateName,
        city: mockTenant.city,
        address: mockTenant.address,
        address2: mockTenant.address2,
        zip: mockTenant.zip,
        phone: mockTenant.phone,
        email: mockTenant.email,
        additionalInfo: mockTenant.additionalInfo,
        tenantProfileId: 'default-profile-id'
      });
    });

    it('should sync tenant update to ThingsBoard', async () => {
      await service.syncTenantToThingsBoard(mockTenant, 'update');

      expect(thingsBoardService.updateTenant).toHaveBeenCalledWith(mockTenant.id, {
        id: mockTenant.id,
        name: mockTenant.name,
        title: mockTenant.title,
        region: mockTenant.region,
        country: mockTenant.country,
        state: mockTenant.stateName,
        city: mockTenant.city,
        address: mockTenant.address,
        address2: mockTenant.address2,
        zip: mockTenant.zip,
        phone: mockTenant.phone,
        email: mockTenant.email,
        additionalInfo: mockTenant.additionalInfo,
        tenantProfileId: 'default-profile-id'
      });
    });

    it('should sync tenant deletion to ThingsBoard', async () => {
      await service.syncTenantToThingsBoard(mockTenant, 'delete');

      expect(thingsBoardService.deleteTenant).toHaveBeenCalledWith(mockTenant.id);
    });

    it('should handle sync errors gracefully', async () => {
      thingsBoardService.createTenant.mockRejectedValue(new Error('Sync failed'));

      await service.syncTenantToThingsBoard(mockTenant, 'create');

      expect(eventEmitter.emit).toHaveBeenCalledWith('tenantSyncFailed', {
        tenant: mockTenant,
        operation: 'create',
        error: expect.any(Error)
      });
    });
  });

  describe('Full Sync Operations', () => {
    it('should sync all tenants from NPL to ThingsBoard', async () => {
      nplEngineService.getAllTenants.mockResolvedValue([mockTenant]);
      thingsBoardService.getAllTenants.mockResolvedValue([]);

      await service.syncAllTenantsFromNplToThingsBoard();

      expect(thingsBoardService.createTenant).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockTenant.id })
      );
    });

    it('should update existing tenants in ThingsBoard', async () => {
      const updatedTenant = { ...mockTenant, name: 'Updated Tenant' };
      nplEngineService.getAllTenants.mockResolvedValue([updatedTenant]);
      thingsBoardService.getAllTenants.mockResolvedValue([mockThingsBoardTenant]);

      await service.syncAllTenantsFromNplToThingsBoard();

      expect(thingsBoardService.updateTenant).toHaveBeenCalledWith(
        updatedTenant.id,
        expect.objectContaining({ name: 'Updated Tenant' })
      );
    });

    it('should delete tenants from ThingsBoard that no longer exist in NPL', async () => {
      nplEngineService.getAllTenants.mockResolvedValue([]);
      thingsBoardService.getAllTenants.mockResolvedValue([mockThingsBoardTenant]);

      await service.syncAllTenantsFromNplToThingsBoard();

      expect(thingsBoardService.deleteTenant).toHaveBeenCalledWith(mockTenant.id);
    });

    it('should sync all tenants from ThingsBoard to NPL', async () => {
      thingsBoardService.getAllTenants.mockResolvedValue([mockThingsBoardTenant]);

      await service.syncAllTenantsFromThingsBoardToNpl();

      expect(nplEngineService.createTenant).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockTenant.id })
      );
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk import sync', async () => {
      nplEngineService.getAllTenants.mockResolvedValue([mockTenant]);
      thingsBoardService.getAllTenants.mockResolvedValue([]);

      // Simulate bulk import event
      const bulkImportData = { importedCount: 1, failedCount: 0 };
      await service['handleBulkImportSync'](bulkImportData);

      expect(thingsBoardService.createTenant).toHaveBeenCalled();
    });

    it('should handle bulk delete sync', async () => {
      const bulkDeleteData = { deletedCount: 5 };
      await service['handleBulkDeleteSync'](bulkDeleteData);

      // Should just log the event, individual deletes are handled separately
      expect(thingsBoardService.deleteTenant).not.toHaveBeenCalled();
    });
  });

  describe('Data Conversion', () => {
    it('should convert NPL limits to ThingsBoard profile ID', () => {
      const limits = { maxUsers: 100, maxDevices: 1000, maxAssets: 500, maxCustomers: 50 };
      const profileId = service['convertLimitsToProfileId'](limits);
      expect(profileId).toBe('default-profile-id');
    });

    it('should convert ThingsBoard profile ID to NPL limits', () => {
      const profileId = 'premium-profile-id';
      const limits = service['convertProfileIdToLimits'](profileId);
      expect(limits).toEqual({
        maxUsers: 200,
        maxDevices: 2000,
        maxAssets: 1000,
        maxCustomers: 100
      });
    });

    it('should convert ThingsBoard tenant to NPL format', () => {
      const nplTenant = service['convertThingsBoardToNpl'](mockThingsBoardTenant);
      expect(nplTenant).toEqual({
        id: mockTenant.id,
        name: mockTenant.name,
        title: mockTenant.title,
        region: mockTenant.region,
        country: mockTenant.country,
        stateName: mockThingsBoardTenant.state,
        city: mockTenant.city,
        address: mockTenant.address,
        address2: mockTenant.address2,
        zip: mockTenant.zip,
        phone: mockTenant.phone,
        email: mockTenant.email,
        limits: expect.any(Object),
        createdTime: expect.any(String),
        additionalInfo: mockTenant.additionalInfo
      });
    });
  });

  describe('Sync Status', () => {
    it('should return sync status', async () => {
      nplEngineService.getTenantCount.mockResolvedValue(5);
      thingsBoardService.getTenantCount.mockResolvedValue(5);

      const status = await service.getSyncStatus();

      expect(status).toEqual({
        nplTenantCount: 5,
        thingsBoardTenantCount: 5,
        syncInProgress: false,
        lastSyncTime: expect.any(String)
      });
    });

    it('should handle sync status errors', async () => {
      nplEngineService.getTenantCount.mockRejectedValue(new Error('Service unavailable'));

      const status = await service.getSyncStatus();

      expect(status).toEqual({
        nplTenantCount: 0,
        thingsBoardTenantCount: 0,
        syncInProgress: false,
        lastSyncTime: null,
        error: 'Service unavailable'
      });
    });
  });

  describe('Tenant Comparison', () => {
    it('should detect when tenants differ', () => {
      const differentTenant = { ...mockThingsBoardTenant, name: 'Different Name' };
      const differs = service['tenantsDiffer'](mockTenant, differentTenant);
      expect(differs).toBe(true);
    });

    it('should detect when tenants are the same', () => {
      const sameTenant = { ...mockThingsBoardTenant, state: mockTenant.stateName };
      const differs = service['tenantsDiffer'](mockTenant, sameTenant);
      expect(differs).toBe(false);
    });
  });

  describe('Force Sync', () => {
    it('should force sync all tenants', async () => {
      nplEngineService.getAllTenants.mockResolvedValue([mockTenant]);
      thingsBoardService.getAllTenants.mockResolvedValue([]);

      await service.forceSync();

      expect(thingsBoardService.createTenant).toHaveBeenCalled();
    });
  });
}); 