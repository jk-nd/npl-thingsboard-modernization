import { EventEmitter } from 'events';

export interface TenantData {
  id: string;
  name: string;
  title: string;
  region: string;
  country: string;
  stateName: string;
  city: string;
  address: string;
  address2: string;
  zip: string;
  phone: string;
  email: string;
  limits: {
    maxUsers: number;
    maxDevices: number;
    maxAssets: number;
    maxCustomers: number;
  };
  createdTime: string;
  additionalInfo: string;
}

export interface TenantInfo {
  tenant: TenantData;
  tenantProfileName: string;
}

export interface NplEngineService {
  getAllTenants(): Promise<TenantData[]>;
  getTenantCount(): Promise<number>;
  createTenant(tenant: TenantData): Promise<TenantData>;
}

export interface ThingsBoardService {
  getAllTenants(): Promise<any[]>;
  getTenantCount(): Promise<number>;
  createTenant(tenant: any): Promise<any>;
  updateTenant(id: string, tenant: any): Promise<any>;
  deleteTenant(id: string): Promise<void>;
}

export class TenantSyncService {
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
    // Listen for NPL tenant events
    this.eventEmitter.on('tenantCreated', (tenant: TenantData) => {
      this.syncTenantToThingsBoard(tenant, 'create');
    });

    this.eventEmitter.on('tenantUpdated', (tenant: TenantData) => {
      this.syncTenantToThingsBoard(tenant, 'update');
    });

    this.eventEmitter.on('tenantDeleted', (tenant: TenantData) => {
      this.syncTenantToThingsBoard(tenant, 'delete');
    });

    this.eventEmitter.on('tenantsBulkImported', (data: { importedCount: number; failedCount: number }) => {
      this.handleBulkImportSync(data);
    });

