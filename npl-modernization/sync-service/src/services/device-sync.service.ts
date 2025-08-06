import { EventEmitter } from 'events';

export interface DeviceData {
  id: string;
  name: string;
  type: string;
  tenantId: string;
  customerId?: string;
  credentials: string;
  label?: string;
  deviceProfileId?: string;
  firmwareId?: string;
  softwareId?: string;
  externalId?: string;
  version?: number;
  additionalInfo?: string;
  createdTime?: number;
  deviceData?: string;
}

export interface DeviceInfo {
  device: DeviceData;
  deviceProfileName: string;
}

export interface NplEngineService {
  getAllDevices(): Promise<DeviceData[]>;
  getDeviceCount(): Promise<number>;
  createDevice(device: DeviceData): Promise<DeviceData>;
}

export interface ThingsBoardService {
  getAllDevices(): Promise<any[]>;
  getDeviceCount(): Promise<number>;
  createDevice(device: any): Promise<any>;
  updateDevice(id: string, device: any): Promise<any>;
  deleteDevice(id: string): Promise<void>;
}

export class DeviceSyncService {
  private syncInProgress = false;
  private eventEmitter: EventEmitter;

  constructor(
    private readonly nplEngineService: NplEngineService,
    private readonly thingsBoardService: ThingsBoardService
  ) {
    this.eventEmitter = new EventEmitter();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for NPL notifications
   */
  private setupEventListeners() {
    // Listen for NPL device events
    this.eventEmitter.on('deviceSaved', (device: DeviceData) => {
      this.syncDeviceToThingsBoard(device, 'create');
    });

    this.eventEmitter.on('deviceDeleted', (deviceId: string) => {
      this.syncDeviceToThingsBoard({ id: deviceId } as DeviceData, 'delete');
    });

    this.eventEmitter.on('deviceAssigned', (data: { deviceId: string; customerId: string }) => {
      this.handleDeviceAssignmentSync(data);
    });

    this.eventEmitter.on('deviceUnassigned', (deviceId: string) => {
      this.handleDeviceUnassignmentSync(deviceId);
    });

    this.eventEmitter.on('devicesBulkImported', (data: { importedCount: number; failedCount: number }) => {
      this.handleBulkImportSync(data);
    });

    this.eventEmitter.on('devicesBulkDeleted', (data: { deletedCount: number; failedCount: number }) => {
      this.handleBulkDeleteSync(data);
    });
  }

  /**
   * Sync device from NPL to ThingsBoard
   */
  async syncDeviceToThingsBoard(device: DeviceData, operation: 'create' | 'update' | 'delete') {
    if (this.syncInProgress) {
      console.warn('Sync already in progress, skipping');
      return;
    }

    try {
      this.syncInProgress = true;
      console.log(`Syncing device ${device.id} to ThingsBoard (${operation})`);

      switch (operation) {
        case 'create':
          await this.createDeviceInThingsBoard(device);
          break;
        case 'update':
          await this.updateDeviceInThingsBoard(device);
          break;
        case 'delete':
          await this.deleteDeviceInThingsBoard(device.id);
          break;
      }

      console.log(`Successfully synced device ${device.id} to ThingsBoard`);
    } catch (error) {
      console.error(`Failed to sync device ${device.id} to ThingsBoard:`, error);
      this.eventEmitter.emit('deviceSyncFailed', { device, operation, error });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Create device in ThingsBoard
   */
  private async createDeviceInThingsBoard(device: DeviceData) {
    const thingsBoardDevice = {
      id: device.id,
      name: device.name,
      type: device.type,
      tenantId: device.tenantId,
      customerId: device.customerId,
      credentials: device.credentials,
      label: device.label,
      deviceProfileId: device.deviceProfileId,
      firmwareId: device.firmwareId,
      softwareId: device.softwareId,
      externalId: device.externalId,
      version: device.version,
      additionalInfo: device.additionalInfo,
      createdTime: device.createdTime,
      deviceData: device.deviceData
    };

    await this.thingsBoardService.createDevice(thingsBoardDevice);
  }

  /**
   * Update device in ThingsBoard
   */
  private async updateDeviceInThingsBoard(device: DeviceData) {
    const thingsBoardDevice = {
      id: device.id,
      name: device.name,
      type: device.type,
      tenantId: device.tenantId,
      customerId: device.customerId,
      credentials: device.credentials,
      label: device.label,
      deviceProfileId: device.deviceProfileId,
      firmwareId: device.firmwareId,
      softwareId: device.softwareId,
      externalId: device.externalId,
      version: device.version,
      additionalInfo: device.additionalInfo,
      createdTime: device.createdTime,
      deviceData: device.deviceData
    };

    await this.thingsBoardService.updateDevice(device.id, thingsBoardDevice);
  }

  /**
   * Delete device from ThingsBoard
   */
  private async deleteDeviceInThingsBoard(deviceId: string) {
    await this.thingsBoardService.deleteDevice(deviceId);
  }

  /**
   * Handle device assignment sync
   */
  private async handleDeviceAssignmentSync(data: { deviceId: string; customerId: string }) {
    console.log(`Device ${data.deviceId} assigned to customer ${data.customerId}`);
    
    // Update device in ThingsBoard with new customer assignment
    const device = await this.nplEngineService.getAllDevices().then(devices => 
      devices.find(d => d.id === data.deviceId)
    );
    
    if (device) {
      device.customerId = data.customerId;
      await this.updateDeviceInThingsBoard(device);
    }
  }

  /**
   * Handle device unassignment sync
   */
  private async handleDeviceUnassignmentSync(deviceId: string) {
    console.log(`Device ${deviceId} unassigned from customer`);
    
    // Update device in ThingsBoard to remove customer assignment
    const device = await this.nplEngineService.getAllDevices().then(devices => 
      devices.find(d => d.id === deviceId)
    );
    
    if (device) {
      device.customerId = undefined as any;
      await this.updateDeviceInThingsBoard(device);
    }
  }

  /**
   * Handle bulk import sync
   */
  private async handleBulkImportSync(data: { importedCount: number; failedCount: number }) {
    console.log(`Bulk import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
    
    // Sync all devices from NPL to ThingsBoard
    await this.syncAllDevicesFromNplToThingsBoard();
  }

  /**
   * Handle bulk delete sync
   */
  private async handleBulkDeleteSync(data: { deletedCount: number; failedCount: number }) {
    console.log(`Bulk delete completed: ${data.deletedCount} deleted, ${data.failedCount} failed`);
  }

  /**
   * Sync all devices from NPL to ThingsBoard
   */
  async syncAllDevicesFromNplToThingsBoard() {
    try {
      const nplDevices = await this.nplEngineService.getAllDevices();
      const thingsBoardDevices = await this.thingsBoardService.getAllDevices();

      // Create new devices
      for (const nplDevice of nplDevices) {
        const existingDevice = thingsBoardDevices.find(tb => tb.id === nplDevice.id);
        if (!existingDevice) {
          await this.createDeviceInThingsBoard(nplDevice);
        } else if (this.devicesDiffer(nplDevice, existingDevice)) {
          await this.updateDeviceInThingsBoard(nplDevice);
        }
      }

      // Delete devices that no longer exist in NPL
      for (const thingsBoardDevice of thingsBoardDevices) {
        const nplDevice = nplDevices.find(npl => npl.id === thingsBoardDevice.id);
        if (!nplDevice) {
          await this.deleteDeviceInThingsBoard(thingsBoardDevice.id);
        }
      }

      console.log('Full sync from NPL to ThingsBoard completed');
    } catch (error) {
      console.error('Failed to sync all devices from NPL to ThingsBoard:', error);
    }
  }

  /**
   * Sync all devices from ThingsBoard to NPL
   */
  async syncAllDevicesFromThingsBoardToNpl() {
    try {
      const thingsBoardDevices = await this.thingsBoardService.getAllDevices();

      for (const thingsBoardDevice of thingsBoardDevices) {
        const nplDevice = this.convertThingsBoardToNpl(thingsBoardDevice);
        await this.nplEngineService.createDevice(nplDevice);
      }

      console.log('Full sync from ThingsBoard to NPL completed');
    } catch (error) {
      console.error('Failed to sync all devices from ThingsBoard to NPL:', error);
    }
  }

  /**
   * Convert ThingsBoard device to NPL format
   */
  private convertThingsBoardToNpl(thingsBoardDevice: any): DeviceData {
    return {
      id: thingsBoardDevice.id,
      name: thingsBoardDevice.name,
      type: thingsBoardDevice.type,
      tenantId: thingsBoardDevice.tenantId,
      customerId: thingsBoardDevice.customerId,
      credentials: thingsBoardDevice.credentials,
      label: thingsBoardDevice.label,
      deviceProfileId: thingsBoardDevice.deviceProfileId,
      firmwareId: thingsBoardDevice.firmwareId,
      softwareId: thingsBoardDevice.softwareId,
      externalId: thingsBoardDevice.externalId,
      version: thingsBoardDevice.version,
      additionalInfo: thingsBoardDevice.additionalInfo,
      createdTime: thingsBoardDevice.createdTime,
      deviceData: thingsBoardDevice.deviceData
    };
  }

  /**
   * Check if devices differ
   */
  private devicesDiffer(nplDevice: DeviceData, thingsBoardDevice: any): boolean {
    return nplDevice.name !== thingsBoardDevice.name ||
           nplDevice.type !== thingsBoardDevice.type ||
           nplDevice.tenantId !== thingsBoardDevice.tenantId ||
           nplDevice.customerId !== thingsBoardDevice.customerId ||
           nplDevice.credentials !== thingsBoardDevice.credentials ||
           nplDevice.label !== thingsBoardDevice.label ||
           nplDevice.deviceProfileId !== thingsBoardDevice.deviceProfileId ||
           nplDevice.firmwareId !== thingsBoardDevice.firmwareId ||
           nplDevice.softwareId !== thingsBoardDevice.softwareId ||
           nplDevice.externalId !== thingsBoardDevice.externalId ||
           nplDevice.version !== thingsBoardDevice.version ||
           nplDevice.additionalInfo !== thingsBoardDevice.additionalInfo;
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      const nplDeviceCount = await this.nplEngineService.getDeviceCount();
      const thingsBoardDeviceCount = await this.thingsBoardService.getDeviceCount();

      return {
        nplDeviceCount,
        thingsBoardDeviceCount,
        syncInProgress: this.syncInProgress,
        lastSyncTime: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        nplDeviceCount: 0,
        thingsBoardDeviceCount: 0,
        syncInProgress: this.syncInProgress,
        lastSyncTime: null,
        error: (error as Error).message
      };
    }
  }

  /**
   * Force sync all devices
   */
  async forceSync() {
    try {
      await this.syncAllDevicesFromNplToThingsBoard();
      return { success: true, message: 'Sync completed successfully' };
    } catch (error) {
      console.error('Force sync failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get event emitter for external access
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
} 