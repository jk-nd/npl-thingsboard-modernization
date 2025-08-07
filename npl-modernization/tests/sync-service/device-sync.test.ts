import { DeviceSyncService, DeviceData, NplEngineService, ThingsBoardService } from '../../sync-service/src/services/device-sync.service';
import { expect, jest, describe, beforeEach, test } from '@jest/globals';

describe('DeviceSyncService', () => {
  let deviceSyncService: DeviceSyncService;
  let mockNplEngineService: NplEngineService;
  let mockThingsBoardService: ThingsBoardService;

  const mockDevice: DeviceData = {
    id: 'device-123',
    name: 'Test Device',
    type: 'default',
    tenantId: 'tenant-123',
    credentials: 'test-token',
    createdTime: Date.now()
  };

  beforeEach(() => {
    mockNplEngineService = {
      getAllDevices: jest.fn(async () => [mockDevice]),
      getDeviceCount: jest.fn(async () => 1),
      createDevice: jest.fn(async (d: DeviceData) => d)
    };

    mockThingsBoardService = {
      getAllDevices: jest.fn(async () => []),
      getDeviceCount: jest.fn(async () => 0),
      createDevice: jest.fn(async (dev: any) => dev),
      updateDevice: jest.fn(async (id: string, dev: any) => dev),
      deleteDevice: jest.fn(async (id: string) => {})
    };

    deviceSyncService = new DeviceSyncService(mockNplEngineService, mockThingsBoardService);
  });

  test('syncs device creation to ThingsBoard', async () => {
    await deviceSyncService.syncDeviceToThingsBoard(mockDevice, 'create');
    expect(mockThingsBoardService.createDevice).toHaveBeenCalledWith(expect.objectContaining({ id: mockDevice.id, name: mockDevice.name }));
  });

  test('syncs device update to ThingsBoard', async () => {
    await deviceSyncService.syncDeviceToThingsBoard(mockDevice, 'update');
    expect(mockThingsBoardService.updateDevice).toHaveBeenCalledWith(mockDevice.id, expect.objectContaining({ id: mockDevice.id }));
  });

  test('syncs device deletion to ThingsBoard', async () => {
    await deviceSyncService.syncDeviceToThingsBoard(mockDevice, 'delete');
    expect(mockThingsBoardService.deleteDevice).toHaveBeenCalledWith(mockDevice.id);
  });

  test('full sync creates missing devices in ThingsBoard', async () => {
    (mockThingsBoardService.getAllDevices as any).mockResolvedValueOnce([]);
    (mockNplEngineService.getAllDevices as any).mockResolvedValueOnce([mockDevice]);

    await deviceSyncService.syncAllDevicesFromNplToThingsBoard();

    expect(mockThingsBoardService.createDevice).toHaveBeenCalledWith(expect.objectContaining({ id: mockDevice.id }));
  });

  test('getSyncStatus returns both counts and status', async () => {
    const status = await deviceSyncService.getSyncStatus();
    expect(status).toEqual(expect.objectContaining({ nplDeviceCount: 1, thingsBoardDeviceCount: 0, syncInProgress: false }));
  });
});