    this.eventEmitter.on('tenantsBulkDeleted', (data: { deletedCount: number }) => {
      this.handleBulkDeleteSync(data);
    });
  }

  /**
   * Sync tenant from NPL to ThingsBoard
   */
  async syncTenantToThingsBoard(tenant: TenantData, operation: 'create' | 'update' | 'delete') {
    if (this.syncInProgress) {
      console.warn('Sync already in progress, skipping');
      return;
    }

    try {
      this.syncInProgress = true;
      console.log(`Syncing tenant ${tenant.id} to ThingsBoard (${operation})`);

      switch (operation) {
        case 'create':
          await this.createTenantInThingsBoard(tenant);
          break;
        case 'update':
          await this.updateTenantInThingsBoard(tenant);
          break;
        case 'delete':
          await this.deleteTenantInThingsBoard(tenant.id);
          break;
      }

      console.log(`Successfully synced tenant ${tenant.id} to ThingsBoard`);
    } catch (error) {
      console.error(`Failed to sync tenant ${tenant.id} to ThingsBoard:`, error);
      this.eventEmitter.emit('tenantSyncFailed', { tenant, operation, error });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Create tenant in ThingsBoard
   */
  private async createTenantInThingsBoard(tenant: TenantData) {
    const thingsBoardTenant = {
      id: tenant.id,
      name: tenant.name,
      title: tenant.title,
      region: tenant.region,
      country: tenant.country,
      state: tenant.stateName,
      city: tenant.city,
      address: tenant.address,
      address2: tenant.address2,
      zip: tenant.zip,
      phone: tenant.phone,
      email: tenant.email,
      additionalInfo: tenant.additionalInfo,
      tenantProfileId: this.convertLimitsToProfileId(tenant.limits)
    };

    await this.thingsBoardService.createTenant(thingsBoardTenant);
  }

  /**
   * Update tenant in ThingsBoard
   */
  private async updateTenantInThingsBoard(tenant: TenantData) {
    const thingsBoardTenant = {
      id: tenant.id,
      name: tenant.name,
      title: tenant.title,
      region: tenant.region,
      country: tenant.country,
      state: tenant.stateName,
      city: tenant.city,
      address: tenant.address,
      address2: tenant.address2,
      zip: tenant.zip,
      phone: tenant.phone,
      email: tenant.email,
      additionalInfo: tenant.additionalInfo,
      tenantProfileId: this.convertLimitsToProfileId(tenant.limits)
    };

    await this.thingsBoardService.updateTenant(tenant.id, thingsBoardTenant);
  }

  /**
   * Delete tenant from ThingsBoard
   */
  private async deleteTenantInThingsBoard(tenantId: string) {
    await this.thingsBoardService.deleteTenant(tenantId);
  }

  /**
   * Handle bulk import sync
   */
  private async handleBulkImportSync(data: { importedCount: number; failedCount: number }) {
    console.log(`Bulk import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
    
    // Sync all tenants from NPL to ThingsBoard
    await this.syncAllTenantsFromNplToThingsBoard();
  }

  /**
   * Handle bulk delete sync
   */
  private async handleBulkDeleteSync(data: { deletedCount: number }) {
    console.log(`Bulk delete completed: ${data.deletedCount} deleted`);
  }

  /**
   * Sync all tenants from NPL to ThingsBoard
   */
  async syncAllTenantsFromNplToThingsBoard() {
    try {
      const nplTenants = await this.nplEngineService.getAllTenants();
      const thingsBoardTenants = await this.thingsBoardService.getAllTenants();

      // Create new tenants
      for (const nplTenant of nplTenants) {
        const existingTenant = thingsBoardTenants.find(tb => tb.id === nplTenant.id);
        if (!existingTenant) {
          await this.createTenantInThingsBoard(nplTenant);
        } else if (this.tenantsDiffer(nplTenant, existingTenant)) {
          await this.updateTenantInThingsBoard(nplTenant);
        }
      }

      // Delete tenants that no longer exist in NPL
      for (const thingsBoardTenant of thingsBoardTenants) {
        const nplTenant = nplTenants.find(npl => npl.id === thingsBoardTenant.id);
        if (!nplTenant) {
          await this.deleteTenantInThingsBoard(thingsBoardTenant.id);
        }
      }

      console.log('Full sync from NPL to ThingsBoard completed');
    } catch (error) {
      console.error('Failed to sync all tenants from NPL to ThingsBoard:', error);
    }
  }

  /**
   * Sync all tenants from ThingsBoard to NPL
   */
  async syncAllTenantsFromThingsBoardToNpl() {
    try {
      const thingsBoardTenants = await this.thingsBoardService.getAllTenants();

      for (const thingsBoardTenant of thingsBoardTenants) {
        const nplTenant = this.convertThingsBoardToNpl(thingsBoardTenant);
        await this.nplEngineService.createTenant(nplTenant);
      }

      console.log('Full sync from ThingsBoard to NPL completed');
    } catch (error) {
      console.error('Failed to sync all tenants from ThingsBoard to NPL:', error);
    }
  }

  /**
   * Convert ThingsBoard tenant to NPL format
   */
  private convertThingsBoardToNpl(thingsBoardTenant: any): TenantData {
    return {
      id: thingsBoardTenant.id,
      name: thingsBoardTenant.name,
      title: thingsBoardTenant.title,
      region: thingsBoardTenant.region,
      country: thingsBoardTenant.country,
      stateName: thingsBoardTenant.state,
      city: thingsBoardTenant.city,
      address: thingsBoardTenant.address,
      address2: thingsBoardTenant.address2,
      zip: thingsBoardTenant.zip,
      phone: thingsBoardTenant.phone,
      email: thingsBoardTenant.email,
      limits: this.convertProfileIdToLimits(thingsBoardTenant.tenantProfileId),
      createdTime: thingsBoardTenant.createdTime || new Date().toISOString(),
      additionalInfo: thingsBoardTenant.additionalInfo || '{}'
    };
  }

  /**
   * Convert NPL limits to ThingsBoard profile ID
   */
  private convertLimitsToProfileId(limits: any): string {
    // Simple mapping - in production this would be more sophisticated
    if (limits.maxUsers >= 200) return 'premium-profile-id';
    if (limits.maxUsers >= 100) return 'standard-profile-id';
    return 'default-profile-id';
  }

  /**
   * Convert ThingsBoard profile ID to NPL limits
   */
  private convertProfileIdToLimits(profileId: string): any {
    // Simple mapping - in production this would be more sophisticated
    switch (profileId) {
      case 'premium-profile-id':
        return { maxUsers: 200, maxDevices: 2000, maxAssets: 1000, maxCustomers: 100 };
      case 'standard-profile-id':
        return { maxUsers: 100, maxDevices: 1000, maxAssets: 500, maxCustomers: 50 };
      default:
        return { maxUsers: 50, maxDevices: 500, maxAssets: 250, maxCustomers: 25 };
    }
  }

  /**
   * Check if tenants differ
   */
  private tenantsDiffer(nplTenant: TenantData, thingsBoardTenant: any): boolean {
    return nplTenant.name !== thingsBoardTenant.name ||
           nplTenant.title !== thingsBoardTenant.title ||
           nplTenant.region !== thingsBoardTenant.region ||
           nplTenant.country !== thingsBoardTenant.country ||
           nplTenant.stateName !== thingsBoardTenant.state ||
           nplTenant.city !== thingsBoardTenant.city ||
           nplTenant.address !== thingsBoardTenant.address ||
           nplTenant.phone !== thingsBoardTenant.phone ||
           nplTenant.email !== thingsBoardTenant.email;
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      const nplTenantCount = await this.nplEngineService.getTenantCount();
      const thingsBoardTenantCount = await this.thingsBoardService.getTenantCount();

      return {
        nplTenantCount,
        thingsBoardTenantCount,
        syncInProgress: this.syncInProgress,
        lastSyncTime: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        nplTenantCount: 0,
        thingsBoardTenantCount: 0,
        syncInProgress: this.syncInProgress,
        lastSyncTime: null,
        error: (error as Error).message
      };
    }
  }

  /**
   * Force sync all tenants
   */
  async forceSync() {
    try {
      await this.syncAllTenantsFromNplToThingsBoard();
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