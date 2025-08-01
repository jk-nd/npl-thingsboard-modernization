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

interface GraphQLResponse<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceGraphQLService {
  constructor(private apollo: Apollo) {}

  // Basic device queries (existing)
  getDeviceById(deviceId: string): Observable<any> {
    return this.apollo.query<GraphQLResponse<{ protocolFieldsStructs: { edges: DeviceEdge[] } }>>({
      query: gql`
        query GetDevice($deviceId: String!) {
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
      map(result => this.transformDeviceResult(result))
    );
  }

  // Enhanced device listing with filtering and pagination
  getTenantDevices(pageSize: number = 10, page: number = 0, filters?: any): Observable<DevicesConnection> {
    return this.apollo.query<GraphQLResponse<{ protocolFieldsStructs: DevicesConnection }>>({
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
      map(result => result.data.protocolFieldsStructs)
    );
  }

  // Get devices by profile ID with count
  getDevicesByProfile(profileId: string, pageSize: number = 10, page: number = 0): Observable<DevicesConnection> {
    return this.apollo.query<GraphQLResponse<{ protocolFieldsStructs: DevicesConnection }>>({
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
      map(result => result.data.protocolFieldsStructs)
    );
  }

  // Get device types with counts
  getDeviceTypes(): Observable<DeviceTypeCount[]> {
    return this.apollo.query<GraphQLResponse<{ protocolFieldsStructs: { groupBy: Array<{ value: string; count: number }> } }>>({
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
      map(result => 
        result.data.protocolFieldsStructs.groupBy.map(group => ({
          type: group.value,
          count: group.count
        }))
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

    return this.apollo.query<GraphQLResponse<{ protocolFieldsStructs: DevicesConnection }>>({
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
      map(result => result.data.protocolFieldsStructs)
    );
  }

  // Get device statistics
  getDeviceStatistics(): Observable<DeviceStatistics> {
    return this.apollo.query<GraphQLResponse<{
      totalDevices: { totalCount: number };
      byType: { groupBy: Array<{ value: string; count: number }> };
      byProfile: { groupBy: Array<{ value: string; count: number }> };
      recentDevices: { edges: Array<{ node: { protocolId: string; created: string } }> };
    }>>({
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
      map(result => ({
        total: result.data.totalDevices.totalCount,
        byType: result.data.byType.groupBy,
        byProfile: result.data.byProfile.groupBy,
        recent: result.data.recentDevices.edges
      }))
    );
  }

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
} 