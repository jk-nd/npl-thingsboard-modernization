import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { TenantSyncService, TenantData, NplEngineService, ThingsBoardService } from '../services/tenant-sync.service';

describe('TenantSyncService', () => {
  let service: TenantSyncService;
  let mockNplEngineService: jest.Mocked<NplEngineService>;
  let mockThingsBoardService: jest.Mocked<ThingsBoardService>;
  let eventEmitter: EventEmitter;

  const mockTenant: TenantData = {
    id: 'tenant-123',
    name: 'Test Tenant',
    title: 'Test Tenant',
    region: 'Global',
    country: 'USA',
    stateName: 'CA',
    city: 'San Francisco',
    address: '123 Test St',
    address2: 'Apt 4B',
    zip: '94105',
    phone: '555-555-5555',
    email: 'test@test.com',
    limits: {
      maxUsers: 10,
      maxDevices: 100,
      maxAssets: 50,
      maxCustomers: 5
    },
    createdTime: new Date().toISOString(),
    additionalInfo: '{}'
  };

  beforeEach(() => {
    mockNplEngineService = {
      getAllTenants: jest.fn(),
      getTenantCount: jest.fn(),
      createTenant: jest.fn(),
    };

    mockThingsBoardService = {
      getAllTenants: jest.fn(),
      getTenantCount: jest.fn(),
      createTenant: jest.fn(),
      updateTenant: jest.fn(),
      deleteTenant: jest.fn(),
    };
    
    service = new TenantSyncService(mockNplEngineService, mockThingsBoardService);
    eventEmitter = service.getEventEmitter(); // Get the actual event emitter from the service
  });

  test('should create a new tenant in ThingsBoard when tenantCreated is emitted', async () => {
    mockThingsBoardService.createTenant.mockResolvedValue(mockTenant);
    
    eventEmitter.emit('tenantCreated', mockTenant);

    // Allow event loop to process the async handler
    await new Promise(process.nextTick);

    expect(mockThingsBoardService.createTenant).toHaveBeenCalledWith(expect.any(Object));
  });
  
  test('should update an existing tenant in ThingsBoard when tenantUpdated is emitted', async () => {
    mockThingsBoardService.updateTenant.mockResolvedValue(mockTenant);

    eventEmitter.emit('tenantUpdated', mockTenant);

    await new Promise(process.nextTick);

    expect(mockThingsBoardService.updateTenant).toHaveBeenCalledWith(mockTenant.id, expect.any(Object));
  });

  test('should delete a tenant from ThingsBoard when tenantDeleted is emitted', async () => {
    mockThingsBoardService.deleteTenant.mockResolvedValue(undefined);

    eventEmitter.emit('tenantDeleted', mockTenant);

    await new Promise(process.nextTick);

    expect(mockThingsBoardService.deleteTenant).toHaveBeenCalledWith(mockTenant.id);
  });
});
