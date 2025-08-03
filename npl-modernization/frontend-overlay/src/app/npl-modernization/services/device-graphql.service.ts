import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import gql from 'graphql-tag';

export interface DeviceNode {
  value: any;
  protocolId: string;
  field: string;
  created: string;
}

export interface DeviceEdge {
  node: DeviceNode;
}

export interface DevicesConnection {
  edges: DeviceEdge[];
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface DeviceTypeCount {
  type: string;
  count: number;
}

export interface DeviceProfileCount {
  profileId: string;
  count: number;
}

export interface DeviceStatistics {
  total: number;
  byType: Array<{ value: string; count: number }>;
  byProfile: Array<{ value: string; count: number }>;
  recent: Array<{ node: { protocolId: string; created: string } }>;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  label?: string;
  deviceProfileName?: string;
  deviceProfileId?: string;
  customerTitle?: string;
  customerId?: string;
  active?: boolean;
  lastActivityTime?: number;
}

export interface DeviceCredentials {
  id: string;
  deviceId: string;
  credentialsType: string;
  credentialsId?: string;
  credentialsValue?: string;
  version?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceGraphQLService {
  constructor(private apollo: Apollo) {}

  /**
   * Generic GraphQL request method
   */
  private async request(query: string, variables: any = {}): Promise<any> {
    return this.apollo.query({
      query: gql`${query}`,
      variables
    }).toPromise().then((result: any) => result.data);
  }

  /**
   * Get device by ID
   */
  async getDeviceById(deviceId: string): Promise<any> {
    const query = `
      query GetDeviceById($deviceId: String!) {
        protocolFieldsStructs(condition: {
          fieldName: "id",
          value: $deviceId
        }) {
          edges {
            node {
              value
              protocolId
              created
            }
          }
        }
      }
    `;
    return this.request(query, { deviceId });
  }

  // ========== NEW QUERY OPERATIONS (Moved from NPL) ==========

  /**
   * Find device by name within tenant (replaces getTenantDeviceByName)
   */
  async getTenantDeviceByName(tenantId: string, deviceName: string): Promise<any> {
    const query = `
      query GetTenantDeviceByName($tenantId: String!, $deviceName: String!) {
        protocolFieldsStructs(condition: {
          fieldName: "name",
          value: $deviceName
        }) {
          edges {
            node {
              value
              protocolId
              created
              # Filter by tenant in the result
              tenantField: protocolFieldsStructs(condition: {
                fieldName: "tenantId",
                value: $tenantId,
                protocolId: node.protocolId
              }) {
                edges { node { value } }
              }
            }
          }
        }
      }
    `;
    return this.request(query, { tenantId, deviceName });
  }

  /**
   * Complex device search (replaces findDevicesByQuery)
   */
  async findDevicesByQuery(
    entityId: string,
    deviceTypes?: string[],
    textSearch?: string,
    limit: number = 50
  ): Promise<any> {
    const query = `
      query FindDevicesByQuery(
        $deviceTypes: [String!]
        $textSearch: String
        $limit: Int
      ) {
        protocolFieldsStructs(
          condition: {
            fieldName: "type"
            ${deviceTypes ? `value: {in: $deviceTypes}` : ''}
          }
          ${textSearch ? `
          filter: {
            or: [
              {fieldName: "name", value: {like: $textSearch}},
              {fieldName: "label", value: {like: $textSearch}}
            ]
          }
          ` : ''}
          first: $limit
        ) {
          edges {
            node {
              value
              protocolId
              created
            }
          }
          totalCount
        }
      }
    `;
    return this.request(query, { deviceTypes, textSearch, limit });
  }

  /**
   * Get enhanced device information (replaces getDeviceInfoById)
   */
  async getDeviceInfoById(deviceId: string): Promise<any> {
    const query = `
      query GetDeviceInfo($deviceId: String!) {
        device: protocolFieldsStructs(condition: {
          protocolId: $deviceId
        }) {
          edges {
            node {
              value
              created
              protocolId
              # Join customer information
              customerInfo: protocolFieldsStructs(condition: {
                fieldName: "customerId"
                protocolId: $deviceId
              }) {
                edges { 
                  node { 
                    value 
                    # Get customer title
                    customerDetails: protocolFieldsStructs(condition: {
                      protocolId: node.value
                    }) {
                      edges { node { value } }
                    }
                  } 
                }
              }
              # Join device profile information
              deviceProfile: protocolFieldsStructs(condition: {
                fieldName: "deviceProfileId"
                protocolId: $deviceId
              }) {
                edges { 
                  node { 
                    value
                    profileDetails: protocolFieldsStructs(condition: {
                      protocolId: node.value
                    }) {
                      edges { node { value } }
                    }
                  } 
                }
              }
            }
          }
        }
      }
    `;
    return this.request(query, { deviceId });
  }

  /**
   * Get customer devices with enhanced info and pagination (replaces getCustomerDeviceInfos)
   */
  async getCustomerDeviceInfos(
    customerId: string,
    pageSize: number = 20,
    page: number = 0,
    deviceType?: string
  ): Promise<any> {
    const offset = page * pageSize;
    const query = `
      query GetCustomerDeviceInfos(
        $customerId: String!
        $pageSize: Int!
        $offset: Int!
        $deviceType: String
      ) {
        protocolFieldsStructs(
          condition: {
            fieldName: "customerId"
            value: $customerId
          }
          ${deviceType ? `filter: {fieldName: "type", value: $deviceType}` : ''}
          first: $pageSize
          offset: $offset
          orderBy: CREATED_DESC
        ) {
          edges {
            node {
              value
              protocolId
              created
              # Get device details
              deviceDetails: protocolFieldsStructs(condition: {
                protocolId: node.protocolId
              }) {
                edges { node { value } }
              }
              # Get device profile info
              profileInfo: protocolFieldsStructs(condition: {
                fieldName: "deviceProfileId"
                protocolId: node.protocolId
              }) {
                edges { node { value } }
              }
            }
          }
          totalCount
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;
    return this.request(query, { customerId, pageSize, offset, deviceType });
  }

  /**
   * Get tenant devices with enhanced info and pagination (replaces getTenantDeviceInfos)
   */
  async getTenantDeviceInfos(
    tenantId: string,
    pageSize: number = 20,
    page: number = 0,
    deviceType?: string,
    activeFilter?: boolean
  ): Promise<any> {
    const offset = page * pageSize;
    const query = `
      query GetTenantDeviceInfos(
        $tenantId: String!
        $pageSize: Int!
        $offset: Int!
        $deviceType: String
      ) {
        protocolFieldsStructs(
          condition: {
            fieldName: "tenantId"
            value: $tenantId
          }
          ${deviceType ? `filter: {fieldName: "type", value: $deviceType}` : ''}
          first: $pageSize
          offset: $offset
          orderBy: CREATED_DESC
        ) {
          edges {
            node {
              value
              protocolId
              created
              # Get full device details
              deviceDetails: protocolFieldsStructs(condition: {
                protocolId: node.protocolId
              }) {
                edges { node { value } }
              }
              # Get customer assignment if any
              customerAssignment: protocolFieldsStructs(condition: {
                fieldName: "customerId"
                protocolId: node.protocolId
              }) {
                edges { 
                  node { 
                    value
                    customerTitle: protocolFieldsStructs(condition: {
                      protocolId: node.value
                    }) {
                      edges { node { value } }
                    }
                  } 
                }
              }
              # Get device profile
              deviceProfile: protocolFieldsStructs(condition: {
                fieldName: "deviceProfileId"
                protocolId: node.protocolId
              }) {
                edges { node { value } }
              }
            }
          }
          totalCount
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;
    return this.request(query, { tenantId, pageSize, offset, deviceType });
  }

  /**
   * Get device limits configuration
   * Maps to: GET /api/device/limits
   */
  async getDeviceLimits(): Promise<any> {
    const query = `
      query GetDeviceLimits {
        deviceLimits: protocolFieldsStructs(
          condition: {
            fieldName: "maxDevicesPerTenant"
            protocolName: "deviceManagement.DeviceManagement"
          }
        ) {
          edges {
            node {
              value
              # Get related limits
              maxCustomer: protocolFieldsStructs(condition: {
                fieldName: "maxDevicesPerCustomer"
                protocolId: node.protocolId
              }) {
                edges { node { value } }
              }
              maxProfile: protocolFieldsStructs(condition: {
                fieldName: "maxDevicesPerProfile" 
                protocolId: node.protocolId
              }) {
                edges { node { value } }
              }
            }
          }
        }
      }
    `;
    return this.request(query, {});
  }

  // ========== OBSERVABLE-BASED METHODS (for backward compatibility) ==========

  /**
   * Get device info by ID - enhanced version with additional metadata
   * Maps to: GET /api/device/info/{deviceId}
   */
  getDeviceInfoByIdObservable(deviceId: string): Observable<DeviceInfo | null> {
    return this.apollo.query({
      query: gql`
        query GetDeviceInfo($deviceId: String!) {
          protocolFieldsStructs(
            filter: {
              field: { equalTo: "id" },
              value: { equalTo: $deviceId }
            }
          ) {
            edges {
              node {
                value
                protocolId
                field
                created
              }
            }
          }
        }
      `,
      variables: { deviceId }
    }).pipe(
      map((result: any) => this.transformDeviceInfoResult(result))
    );
  }

  /**
   * Get devices by customer ID
   * Maps to: GET /api/customer/{customerId}/devices
   */
  getCustomerDevices(customerId: string, pageSize: number = 10, page: number = 0): Observable<DevicesConnection> {
    return this.apollo.query({
      query: gql`
        query GetCustomerDevices($customerId: String!, $first: Int!, $offset: Int!) {
          protocolFieldsStructs(
            first: $first
            offset: $offset
            filter: {
              field: { equalTo: "customerId" },
              value: { equalTo: $customerId }
            }
          ) {
            edges {
              node {
                value
                protocolId
                field
                created
              }
            }
            totalCount
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `,
      variables: { customerId, first: pageSize, offset: page * pageSize }
    }).pipe(
      map((result: any) => result.data?.protocolFieldsStructs)
    );
  }

  /**
   * Get customer device infos with enhanced metadata
   * Maps to: GET /api/customer/{customerId}/deviceInfos
   */
  getCustomerDeviceInfosObservable(customerId: string, pageSize: number = 10, page: number = 0): Observable<DeviceInfo[]> {
    return this.getCustomerDevices(customerId, pageSize, page).pipe(
      map(connection => this.transformDeviceInfosFromConnection(connection))
    );
  }

  /**
   * Get device credentials by device ID
   * Maps to: GET /api/device/{deviceId}/credentials
   */
  getDeviceCredentials(deviceId: string): Observable<DeviceCredentials | null> {
    return this.apollo.query({
      query: gql`
        query GetDeviceCredentials($deviceId: String!) {
          protocolFieldsStructs(
            filter: {
              field: { equalTo: "id" },
              value: { equalTo: $deviceId }
            }
          ) {
            edges {
              node {
                value
                protocolId
                field
              }
            }
          }
        }
      `,
      variables: { deviceId }
    }).pipe(
      map((result: any) => this.transformDeviceCredentialsResult(result, deviceId))
    );
  }

  /**
   * Get devices by multiple IDs
   * Maps to: GET /api/devices?deviceIds=x,y,z
   */
  getDevicesByIds(deviceIds: string[]): Observable<any[]> {
    return this.apollo.query({
      query: gql`
        query GetDevicesByIds($deviceIds: [String!]!) {
          protocolFieldsStructs(
            filter: {
              field: { equalTo: "id" },
              value: { in: $deviceIds }
            }
          ) {
            edges {
              node {
                value
                protocolId
                field
              }
            }
          }
        }
      `,
      variables: { deviceIds }
    }).pipe(
      map((result: any) => this.transformMultipleDevicesResult(result))
    );
  }

  /**
   * Get devices by name query
   * Maps to: GET /api/devices?deviceName=xyz
   */
  getDevicesByQuery(query: string, pageSize: number = 10, page: number = 0): Observable<DevicesConnection> {
    return this.apollo.query({
      query: gql`
        query GetDevicesByQuery($query: String!, $first: Int!, $offset: Int!) {
          protocolFieldsStructs(
            first: $first
            offset: $offset
            filter: {
              or: [
                { field: { equalTo: "name" }, value: { includesInsensitive: $query } },
                { field: { equalTo: "label" }, value: { includesInsensitive: $query } },
                { field: { equalTo: "type" }, value: { includesInsensitive: $query } }
              ]
            }
          ) {
            edges {
              node {
                value
                protocolId
                field
                created
              }
            }
            totalCount
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `,
      variables: { query, first: pageSize, offset: page * pageSize }
    }).pipe(
      map((result: any) => result.data?.protocolFieldsStructs)
    );
  }

  /**
   * Count devices by device profile and OTA package type
   * Maps to: GET /api/devices/count/{otaPackageType}/{deviceProfileId}
   */
  countDevicesByProfile(deviceProfileId: string, otaPackageType?: string): Observable<number> {
    const filter: any = {
      field: { equalTo: "deviceProfileId" },
      value: { equalTo: deviceProfileId }
    };

    // Add OTA package type filter if provided
    if (otaPackageType) {
      filter.and = [{
        field: { equalTo: otaPackageType === 'FIRMWARE' ? "firmwareId" : "softwareId" },
        value: { isNotNull: true }
      }];
    }

    return this.apollo.query({
      query: gql`
        query CountDevicesByProfile($filter: ProtocolFieldsStructFilter!) {
          protocolFieldsStructs(filter: $filter) {
            totalCount
          }
        }
      `,
      variables: { filter }
    }).pipe(
      map((result: any) => result.data?.protocolFieldsStructs?.totalCount || 0)
    );
  }

  // Enhanced device listing with filtering and pagination
  getTenantDevices(pageSize: number = 10, page: number = 0, filters?: any): Observable<DevicesConnection> {
    return this.apollo.query({
      query: gql`
        query GetDevices($first: Int!, $offset: Int!, $filter: ProtocolFieldsStructFilter) {
          protocolFieldsStructs(
            first: $first
            offset: $offset
            filter: $filter
          ) {
            edges {
              node {
                value
                protocolId
                field
                created
              }
            }
            totalCount
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `,
      variables: {
        first: pageSize,
        offset: page * pageSize,
        filter: filters
      }
    }).pipe(
      map((result: any) => result.data?.protocolFieldsStructs)
    );
  }

  // Get devices by profile ID with count
  getDevicesByProfile(profileId: string, pageSize: number = 10, page: number = 0): Observable<DevicesConnection> {
    return this.apollo.query({
      query: gql`
        query DevicesByProfile($profileId: String!, $first: Int!, $offset: Int!) {
          protocolFieldsStructs(
            first: $first
            offset: $offset
            filter: {
              field: { equalTo: "deviceProfileId" },
              value: { equalTo: $profileId }
            }
          ) {
            edges {
              node {
                value
                protocolId
                field
                created
              }
            }
            totalCount
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `,
      variables: { profileId, first: pageSize, offset: page * pageSize }
    }).pipe(
      map((result: any) => result.data?.protocolFieldsStructs)
    );
  }

  // Get device types with counts - enhanced to match ThingsBoard API
  getDeviceTypes(): Observable<string[]> {
    return this.apollo.query({
      query: gql`
        query DeviceTypes {
          protocolFieldsStructs(
            filter: { field: { equalTo: "type" } }
          ) {
            groupBy {
              value
              count
            }
          }
        }
      `
    }).pipe(
      map((result: any) => 
        result.data?.protocolFieldsStructs?.groupBy?.map((group: any) => group.value).sort() || []
      )
    );
  }

  // Advanced search with multiple criteria
  searchDevicesAdvanced(criteria: {
    textSearch?: string,
    type?: string,
    profileId?: string,
    hasCredentials?: boolean
  }): Observable<DevicesConnection> {
    const filters: any[] = [];

    if (criteria.textSearch) {
      filters.push({
        or: [
          { field: { equalTo: "name" }, value: { includesInsensitive: criteria.textSearch } },
          { field: { equalTo: "label" }, value: { includesInsensitive: criteria.textSearch } }
        ]
      });
    }

    if (criteria.type) {
      filters.push({
        field: { equalTo: "type" },
        value: { equalTo: criteria.type }
      });
    }

    if (criteria.profileId) {
      filters.push({
        field: { equalTo: "deviceProfileId" },
        value: { equalTo: criteria.profileId }
      });
    }

    if (criteria.hasCredentials !== undefined) {
      filters.push({
        field: { equalTo: "credentials" },
        value: criteria.hasCredentials ? { isNotNull: true } : { isNull: true }
      });
    }

    return this.apollo.query({
      query: gql`
        query SearchDevices($filter: ProtocolFieldsStructFilter!) {
          protocolFieldsStructs(filter: $filter) {
            edges {
              node {
                value
                protocolId
                field
                created
              }
            }
            totalCount
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `,
      variables: {
        filter: { and: filters }
      }
    }).pipe(
      map((result: any) => result.data?.protocolFieldsStructs)
    );
  }

  // Get device statistics
  getDeviceStatistics(): Observable<DeviceStatistics> {
    return this.apollo.query({
      query: gql`
        query DeviceStatistics {
          totalDevices: protocolStates {
            totalCount
          }
          byType: protocolFieldsStructs(
            filter: { field: { equalTo: "type" } }
          ) {
            groupBy {
              value
              count
            }
          }
          byProfile: protocolFieldsStructs(
            filter: { field: { equalTo: "deviceProfileId" } }
          ) {
            groupBy {
              value
              count
            }
          }
          recentDevices: protocolStates(
            orderBy: CREATED_DESC
            first: 10
          ) {
            edges {
              node {
                protocolId
                created
              }
            }
          }
        }
      `
    }).pipe(
      map((result: any) => ({
        total: result.data?.totalDevices?.totalCount || 0,
        byType: result.data?.byType?.groupBy || [],
        byProfile: result.data?.byProfile?.groupBy || [],
        recent: result.data?.recentDevices?.edges || []
      }))
    );
  }

  // ========== HELPER METHODS ==========

  private transformDeviceResult(result: any): any {
    const edges = result.data?.protocolFieldsStructs?.edges || [];
    if (!edges.length) return null;

    // Convert array of field values into a single device object
    return edges.reduce((device: any, edge: any) => {
      const node = edge.node;
      device[node.field] = node.value;
      device.protocolId = node.protocolId;
      return device;
    }, {});
  }

  private transformDeviceInfoResult(result: any): DeviceInfo | null {
    const device = this.transformDeviceResult(result);
    if (!device) return null;

    return {
      id: device.id,
      name: device.name,
      type: device.type,
      label: device.label,
      deviceProfileId: device.deviceProfileId,
      customerId: device.customerId,
      active: true, // Would need additional logic to determine this
      lastActivityTime: device.createdTime
    };
  }

  private transformDeviceInfosFromConnection(connection: DevicesConnection): DeviceInfo[] {
    if (!connection || !connection.edges) return [];
    
    const deviceGroups = new Map<string, any>();
    
    // Group edges by protocolId to reconstruct complete device objects
    connection.edges.forEach(edge => {
      const protocolId = edge.node.protocolId;
      if (!deviceGroups.has(protocolId)) {
        deviceGroups.set(protocolId, {});
      }
      const device = deviceGroups.get(protocolId);
      device[edge.node.field] = edge.node.value;
      device.protocolId = protocolId;
    });

    // Convert to DeviceInfo objects
    return Array.from(deviceGroups.values()).map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      label: device.label,
      deviceProfileId: device.deviceProfileId,
      customerId: device.customerId,
      active: true,
      lastActivityTime: device.createdTime
    }));
  }

  private transformDeviceCredentialsResult(result: any, deviceId: string): DeviceCredentials | null {
    const device = this.transformDeviceResult(result);
    if (!device || !device.credentials) return null;

    return {
      id: `${deviceId}_credentials`,
      deviceId: deviceId,
      credentialsType: 'ACCESS_TOKEN', // Default assumption
      credentialsId: device.credentials,
      credentialsValue: device.credentials
    };
  }

  private transformMultipleDevicesResult(result: any): any[] {
    const edges = result.data?.protocolFieldsStructs?.edges || [];
    const deviceGroups = new Map<string, any>();
    
    // Group edges by protocolId to reconstruct complete device objects
    edges.forEach((edge: any) => {
      const protocolId = edge.node.protocolId;
      if (!deviceGroups.has(protocolId)) {
        deviceGroups.set(protocolId, {});
      }
      const device = deviceGroups.get(protocolId);
      device[edge.node.field] = edge.node.value;
      device.protocolId = protocolId;
    });

    return Array.from(deviceGroups.values());
  }
} 