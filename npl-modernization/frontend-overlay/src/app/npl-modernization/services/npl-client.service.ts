import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface Device {
  id?: string;
  name: string;
  type: string;
  label?: string;
  customerId?: string;
  version?: number;
  createdTime?: number;
}

export interface NplProtocolInstance {
  protocolId: string;
  parties: Array<{
    entity: { [key: string]: string[] };
    access: any;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class NplClientService {
  private readonly NPL_ENGINE_URL = 'http://localhost:12000';
  private readonly OIDC_PROXY_URL = 'http://localhost:8080';
  
  // Our deployed protocol details
  private readonly PROTOCOL_PACKAGE = 'deviceManagement';
  private readonly PROTOCOL_NAME = 'DeviceManagement';

  constructor(private http: HttpClient) {}

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
   * Instantiate a new DeviceManagement protocol
   */
  instantiateProtocol(parties: Array<{ entity: { [key: string]: string[] }, access: any }>): Observable<NplProtocolInstance> {
    return this.getAuthToken().pipe(
      switchMap(token => {
        const instantiationRequest = {
          package: this.PROTOCOL_PACKAGE,
          protocol: this.PROTOCOL_NAME,
          parties: parties,
          initialArguments: {}
        };

        return this.http.post<{ protocolId: string }>(
          `${this.NPL_ENGINE_URL}/api/protocol/instantiate`,
          instantiationRequest,
          { headers: this.createHeaders(token) }
        ).pipe(
          map(response => ({
            protocolId: response.protocolId,
            parties: parties
          }))
        );
      })
    );
  }

  /**
   * Call a protocol operation (permission)
   */
  callOperation(protocolId: string, operation: string, payload: any): Observable<any> {
    return this.getAuthToken().pipe(
      switchMap(token => {
        const operationRequest = {
          operation: operation,
          arguments: payload
        };

        return this.http.post(
          `${this.NPL_ENGINE_URL}/api/protocol/${protocolId}/call`,
          operationRequest,
          { headers: this.createHeaders(token) }
        );
      })
    );
  }

  /**
   * Save/Create a device
   */
  saveDevice(protocolId: string, device: Device): Observable<Device> {
    return this.callOperation(protocolId, 'saveDevice', { device }).pipe(
      map(response => response.device || device)
    );
  }

  /**
   * Delete a device
   */
  deleteDevice(protocolId: string, deviceId: string): Observable<boolean> {
    return this.callOperation(protocolId, 'deleteDevice', { deviceId }).pipe(
      map(response => response.success || true)
    );
  }

  /**
   * Assign device to customer
   */
  assignDeviceToCustomer(protocolId: string, deviceId: string, customerId: string): Observable<Device> {
    return this.callOperation(protocolId, 'assignDeviceToCustomer', { deviceId, customerId }).pipe(
      map(response => response.device)
    );
  }

  /**
   * Unassign device from customer
   */
  unassignDeviceFromCustomer(protocolId: string, deviceId: string): Observable<Device> {
    return this.callOperation(protocolId, 'unassignDeviceFromCustomer', { deviceId }).pipe(
      map(response => response.device)
    );
  }

  /**
   * Update device credentials
   */
  updateDeviceCredentials(protocolId: string, deviceId: string, credentials: any): Observable<any> {
    return this.callOperation(protocolId, 'saveDeviceCredentials', { deviceId, credentials }).pipe(
      map(response => response.credentials)
    );
  }

  /**
   * Delete device credentials
   */
  deleteDeviceCredentials(protocolId: string, deviceId: string): Observable<boolean> {
    return this.callOperation(protocolId, 'deleteDeviceCredentials', { deviceId }).pipe(
      map(response => response.success || true)
    );
  }

  /**
   * Claim device
   */
  claimDevice(protocolId: string, deviceName: string, secretKey: string): Observable<Device> {
    return this.callOperation(protocolId, 'claimDevice', { deviceName, secretKey }).pipe(
      map(response => response.device)
    );
  }

  /**
   * Re-claim device
   */
  reclaimDevice(protocolId: string, deviceId: string): Observable<Device> {
    return this.callOperation(protocolId, 'reclaimDevice', { deviceId }).pipe(
      map(response => response.device)
    );
  }

  /**
   * Get protocol state information
   */
  getProtocolState(protocolId: string): Observable<any> {
    return this.getAuthToken().pipe(
      switchMap(token => {
        return this.http.get(
          `${this.NPL_ENGINE_URL}/api/protocol/${protocolId}/state`,
          { headers: this.createHeaders(token) }
        );
      })
    );
  }

  /**
   * Listen to protocol notifications
   */
  subscribeToNotifications(protocolId: string): Observable<any> {
    return this.getAuthToken().pipe(
      switchMap(token => {
        // For now, return empty observable - we'll implement EventSource later
        return new Observable(observer => {
          // EventSource implementation would go here
          // const eventSource = new EventSource(
          //   `${this.NPL_ENGINE_URL}/api/protocol/${protocolId}/notifications`,
          //   { headers: { Authorization: `Bearer ${token}` } }
          // );
          
          setTimeout(() => observer.complete(), 1000); // Placeholder
        });
      })
    );
  }
} 