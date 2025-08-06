import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { DeviceSyncService, DeviceData, NplEngineService, ThingsBoardService } from '../services/device-sync.service';

describe('DeviceSyncService', () => {
  let service: DeviceSyncService;
  let mockNplEngineService: jest.Mocked<NplEngineService>;
  let mockThingsBoardService: jest.Mocked<ThingsBoardService>;
  let eventEmitter: EventEmitter;

  const mockDevice: DeviceData = {
    id: 'device-123',
    name: 'Test Device',
    type: 'default',
    tenantId: 'tenant-123',
    credentials: 'test-credentials'
  };

  beforeEach(() => {
    mockNplEngineService = {
      getAllDevices: jest.fn(),
      getDeviceCount: jest.fn(),
      createDevice: jest.fn(),
    };

    mockThingsBoardService = {
      getAllDevices: jest.fn(),
      getDeviceCount: jest.fn(),
      createDevice: jest.fn(),
      updateDevice: jest.fn(),
      deleteDevice: jest.fn(),
    };
    
    service = new DeviceSyncService(mockNplEngineService, mockThingsBoardService);
    eventEmitter = service.getEventEmitter();
  });

  test('should sync device creation to ThingsBoard when deviceSaved is emitted', async () => {
    mockThingsBoardService.createDevice.mockResolvedValue(mockDevice);
    
    eventEmitter.emit('deviceSaved', mockDevice);

    await new Promise(process.nextTick);

    expect(mockThingsBoardService.createDevice).toHaveBeenCalledWith(expect.any(Object));
  });
  
  test('should sync device deletion to ThingsBoard when deviceDeleted is emitted', async () => {
    mockThingsBoardService.deleteDevice.mockResolvedValue(undefined);

    eventEmitter.emit('deviceDeleted', mockDevice.id);

    await new Promise(process.nextTick);

    expect(mockThingsBoardService.deleteDevice).toHaveBeenCalledWith(mockDevice.id);
  });

  test('should handle device assignment when deviceAssigned is emitted', async () => {
    const assignmentData = { deviceId: 'device-123', customerId: 'customer-456' };
    mockNplEngineService.getAllDevices.mockResolvedValue([mockDevice]);
    mockThingsBoardService.updateDevice.mockResolvedValue(mockDevice);
    
    eventEmitter.emit('deviceAssigned', assignmentData);

    await new Promise(process.nextTick);

    expect(mockThingsBoardService.updateDevice).toHaveBeenCalledWith(assignmentData.deviceId, expect.objectContaining({ customerId: assignmentData.customerId }));
  });
});
