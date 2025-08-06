import { Injectable } from '@nestjs/common';
import { NplReadModelService } from '../npl-read-model/npl-read-model.service';

export interface TenantLimits {
  maxUsers: number;
  maxDevices: number;
  maxAssets: number;
  maxCustomers: number;
}

export interface Tenant {
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
  limits: TenantLimits;
  createdTime: string;
  additionalInfo: string;
}

export interface TenantInfo {
  tenant: Tenant;
  tenantProfileName: string;
}

export interface PageData<T> {
  data: T[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

@Injectable()
export class TenantService {
  constructor(private readonly nplReadModelService: NplReadModelService) {}

  /**
   * Get tenant by ID from NPL read model
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetTenant($id: String!) {
          tenant(id: $id) {
            id
            name
            title
            region
            country
            stateName
            city
            address
            address2
            zip
            phone
            email
            limits {
              maxUsers
              maxDevices
              maxAssets
              maxCustomers
            }
            createdTime
            additionalInfo
          }
        }
      `, { id });

      return result.tenant || null;
    } catch (error) {
      console.error('Error getting tenant by ID:', error);
      return null;
    }
  }

  /**
   * Get tenant info by ID from NPL read model
   */
  async getTenantInfoById(id: string): Promise<TenantInfo | null> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetTenantInfo($id: String!) {
          tenantInfo(id: $id) {
            tenant {
              id
              name
              title
              region
              country
              stateName
              city
              address
              address2
              zip
              phone
              email
              limits {
                maxUsers
                maxDevices
                maxAssets
                maxCustomers
              }
              createdTime
              additionalInfo
            }
            tenantProfileName
          }
        }
      `, { id });

      return result.tenantInfo || null;
    } catch (error) {
      console.error('Error getting tenant info by ID:', error);
      return null;
    }
  }

  /**
   * Get all tenants from NPL read model
   */
  async getAllTenants(): Promise<Tenant[]> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetAllTenants {
          tenants {
            id
            name
            title
            region
            country
            stateName
            city
            address
            address2
            zip
            phone
            email
            limits {
              maxUsers
              maxDevices
              maxAssets
              maxCustomers
            }
            createdTime
            additionalInfo
          }
        }
      `);

      return result.tenants || [];
    } catch (error) {
      console.error('Error getting all tenants:', error);
      return [];
    }
  }

  /**
   * Get all tenant infos from NPL read model
   */
  async getAllTenantInfos(): Promise<TenantInfo[]> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetAllTenantInfos {
          tenantInfos {
            tenant {
              id
              name
              title
              region
              country
              stateName
              city
              address
              address2
              zip
              phone
              email
              limits {
                maxUsers
                maxDevices
                maxAssets
                maxCustomers
              }
              createdTime
              additionalInfo
            }
            tenantProfileName
          }
        }
      `);

      return result.tenantInfos || [];
    } catch (error) {
      console.error('Error getting all tenant infos:', error);
      return [];
    }
  }

  /**
   * Get tenants with pagination from NPL read model
   */
  async getTenantsPaginated(pageSize: number, page: number): Promise<PageData<Tenant>> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetTenantsPaginated($pageSize: Int!, $page: Int!) {
          tenantsPaginated(pageSize: $pageSize, page: $page) {
            data {
              id
              name
              title
              region
              country
              stateName
              city
              address
              address2
              zip
              phone
              email
              limits {
                maxUsers
                maxDevices
                maxAssets
                maxCustomers
              }
              createdTime
              additionalInfo
            }
            totalPages
            totalElements
            hasNext
          }
        }
      `, { pageSize, page });

      return result.tenantsPaginated || { data: [], totalPages: 0, totalElements: 0, hasNext: false };
    } catch (error) {
      console.error('Error getting tenants paginated:', error);
      return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
    }
  }

  /**
   * Get tenant infos with pagination from NPL read model
   */
  async getTenantInfosPaginated(pageSize: number, page: number): Promise<PageData<TenantInfo>> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetTenantInfosPaginated($pageSize: Int!, $page: Int!) {
          tenantInfosPaginated(pageSize: $pageSize, page: $page) {
            data {
              tenant {
                id
                name
                title
                region
                country
                stateName
                city
                address
                address2
                zip
                phone
                email
                limits {
                  maxUsers
                  maxDevices
                  maxAssets
                  maxCustomers
                }
                createdTime
                additionalInfo
              }
              tenantProfileName
            }
            totalPages
            totalElements
            hasNext
          }
        }
      `, { pageSize, page });

      return result.tenantInfosPaginated || { data: [], totalPages: 0, totalElements: 0, hasNext: false };
    } catch (error) {
      console.error('Error getting tenant infos paginated:', error);
      return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
    }
  }

  /**
   * Search tenants by name or title from NPL read model
   */
  async searchTenants(searchTerm: string): Promise<Tenant[]> {
    try {
      const result = await this.nplReadModelService.query(`
        query SearchTenants($searchTerm: String!) {
          searchTenants(searchTerm: $searchTerm) {
            id
            name
            title
            region
            country
            stateName
            city
            address
            address2
            zip
            phone
            email
            limits {
              maxUsers
              maxDevices
              maxAssets
              maxCustomers
            }
            createdTime
            additionalInfo
          }
        }
      `, { searchTerm });

      return result.searchTenants || [];
    } catch (error) {
      console.error('Error searching tenants:', error);
      return [];
    }
  }

  /**
   * Get tenant count from NPL read model
   */
  async getTenantCount(): Promise<number> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetTenantCount {
          tenantCount
        }
      `);

      return result.tenantCount || 0;
    } catch (error) {
      console.error('Error getting tenant count:', error);
      return 0;
    }
  }

  /**
   * Check if tenant exists from NPL read model
   */
  async tenantExists(id: string): Promise<boolean> {
    try {
      const result = await this.nplReadModelService.query(`
        query TenantExists($id: String!) {
          tenantExists(id: $id)
        }
      `, { id });

      return result.tenantExists || false;
    } catch (error) {
      console.error('Error checking if tenant exists:', error);
      return false;
    }
  }

  /**
   * Get tenant by name from NPL read model
   */
  async getTenantByName(name: string): Promise<Tenant | null> {
    try {
      const result = await this.nplReadModelService.query(`
        query GetTenantByName($name: String!) {
          tenantByName(name: $name) {
            id
            name
            title
            region
            country
            stateName
            city
            address
            address2
            zip
            phone
            email
            limits {
              maxUsers
              maxDevices
              maxAssets
              maxCustomers
            }
            createdTime
            additionalInfo
          }
        }
      `, { name });

      return result.tenantByName || null;
    } catch (error) {
      console.error('Error getting tenant by name:', error);
      return null;
    }
  }
} 