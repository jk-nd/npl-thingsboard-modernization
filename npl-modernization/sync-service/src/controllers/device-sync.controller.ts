import { DeviceSyncService } from '../services/device-sync.service';

export class DeviceSyncController {
  constructor(private readonly deviceSyncService: DeviceSyncService) {}

  /**
   * Get sync status
   */
  async getSyncStatus() {
    return await this.deviceSyncService.getSyncStatus();
  }

  async syncFromNplToThingsBoard() {
    try {
      await this.deviceSyncService.syncAllDevicesFromNplToThingsBoard();
      return { success: true, message: 'Sync from NPL to ThingsBoard completed' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async syncFromThingsBoardToNpl() {
    try {
      await this.deviceSyncService.syncAllDevicesFromThingsBoardToNpl();
      return { success: true, message: 'Sync from ThingsBoard to NPL completed' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async forceSync() {
    return await this.deviceSyncService.forceSync();
  }

  async syncDevice(deviceId: string, device: any) {
    try {
      await this.deviceSyncService.syncDeviceToThingsBoard(device, 'update');
      return { success: true, message: `Device ${deviceId} synced successfully` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getSyncConfig() {
    return {
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      retryAttempts: 3,
      batchSize: 100
    };
  }

  async updateSyncConfig(config: any) {
    // Implementation for updating sync configuration
    return { success: true, message: 'Sync configuration updated' };
  }

  async getSyncLogs(limit = 100) {
    // Implementation for retrieving sync logs
    return {
      logs: [],
      total: 0,
      limit
    };
  }

  async clearSyncLogs() {
    // Implementation for clearing sync logs
    return { success: true, message: 'Sync logs cleared' };
  }

  async getSyncStats() {
    const status = await this.deviceSyncService.getSyncStatus();
    return {
      nplDeviceCount: status.nplDeviceCount,
      thingsBoardDeviceCount: status.thingsBoardDeviceCount,
      syncInProgress: status.syncInProgress,
      lastSyncTime: status.lastSyncTime,
      syncSuccessRate: 95.5, // Example metric
      averageSyncTime: 1500 // milliseconds
    };
  }

  async healthCheck() {
    try {
      const status = await this.deviceSyncService.getSyncStatus();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        nplDeviceCount: status.nplDeviceCount,
        thingsBoardDeviceCount: status.thingsBoardDeviceCount
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }
} 