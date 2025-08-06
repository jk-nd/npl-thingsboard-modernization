import { Injectable, Logger } from '@nestjs/common';
import { NplEngineService } from './npl-engine.service';
import { ThingsBoardService } from './thingsboard.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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

@Injectable()
export class TenantSyncService {
  private readonly logger = new Logger(TenantSyncService.name);
  private syncInProgress = false;

  constructor(
    private readonly nplEngineService: NplEngineService,
    private readonly thingsBoardService: ThingsBoardService,
    private readonly eventEmitter: EventEmitter2
  ) {
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
      this.logger.warn('Sync already in progress, skipping');
      return;
    }

    try {
      this.syncInProgress = true;
      this.logger.log(`Syncing tenant ${tenant.id} to ThingsBoard (${operation})`);

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

      this.logger.log(`Successfully synced tenant ${tenant.id} to ThingsBoard`);
    } catch (error) {
      this.logger.error(`Failed to sync tenant ${tenant.id} to ThingsBoard:`, error);
      // Emit sync failure event for retry mechanism
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
      // Convert NPL limits to ThingsBoard format
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
   * Delete tenant in ThingsBoard
   */
  private async deleteTenantInThingsBoard(tenantId: string) {
    await this.thingsBoardService.deleteTenant(tenantId);
  }

  /**
   * Handle bulk import sync
   */
  private async handleBulkImportSync(data: { importedCount: number; failedCount: number }) {
    this.logger.log(`Bulk import completed: ${data.importedCount} imported, ${data.failedCount} failed`);
    
    // Trigger full sync to ensure all imported tenants are in ThingsBoard
    if (data.importedCount > 0) {
      await this.syncAllTenantsFromNplToThingsBoard();
    }
  }

  /**
   * Handle bulk delete sync
   */
  private async handleBulkDeleteSync(data: { deletedCount: number }) {
    this.logger.log(`Bulk delete completed: ${data.deletedCount} tenants deleted`);
    
    // The individual delete events will handle the sync
    // This is just for logging and monitoring
  }

  /**
   * Sync all tenants from NPL to ThingsBoard
   */
  async syncAllTenantsFromNplToThingsBoard() {
    try {
      this.logger.log('Starting full tenant sync from NPL to ThingsBoard');
      
      const nplTenants = await this.nplEngineService.getAllTenants();
      const thingsBoardTenants = await this.thingsBoardService.getAllTenants();
      
      // Create maps for efficient lookup
      const nplTenantMap = new Map(nplTenants.map(t => [t.id, t]));
      const thingsBoardTenantMap = new Map(thingsBoardTenants.map(t => [t.id, t]));
      
      // Find tenants that need to be created in ThingsBoard
      for (const nplTenant of nplTenants) {
        if (!thingsBoardTenantMap.has(nplTenant.id)) {
          await this.createTenantInThingsBoard(nplTenant);
        }
      }
      
      // Find tenants that need to be updated in ThingsBoard
      for (const nplTenant of nplTenants) {
        const thingsBoardTenant = thingsBoardTenantMap.get(nplTenant.id);
        if (thingsBoardTenant && this.tenantsDiffer(nplTenant, thingsBoardTenant)) {
          await this.updateTenantInThingsBoard(nplTenant);
        }
      }
      
      // Find tenants that need to be deleted from ThingsBoard
      for (const thingsBoardTenant of thingsBoardTenants) {
        if (!nplTenantMap.has(thingsBoardTenant.id)) {
          await this.deleteTenantInThingsBoard(thingsBoardTenant.id);
        }
      }
      
      this.logger.log('Full tenant sync completed');
    } catch (error) {
      this.logger.error('Failed to sync all tenants:', error);
    }
  }

  /**
   * Sync all tenants from ThingsBoard to NPL
   */
  async syncAllTenantsFromThingsBoardToNpl() {
    try {
      this.logger.log('Starting full tenant sync from ThingsBoard to NPL');
      
      const thingsBoardTenants = await this.thingsBoardService.getAllTenants();
      
      for (const thingsBoardTenant of thingsBoardTenants) {
        const nplTenant = this.convertThingsBoardToNpl(thingsBoardTenant);
        await this.nplEngineService.createTenant(nplTenant);
      }
      
      this.logger.log('Full tenant sync from ThingsBoard to NPL completed');
    } catch (error) {
      this.logger.error('Failed to sync tenants from ThingsBoard to NPL:', error);
    }
  }

  /**
   * Convert ThingsBoard tenant to NPL format
   */
  private convertThingsBoardToNpl(thingsBoardTenant: any): TenantData {
    return {
      id: thingsBoardTenant.id,
      name: thingsBoardTenant.name,
      title: thingsBoardTenant.title || '',
      region: thingsBoardTenant.region || '',
      country: thingsBoardTenant.country || '',
      stateName: thingsBoardTenant.state || '',
      city: thingsBoardTenant.city || '',
      address: thingsBoardTenant.address || '',
      address2: thingsBoardTenant.address2 || '',
      zip: thingsBoardTenant.zip || '',
      phone: thingsBoardTenant.phone || '',
      email: thingsBoardTenant.email || '',
      limits: this.convertProfileIdToLimits(thingsBoardTenant.tenantProfileId),
      createdTime: thingsBoardTenant.createdTime || new Date().toISOString(),
      additionalInfo: thingsBoardTenant.additionalInfo || '{}'
    };
  }

  /**
   * Convert NPL limits to ThingsBoard profile ID
   */
  private convertLimitsToProfileId(limits: any): string {
    // This is a simplified conversion - in practice, you'd have a mapping
    // between NPL limits and ThingsBoard tenant profiles
    const profileMap = {
      '100-1000-500-50': 'default-profile-id',
      '200-2000-1000-100': 'premium-profile-id',
      '500-5000-2500-250': 'enterprise-profile-id'
    };
    
    const key = `${limits.maxUsers}-${limits.maxDevices}-${limits.maxAssets}-${limits.maxCustomers}`;
    return profileMap[key] || 'default-profile-id';
  }

  /**
   * Convert ThingsBoard profile ID to NPL limits
   */
  private convertProfileIdToLimits(profileId: string): any {
    // This is a simplified conversion - in practice, you'd have a mapping
    const limitsMap = {
      'default-profile-id': { maxUsers: 100, maxDevices: 1000, maxAssets: 500, maxCustomers: 50 },
      'premium-profile-id': { maxUsers: 200, maxDevices: 2000, maxAssets: 1000, maxCustomers: 100 },
      'enterprise-profile-id': { maxUsers: 500, maxDevices: 5000, maxAssets: 2500, maxCustomers: 250 }
    };
    
    return limitsMap[profileId] || limitsMap['default-profile-id'];
  }

  /**
   * Check if two tenants differ
   */
  private tenantsDiffer(nplTenant: TenantData, thingsBoardTenant: any): boolean {
    return (
      nplTenant.name !== thingsBoardTenant.name ||
      nplTenant.title !== thingsBoardTenant.title ||
      nplTenant.region !== thingsBoardTenant.region ||
      nplTenant.country !== thingsBoardTenant.country ||
      nplTenant.stateName !== thingsBoardTenant.state ||
      nplTenant.city !== thingsBoardTenant.city ||
      nplTenant.address !== thingsBoardTenant.address ||
      nplTenant.address2 !== thingsBoardTenant.address2 ||
      nplTenant.zip !== thingsBoardTenant.zip ||
      nplTenant.phone !== thingsBoardTenant.phone ||
      nplTenant.email !== thingsBoardTenant.email
    );
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
      this.logger.error('Failed to get sync status:', error);
      return {
        nplTenantCount: 0,
        thingsBoardTenantCount: 0,
        syncInProgress: this.syncInProgress,
        lastSyncTime: null,
        error: error.message
      };
    }
  }

  /**
   * Force sync all tenants
   */
  async forceSync() {
    this.logger.log('Force syncing all tenants');
    await this.syncAllTenantsFromNplToThingsBoard();
  }
} 