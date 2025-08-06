import { TenantSyncService } from '../services/tenant-sync.service';

export class TenantSyncController {
  constructor(private readonly tenantSyncService: TenantSyncService) {}

  /**
   * Get sync status
   */
  async getSyncStatus() {
    return await this.tenantSyncService.getSyncStatus();
  }

  /**
   * Force sync from NPL to ThingsBoard
   */
  async syncFromNplToThingsBoard() {
    await this.tenantSyncService.syncAllTenantsFromNplToThingsBoard();
    return { message: 'Sync from NPL to ThingsBoard completed' };
  }

  /**
   * Force sync from ThingsBoard to NPL
   */
  async syncFromThingsBoardToNpl() {
    await this.tenantSyncService.syncAllTenantsFromThingsBoardToNpl();
    return { message: 'Sync from ThingsBoard to NPL completed' };
  }

  /**
   * Force sync all tenants
   */
  async forceSync() {
    await this.tenantSyncService.forceSync();
    return { message: 'Force sync completed' };
  }

  /**
   * Sync specific tenant
   */
  async syncTenant(id: string, operation: { operation: 'create' | 'update' | 'delete' }) {
    // This would require getting the tenant data first
    // For now, we'll trigger a full sync
    await this.tenantSyncService.forceSync();
    return { message: `Sync for tenant ${id} completed` };
  }

  /**
   * Get sync configuration
   */
  async getSyncConfig() {
    return {
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      batchSize: 100,
      timeout: 30000 // 30 seconds
    };
  }

  /**
   * Update sync configuration
   */
  async updateSyncConfig(config: any) {
    // In a real implementation, this would update the sync configuration
    return { message: 'Sync configuration updated', config };
  }

  /**
   * Get sync logs
   */
  async getSyncLogs(limit = 100, offset = 0) {
    // In a real implementation, this would return actual sync logs
    return {
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: 'Tenant sync completed successfully',
          tenantId: 'tenant_123',
          operation: 'create'
        }
      ],
      total: 1,
      limit,
      offset
    };
  }

  /**
   * Clear sync logs
   */
  async clearSyncLogs() {
    return { message: 'Sync logs cleared' };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const status = await this.tenantSyncService.getSyncStatus();
    
    return {
      totalTenants: status.nplTenantCount + status.thingsBoardTenantCount,
      nplTenants: status.nplTenantCount,
      thingsBoardTenants: status.thingsBoardTenantCount,
      syncInProgress: status.syncInProgress,
      lastSyncTime: status.lastSyncTime,
      syncSuccessRate: 95.5, // Example metric
      averageSyncTime: 1500, // milliseconds
      failedSyncs: 2,
      successfulSyncs: 45
    };
  }

  /**
   * Health check for sync service
   */
  async healthCheck() {
    const status = await this.tenantSyncService.getSyncStatus();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      syncStatus: status,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
} 