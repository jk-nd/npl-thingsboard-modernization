import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Device } from './npl-client.service';

export interface GraphQLDevice {
  protocolId: string;
  currentState: string;
  created: string;
  fieldValues: {
    id?: string;
    name?: string;
    type?: string;
    label?: string;
    customerId?: string;
    version?: number;
    createdTime?: number;
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string;
  endCursor: string;
}

export interface DevicesConnection {
  edges: Array<{
    node: GraphQLDevice;
    cursor: string;
  }>;
  pageInfo: PageInfo;
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceGraphQLService {

  // GraphQL Queries
  private readonly GET_DEVICES_QUERY = gql`
    query GetDevices($first: Int, $offset: Int, $textSearch: String) {
      protocolStates(first: $first, offset: $offset) {
        edges {
          node {
            protocolId
            currentState
            created
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `;

  private readonly GET_DEVICE_BY_ID_QUERY = gql`
    query GetDeviceById($deviceId: String!) {
      protocolFieldsStructs(condition: {
        field: "id", 
        value: $deviceId
      }) {
        edges {
          node {
            field
            value
            protocolId
          }
        }
      }
    }
  `;

  private readonly SEARCH_DEVICES_QUERY = gql`
    query SearchDevices($searchText: String!, $first: Int, $offset: Int) {
      protocolFieldsTexts(
        filter: { value: { includesInsensitive: $searchText } }
        first: $first
        offset: $offset
      ) {
        edges {
          node {
            field
            value
            protocolId
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `;

  private readonly GET_CUSTOMER_DEVICES_QUERY = gql`
    query GetCustomerDevices($customerId: String!, $first: Int, $offset: Int) {
      protocolFieldsStructs(
        condition: { field: "customerId", value: $customerId }
        first: $first
        offset: $offset
      ) {
        edges {
          node {
            field
            value
            protocolId
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `;

  constructor(private apollo: Apollo) {}

  /**
   * Get devices with pagination
   */
  getDevices(pageSize: number = 20, page: number = 0): Observable<DevicesConnection> {
    return this.apollo.query<{ protocolStates: DevicesConnection }>({
      query: this.GET_DEVICES_QUERY,
      variables: {
        first: pageSize,
        offset: page * pageSize
      }
    }).pipe(
      map(result => result.data.protocolStates)
    );
  }

  /**
   * Get device by ID
   */
  getDeviceById(deviceId: string): Observable<Device | null> {
    return this.apollo.query<{ protocolFieldsStructs: { edges: Array<{ node: any }> } }>({
      query: this.GET_DEVICE_BY_ID_QUERY,
      variables: { deviceId }
    }).pipe(
      map(result => {
        const edges = result.data.protocolFieldsStructs.edges;
        if (edges.length === 0) {
          return null;
        }

        // Convert GraphQL field structure back to Device object
        const device: Device = { name: '', type: '' };
        edges.forEach(edge => {
          const field = edge.node.field;
          const value = edge.node.value;
          
          switch (field) {
            case 'id':
              device.id = value;
              break;
            case 'name':
              device.name = value;
              break;
            case 'type':
              device.type = value;
              break;
            case 'label':
              device.label = value;
              break;
            case 'customerId':
              device.customerId = value;
              break;
            case 'version':
              device.version = parseInt(value);
              break;
            case 'createdTime':
              device.createdTime = parseInt(value);
              break;
          }
        });

        return device;
      })
    );
  }

  /**
   * Search devices by text
   */
  searchDevices(textSearch: string, pageSize: number = 20, page: number = 0): Observable<DevicesConnection> {
    return this.apollo.query<{ protocolFieldsTexts: DevicesConnection }>({
      query: this.SEARCH_DEVICES_QUERY,
      variables: {
        searchText: textSearch,
        first: pageSize,
        offset: page * pageSize
      }
    }).pipe(
      map(result => result.data.protocolFieldsTexts)
    );
  }

  /**
   * Get devices by customer ID
   */
  getCustomerDevices(customerId: string, pageSize: number = 20, page: number = 0): Observable<DevicesConnection> {
    return this.apollo.query<{ protocolFieldsStructs: DevicesConnection }>({
      query: this.GET_CUSTOMER_DEVICES_QUERY,
      variables: {
        customerId,
        first: pageSize,
        offset: page * pageSize
      }
    }).pipe(
      map(result => result.data.protocolFieldsStructs)
    );
  }

  /**
   * Get tenant devices (same as getDevices but with different semantic meaning)
   */
  getTenantDevices(pageSize: number = 20, page: number = 0): Observable<DevicesConnection> {
    return this.getDevices(pageSize, page);
  }

  /**
   * Find devices by various criteria
   */
  findDevices(criteria: {
    textSearch?: string;
    customerId?: string;
    type?: string;
    pageSize?: number;
    page?: number;
  }): Observable<DevicesConnection> {
    if (criteria.textSearch) {
      return this.searchDevices(criteria.textSearch, criteria.pageSize, criteria.page);
    }
    
    if (criteria.customerId) {
      return this.getCustomerDevices(criteria.customerId, criteria.pageSize, criteria.page);
    }

    // For type-based searches, we can use the text search with type filter
    if (criteria.type) {
      return this.searchDevices(criteria.type, criteria.pageSize, criteria.page);
    }

    return this.getDevices(criteria.pageSize, criteria.page);
  }

  /**
   * Subscribe to real-time device updates (GraphQL subscriptions)
   * Note: This would require subscription support in the Read Model
   */
  subscribeToDeviceUpdates(): Observable<Device> {
    // Placeholder - would implement GraphQL subscriptions when available
    return new Observable(observer => {
      // GraphQL subscription would go here
      console.warn('Real-time subscriptions not yet implemented');
      observer.complete();
    });
  }

  /**
   * Get device count
   */
  getDeviceCount(): Observable<number> {
    return this.getDevices(1, 0).pipe(
      map(connection => connection.totalCount)
    );
  }
} 