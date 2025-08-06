import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DeviceData {
  id: string;
  name: string;
  type: string;
  label: string;
  additionalInfo: string;
  deviceProfileId: string;
  customerId?: string;
  createdTime: string;
}

export interface BulkImportResult {
  importedCount: number;
  failedCount: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DeviceNplService {
  private readonly nplEngineUrl = 'http://localhost:12000/api';

  constructor(private http: HttpClient) {}

  /**
   * Create a new device
   */
  createDevice(device: DeviceData): Observable<any> {
    return this.http.post(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/saveDevice`, device);
  }

  /**
   * Update an existing device
   */
  updateDevice(device: DeviceData): Observable<any> {
    return this.http.put(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/saveDevice`, device);
  }

  /**
   * Delete a device
   */
  deleteDevice(deviceId: string): Observable<any> {
    return this.http.delete(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/deleteDevice/${deviceId}`);
  }

  /**
   * Assign device to customer
   */
  assignDeviceToCustomer(deviceId: string, customerId: string): Observable<any> {
    return this.http.post(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/assignDeviceToCustomer`, {
      deviceId,
      customerId
    });
  }

  /**
   * Unassign device from customer
   */
  unassignDeviceFromCustomer(deviceId: string): Observable<any> {
    return this.http.post(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/unassignDeviceFromCustomer`, {
      deviceId
    });
  }

  /**
   * Bulk import devices
   */
  bulkImportDevices(devices: DeviceData[]): Observable<BulkImportResult> {
    return this.http.post<BulkImportResult>(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/bulkImportDevices`, {
      devices
    });
  }

  /**
   * Bulk delete devices
   */
  bulkDeleteDevices(deviceIds: string[]): Observable<{ deletedCount: number }> {
    return this.http.post<{ deletedCount: number }>(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/bulkDeleteDevices`, {
      deviceIds
    });
  }

  /**
   * Update device credentials
   */
  updateDeviceCredentials(deviceId: string, credentials: any): Observable<any> {
    return this.http.post(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/updateDeviceCredentials`, {
      deviceId,
      credentials
    });
  }

  /**
   * Validate device data
   */
  validateDevice(device: DeviceData): Observable<{ isValid: boolean; errors: string[] }> {
    return this.http.post<{ isValid: boolean; errors: string[] }>(`${this.nplEngineUrl}/deviceManagement.DeviceManagement/validateDevice`, device);
  }
} 