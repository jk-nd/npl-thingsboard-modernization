import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { TenantNplService } from '../services/tenant-npl.service';
import { TenantGraphQLService } from '../services/tenant-graphql.service';
import { map } from 'rxjs/operators';

@Injectable()
export class TenantModernizationInterceptor implements HttpInterceptor {

  constructor(
    private tenantNplService: TenantNplService,
    private tenantGraphQLService: TenantGraphQLService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    // Route based on endpoint patterns
    if (this.isTenantWriteOperation(req)) {
      return this.routeToNplEngine(req, next);
    } else if (this.isTenantReadOperation(req)) {
      return this.routeToGraphQL(req, next);
    } else {
      return next.handle(req); // Default to ThingsBoard
    }
  }

  /**
   * Check if this is a tenant write operation that should go to NPL Engine
   */
  private isTenantWriteOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    const method = req.method;

    if (method === 'GET') return false;

    const writePatterns = [
      { pattern: /^\/api\/tenant$/, methods: ['POST', 'PUT'] },
      { pattern: /^\/api\/tenant\/([^\/]+)$/, methods: ['DELETE'] },
      { pattern: /^\/api\/tenants\/bulk$/, methods: ['POST'] },
      { pattern: /^\/api\/tenants\/bulk\/delete$/, methods: ['POST'] }
    ];

    return writePatterns.some(endpoint => 
      endpoint.pattern.test(url) && endpoint.methods.includes(method)
    );
  }

  /**
   * Check if this is a tenant read operation that should go to GraphQL
   */
  private isTenantReadOperation(req: HttpRequest<any>): boolean {
    const url = req.url;
    const method = req.method;

    if (method !== 'GET') return false;

    const readPatterns = [
      /^\/api\/tenant\/([^\/]+)$/,                    // GET /api/tenant/{id}
      /^\/api\/tenant\/info\/([^\/]+)$/,              // GET /api/tenant/info/{id}
      /^\/api\/tenants$/,                             // GET /api/tenants (with params)
      /^\/api\/tenantInfos$/                          // GET /api/tenantInfos (with params)
    ];

    return readPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Route tenant write operations to NPL Engine
   */
  private routeToNplEngine(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url;
    const method = req.method;
    const body = req.body;

    if (method === 'POST' && url === '/api/tenant') {
      // Create tenant
      return this.tenantNplService.createTenant(body).pipe(
        map(tenant => new HttpResponse({ body: tenant }))
      );
    } else if (method === 'PUT' && url.match(/^\/api\/tenant\/([^\/]+)$/)) {
      // Update tenant
      const id = url.split('/').pop();
      if (!id) {
        return next.handle(req);
      }
      return this.tenantNplService.updateTenant(id, body).pipe(
        map(tenant => new HttpResponse({ body: tenant }))
      );
    } else if (method === 'DELETE' && url.match(/^\/api\/tenant\/([^\/]+)$/)) {
      // Delete tenant
      const id = url.split('/').pop();
      if (!id) {
        return next.handle(req);
      }
      return this.tenantNplService.deleteTenant(id).pipe(
        map(() => new HttpResponse({ status: 200 }))
      );
    } else if (method === 'POST' && url === '/api/tenants/bulk') {
      // Bulk import tenants
      return this.tenantNplService.bulkImportTenants(body).pipe(
        map(result => new HttpResponse({ body: result }))
      );
    } else if (method === 'POST' && url === '/api/tenants/bulk/delete') {
      // Bulk delete tenants
      return this.tenantNplService.bulkDeleteTenants(body.tenantIds).pipe(
        map(deletedCount => new HttpResponse({ body: { deletedCount } }))
      );
    }

    // Fallback to ThingsBoard
    return next.handle(req);
  }

  /**
   * Route tenant read operations to GraphQL
   */
  private routeToGraphQL(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url;
    const params = new URLSearchParams(req.params.toString());

    if (url.match(/^\/api\/tenant\/([^\/]+)$/)) {
      // Get tenant by ID
      const id = url.split('/').pop();
      if (!id) {
        return next.handle(req);
      }
      return this.tenantGraphQLService.getTenant(id).pipe(
        map(tenant => new HttpResponse({ body: tenant }))
      );
    } else if (url.match(/^\/api\/tenant\/info\/([^\/]+)$/)) {
      // Get tenant info by ID
      const id = url.split('/').pop();
      if (!id) {
        return next.handle(req);
      }
      return this.tenantGraphQLService.getTenantInfo(id).pipe(
        map(tenantInfo => new HttpResponse({ body: tenantInfo }))
      );
    } else if (url === '/api/tenants') {
      // Get tenants with pagination
      const pageSize = parseInt(params.get('pageSize') || '10');
      const page = parseInt(params.get('page') || '0');
      return this.tenantGraphQLService.getTenantsPaginated(pageSize, page).pipe(
        map(pageData => new HttpResponse({ body: pageData }))
      );
    } else if (url === '/api/tenantInfos') {
      // Get tenant infos with pagination
      const pageSize = parseInt(params.get('pageSize') || '10');
      const page = parseInt(params.get('page') || '0');
      return this.tenantGraphQLService.getTenantInfosPaginated(pageSize, page).pipe(
        map(pageData => new HttpResponse({ body: pageData }))
      );
    }

    // Fallback to ThingsBoard
    return next.handle(req);
  }
} 