import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import gql from 'graphql-tag';

export interface TenantLimits {
  maxUsers: number;
  maxDevices: number;
  maxAssets: number;
  maxCustomers: number;
}

export interface TenantData {
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

@Injectable({
  providedIn: 'root'
})
export class TenantGraphQLService {

  constructor(private apollo: Apollo) {}

  /**
   * Get all tenants
   */
  getTenants(): Observable<Tenant[]> {
    return this.apollo.query<{ tenants: Tenant[] }>({
      query: gql`
        query GetTenants {
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
      `
    }).pipe(map(result => result.data.tenants));
  }

  /**
   * Get tenant by ID
   */
  getTenant(id: string): Observable<Tenant> {
    return this.apollo.query<{ tenant: Tenant }>({
      query: gql`
        query GetTenant($id: ID!) {
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
      `,
      variables: { id }
    }).pipe(map(result => result.data.tenant));
  }

  /**
   * Get tenant info by ID
   */
  getTenantInfo(id: string): Observable<TenantInfo> {
    return this.apollo.query<{ tenantInfo: TenantInfo }>({
      query: gql`
        query GetTenantInfo($id: ID!) {
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
      `,
      variables: { id }
    }).pipe(map(result => result.data.tenantInfo));
  }

  /**
   * Get all tenant infos
   */
  getTenantInfos(): Observable<TenantInfo[]> {
    return this.apollo.query<{ tenantInfos: TenantInfo[] }>({
      query: gql`
        query GetTenantInfos {
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
      `
    }).pipe(map(result => result.data.tenantInfos));
  }

  /**
   * Get tenants with pagination
   */
  getTenantsPaginated(pageSize: number, page: number): Observable<PageData<Tenant>> {
    return this.apollo.query<{ tenantsPaginated: PageData<Tenant> }>({
      query: gql`
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
      `,
      variables: { pageSize, page }
    }).pipe(map(result => result.data.tenantsPaginated));
  }

  /**
   * Get tenant infos with pagination
   */
  getTenantInfosPaginated(pageSize: number, page: number): Observable<PageData<TenantInfo>> {
    return this.apollo.query<{ tenantInfosPaginated: PageData<TenantInfo> }>({
      query: gql`
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
      `,
      variables: { pageSize, page }
    }).pipe(map(result => result.data.tenantInfosPaginated));
  }

  /**
   * Search tenants by name
   */
  searchTenants(searchTerm: string): Observable<Tenant[]> {
    return this.apollo.query<{ searchTenants: Tenant[] }>({
      query: gql`
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
      `,
      variables: { searchTerm }
    }).pipe(map(result => result.data.searchTenants));
  }

  /**
   * Get tenant count
   */
  getTenantCount(): Observable<number> {
    return this.apollo.query<{ tenantCount: number }>({
      query: gql`
        query GetTenantCount {
          tenantCount
        }
      `
    }).pipe(map(result => result.data.tenantCount));
  }

  /**
   * Check if tenant exists
   */
  tenantExists(id: string): Observable<boolean> {
    return this.apollo.query<{ tenantExists: boolean }>({
      query: gql`
        query TenantExists($id: ID!) {
          tenantExists(id: $id)
        }
      `,
      variables: { id }
    }).pipe(map(result => result.data.tenantExists));
  }

  /**
   * Get tenant by name
   */
  getTenantByName(name: string): Observable<Tenant | null> {
    return this.apollo.query<{ tenantByName: Tenant | null }>({
      query: gql`
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
      `,
      variables: { name }
    }).pipe(map(result => result.data.tenantByName));
  }

  /**
   * Generic request method for any GraphQL query
   */
  request<T>(query: any, variables?: any): Observable<T> {
    return this.apollo.query<{ [key: string]: T }>({
      query,
      variables
    }).pipe(map(result => {
      const key = Object.keys(result.data)[0];
      return result.data[key];
    }));
  }
} 