import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, BehaviorSubject, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';

export interface Device {
  id?: string;
  name: string;
  type: string;
  label?: string;
  customerId?: string;
  version?: number;
  createdTime?: number;
}

export interface Tenant {
  id?: string;
  name: string;
  title?: string;
  region?: string;
  tenantProfileId?: string;
  version?: number;
  createdTime?: number;
}

export interface NplProtocolInstance {
  '@id': string;
  '@actions': { [key: string]: string };
  '@parties': any;
  '@state': string;
}

@Injectable({
  providedIn: 'root'
})
export class NplClientService {
  private readonly NPL_ENGINE_URL = 'http://localhost:12000';
  private readonly OIDC_PROXY_URL = 'http://localhost:8080';
  
  // Protocol packages and names
  private readonly DEVICE_PROTOCOL_PACKAGE = 'deviceManagement';
  private readonly DEVICE_PROTOCOL_NAME = 'DeviceManagement';
  private readonly TENANT_PROTOCOL_PACKAGE = 'tenantManagement';
  private readonly TENANT_PROTOCOL_NAME = 'TenantManagement';
  
  // Protocol instance ID cache
  private deviceProtocolInstanceId: string | null = null;
  private tenantProtocolInstanceId: string | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Get or create device protocol instance
   */
  private getOrCreateDeviceProtocolInstance(): Observable<string> {
    if (this.deviceProtocolInstanceId) {
      return of(this.deviceProtocolInstanceId);
    }

    return this.createProtocolInstance(this.DEVICE_PROTOCOL_PACKAGE, this.DEVICE_PROTOCOL_NAME).pipe(
      tap(instanceId => {
        this.deviceProtocolInstanceId = instanceId;
        console.log(`Device protocol instance created: ${instanceId}`);
      })
    );
  }

  /**
   * Get or create tenant protocol instance
   */
  private getOrCreateTenantProtocolInstance(): Observable<string> {
    if (this.tenantProtocolInstanceId) {
      return of(this.tenantProtocolInstanceId);
    }

    return this.createProtocolInstance(this.TENANT_PROTOCOL_PACKAGE, this.TENANT_PROTOCOL_NAME).pipe(
      tap(instanceId => {
        this.tenantProtocolInstanceId = instanceId;
        console.log(`Tenant protocol instance created: ${instanceId}`);
      })
    );
  }

  /**
   * Create a protocol instance using the NPL Engine API
   */
  private createProtocolInstance(packageName: string, protocolName: string): Observable<string> {
    return this.getAuthToken().pipe(
      switchMap(token => {
        const url = `${this.NPL_ENGINE_URL}/npl/${packageName}/${protocolName}/`;
        const payload = {
          "@parties": {}
        };

        return this.http.post<NplProtocolInstance>(url, payload, { headers: this.createHeaders(token) });
      }),
      map(response => {
        const instanceId = response['@id'];
        if (!instanceId) {
          throw new Error('No protocol instance ID returned');
        }
        return instanceId;
      }),
      catchError(error => {
        console.error('Failed to create protocol instance:', error);
        throw error;
      })
    );
  }

  /**
   * Get authentication token from OIDC Proxy
   */
  private getAuthToken(): Observable<string> {
    const authRequest = {
      username: 'tenant@thingsboard.org',
      password: 'tenant'
    };

    return this.http.post<{ access_token: string }>(
      `${this.OIDC_PROXY_URL}/protocol/openid-connect/token`,
      authRequest
    ).pipe(
      map(response => response.access_token)
    );
  }

  /**
   * Create HTTP headers with authorization
   */
  private createHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Call a device protocol operation using dynamic instance ID
   */
  private callDeviceProtocolOperation(operation: string, payload: any): Observable<any> {
    return this.getOrCreateDeviceProtocolInstance().pipe(
      switchMap(instanceId => {
        return this.getAuthToken().pipe(
          switchMap(token => {
            const url = `${this.NPL_ENGINE_URL}/npl/${this.DEVICE_PROTOCOL_PACKAGE}/${this.DEVICE_PROTOCOL_NAME}/${instanceId}/${operation}`;
            return this.http.post(url, payload, { headers: this.createHeaders(token) });
          })
        );
      })
    );
  }

  /**
   * Call a tenant protocol operation using dynamic instance ID
   */
  private callTenantProtocolOperation(operation: string, payload: any): Observable<any> {
    return this.getOrCreateTenantProtocolInstance().pipe(
      switchMap(instanceId => {
        return this.getAuthToken().pipe(
          switchMap(token => {
            const url = `${this.NPL_ENGINE_URL}/npl/${this.TENANT_PROTOCOL_PACKAGE}/${this.TENANT_PROTOCOL_NAME}/${instanceId}/${operation}`;
            return this.http.post(url, payload, { headers: this.createHeaders(token) });
          })
        );
      })
    );
  }

