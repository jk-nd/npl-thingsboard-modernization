import { HttpRequest } from '@angular/common/http';

export interface ModernizationRoute {
  pattern: RegExp;
  methods: string[];
  feature: 'device' | 'tenant' | string;
  operation: 'read' | 'write';
}

export const MODERNIZATION_ROUTES: ModernizationRoute[] = [
  // Device routes
  { pattern: /^\/api\/device$/, methods: ['POST'], feature: 'device', operation: 'write' },
  { pattern: /^\/api\/device\/([^\/]+)$/, methods: ['PUT', 'DELETE'], feature: 'device', operation: 'write' },
  { pattern: /^\/api\/device\/([^\/]+)\/credentials$/, methods: ['POST', 'PUT', 'DELETE'], feature: 'device', operation: 'write' },
  { pattern: /^\/api\/device\/([^\/]+)\/(assign|unassign)$/, methods: ['POST'], feature: 'device', operation: 'write' },
  { pattern: /^\/api\/devices\/bulk$/, methods: ['POST'], feature: 'device', operation: 'write' },
  { pattern: /^\/api\/devices\/bulk\/delete$/, methods: ['POST'], feature: 'device', operation: 'write' },
  { pattern: /^\/api\/devices$/, methods: ['GET'], feature: 'device', operation: 'read' },
  { pattern: /^\/api\/device\/([^\/]+)$/, methods: ['GET'], feature: 'device', operation: 'read' },
  { pattern: /^\/api\/device\/info\/([^\/]+)$/, methods: ['GET'], feature: 'device', operation: 'read' },
  { pattern: /^\/api\/customer\/([^\/]+)\/devices$/, methods: ['GET'], feature: 'device', operation: 'read' },
  { pattern: /^\/api\/tenant\/([^\/]+)\/devices$/, methods: ['GET'], feature: 'device', operation: 'read' },

  // Tenant routes
  { pattern: /^\/api\/tenant$/, methods: ['POST'], feature: 'tenant', operation: 'write' },
  { pattern: /^\/api\/tenant\/([^\/]+)$/, methods: ['PUT', 'DELETE'], feature: 'tenant', operation: 'write' },
  { pattern: /^\/api\/tenants\/bulk$/, methods: ['POST'], feature: 'tenant', operation: 'write' },
  { pattern: /^\/api\/tenants\/bulk\/delete$/, methods: ['POST'], feature: 'tenant', operation: 'write' },
  { pattern: /^\/api\/tenants$/, methods: ['GET'], feature: 'tenant', operation: 'read' },
  { pattern: /^\/api\/tenant\/([^\/]+)$/, methods: ['GET'], feature: 'tenant', operation: 'read' },
  { pattern: /^\/api\/tenant\/info\/([^\/]+)$/, methods: ['GET'], feature: 'tenant', operation: 'read' },

  // Device credentials routes
  { pattern: /^\/api\/device\/([^\/]+)\/credentials$/, methods: ['GET'], feature: 'device', operation: 'read' },
  { pattern: /^\/api\/device\/([^\/]+)\/claim$/, methods: ['POST'], feature: 'device', operation: 'write' },
  { pattern: /^\/api\/device\/([^\/]+)\/reclaim$/, methods: ['POST'], feature: 'device', operation: 'write' }
];

export function matchModernizationRoute(request: HttpRequest<any>): ModernizationRoute | null {
  const url = extractUrlPath(request.url);
  const method = request.method;

  return MODERNIZATION_ROUTES.find(route => 
    route.pattern.test(url) && route.methods.includes(method)
  ) || null;
}

function extractUrlPath(url: string): string {
  // Remove query parameters and base URL
  try {
    const urlObj = new URL(url, 'http://localhost');
    return urlObj.pathname;
  } catch {
    // If URL parsing fails, assume it's already a path
    return url.split('?')[0];
  }
}