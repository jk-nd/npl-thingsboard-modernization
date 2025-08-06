import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TenantData, Tenant, TenantInfo, TenantLimits } from './tenant-graphql.service';
import { map } from 'rxjs/operators';

export interface BulkImportResult {
  successCount: number;
  failureCount: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TenantNplService {

  private readonly baseUrl = '/api/npl';

  constructor(private http: HttpClient) {}

  /**
   * Create a new tenant (WRITE operation)
   */
  createTenant(tenantData: TenantData): Observable<Tenant> {
    return this.http.post<Tenant>(`${this.baseUrl}/tenantManagement.TenantManagement/createTenant`, {
      tenantData,
      party: this.getCurrentParty()
    });
  }

  /**
   * Update an existing tenant (WRITE operation)
   */
  updateTenant(id: string, tenantData: TenantData): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.baseUrl}/tenantManagement.TenantManagement/updateTenant`, {
      id,
      tenantData,
      party: this.getCurrentParty()
    });
  }

  /**
   * Delete a tenant (WRITE operation)
   */
  deleteTenant(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenantManagement.TenantManagement/deleteTenant`, {
      body: {
        id,
        party: this.getCurrentParty()
      }
    });
  }

  /**
   * Bulk import tenants (WRITE operation)
   */
  bulkImportTenants(tenantDataList: TenantData[]): Observable<BulkImportResult> {
    return this.http.post<BulkImportResult>(`${this.baseUrl}/tenantManagement.TenantManagement/bulkImportTenants`, {
      tenantDataList,
      party: this.getCurrentParty()
    });
  }

  /**
   * Bulk delete tenants (WRITE operation)
   */
  bulkDeleteTenants(tenantIds: string[]): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/tenantManagement.TenantManagement/bulkDeleteTenants`, {
      tenantIds,
      party: this.getCurrentParty()
    });
  }

  /**
   * Initialize the tenant management protocol
   */
  initializeProtocol(): Observable<string> {
    return this.http.post<{ protocolId: string }>(`${this.baseUrl}/protocol/instantiate`, {
      protocolName: 'tenantManagement.TenantManagement',
      party: this.getCurrentParty()
    }).pipe(
      map(response => response.protocolId)
    );
  }

  /**
   * Get current party (user) information
   */
  private getCurrentParty(): any {
    // This should be implemented based on your authentication system
    // For now, returning a default system admin party
    return {
      entity: { email: ['sysadmin@thingsboard.org'] },
      access: {}
    };
  }
} 