  // ==================== DEVICE OPERATIONS ====================

  /**
   * Save a device using dynamic protocol instance
   */
  saveDevice(device: Device): Observable<Device> {
    return this.callDeviceProtocolOperation('saveDevice', { device });
  }

  /**
   * Delete a device using dynamic protocol instance
   */
  deleteDevice(deviceId: string): Observable<boolean> {
    return this.callDeviceProtocolOperation('deleteDevice', { id: deviceId });
  }

  /**
   * Assign device to customer using dynamic protocol instance
   */
  assignDeviceToCustomer(deviceId: string, customerId: string): Observable<Device> {
    return this.callDeviceProtocolOperation('assignDeviceToCustomer', { deviceId, customerId });
  }

  /**
   * Unassign device from customer using dynamic protocol instance
   */
  unassignDeviceFromCustomer(deviceId: string): Observable<Device> {
    return this.callDeviceProtocolOperation('unassignDeviceFromCustomer', { deviceId });
  }

  /**
   * Update device credentials using dynamic protocol instance
   */
  updateDeviceCredentials(deviceId: string, credentials: any): Observable<any> {
    return this.callDeviceProtocolOperation('saveDeviceCredentials', { deviceId, credentials });
  }

  /**
   * Delete device credentials using dynamic protocol instance
   */
  deleteDeviceCredentials(deviceId: string): Observable<boolean> {
    return this.callDeviceProtocolOperation('deleteDeviceCredentials', { deviceId });
  }

  /**
   * Claim device using dynamic protocol instance
   */
  claimDevice(deviceName: string, secretKey: string): Observable<Device> {
    return this.callDeviceProtocolOperation('claimDevice', { deviceId: deviceName, secretKey });
  }

  /**
   * Reclaim device using dynamic protocol instance
   */
  reclaimDevice(deviceId: string): Observable<Device> {
    return this.callDeviceProtocolOperation('reclaimDevice', { deviceId });
  }

  /**
   * Get device protocol state using dynamic protocol instance
   */
  getDeviceProtocolState(): Observable<any> {
    return this.getOrCreateDeviceProtocolInstance().pipe(
      switchMap(instanceId => {
        return this.getAuthToken().pipe(
          switchMap(token => {
            const url = `${this.NPL_ENGINE_URL}/npl/${this.DEVICE_PROTOCOL_PACKAGE}/${this.DEVICE_PROTOCOL_NAME}/${instanceId}/`;
            return this.http.get(url, { headers: this.createHeaders(token) });
          })
        );
      })
    );
  }

  // ==================== TENANT OPERATIONS ====================

  /**
   * Create a tenant using dynamic protocol instance
   */
  createTenant(tenant: Tenant): Observable<Tenant> {
    return this.callTenantProtocolOperation('createTenant', { tenant });
  }

  /**
   * Update a tenant using dynamic protocol instance
   */
  updateTenant(tenant: Tenant): Observable<Tenant> {
    return this.callTenantProtocolOperation('updateTenant', { tenant });
  }

  /**
   * Delete a tenant using dynamic protocol instance
   */
  deleteTenant(tenantId: string): Observable<boolean> {
    return this.callTenantProtocolOperation('deleteTenant', { tenantId });
  }

  /**
   * Bulk import tenants using dynamic protocol instance
   */
  bulkImportTenants(tenants: Tenant[]): Observable<any> {
    return this.callTenantProtocolOperation('bulkImportTenants', { tenants });
  }

  /**
   * Bulk delete tenants using dynamic protocol instance
   */
  bulkDeleteTenants(tenantIds: string[]): Observable<any> {
    return this.callTenantProtocolOperation('bulkDeleteTenants', { tenantIds });
  }

  /**
   * Get tenant protocol state using dynamic protocol instance
   */
  getTenantProtocolState(): Observable<any> {
    return this.getOrCreateTenantProtocolInstance().pipe(
      switchMap(instanceId => {
        return this.getAuthToken().pipe(
          switchMap(token => {
            const url = `${this.NPL_ENGINE_URL}/npl/${this.TENANT_PROTOCOL_PACKAGE}/${this.TENANT_PROTOCOL_NAME}/${instanceId}/`;
            return this.http.get(url, { headers: this.createHeaders(token) });
          })
        );
      })
    );
  }
} 