import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { matchModernizationRoute } from '../config/modernization-routes';
import { RequestTransformerService } from './request-transformer.service';
import { getNplFeatureFlags } from '../config/feature-flags';

@Injectable({
  providedIn: 'root'
})
export class HttpInterceptorPatcherService {
  private originalHttpRequest: any;
  private isPatched = false;

  constructor(private transformer: RequestTransformerService) {}

  patchHttpClient() {
    if (this.isPatched) return;

    const flags = getNplFeatureFlags();
    if (!flags.enableInterceptor) {
      console.log('🔕 NPL HTTP Patcher disabled');
      return;
    }

    try {
      // Find ThingsBoard's HttpClient instance
      const tbHttpClient = this.findThingsBoardHttpClient();
      if (!tbHttpClient) {
        console.warn('❌ Could not find ThingsBoard HttpClient to patch');
        return;
      }

      // Store original request method
      this.originalHttpRequest = tbHttpClient.request.bind(tbHttpClient);

      // Patch the request method
      tbHttpClient.request = this.createPatchedRequest(tbHttpClient);
      
      this.isPatched = true;
      console.log('✅ Successfully patched ThingsBoard HttpClient for NPL routing');
      
    } catch (error) {
      console.error('❌ Failed to patch HttpClient:', error);
    }
  }

  private findThingsBoardHttpClient(): any {
    // Try multiple ways to find the HttpClient instance
    
    // Method 1: Check if there's a global reference
    if ((window as any).tbHttpClient) {
      return (window as any).tbHttpClient;
    }

    // Method 2: Look for Angular injector and get HttpClient
    if ((window as any).ng && (window as any).ng.core) {
      try {
        const rootElement = document.querySelector('tb-root, app-root');
        if (rootElement) {
          const injector = (window as any).ng.core.getInjector(rootElement);
          const httpClient = injector.get('HttpClient');
          return httpClient;
        }
      } catch (e) {
        console.debug('Could not get HttpClient from Angular injector:', e);
      }
    }

    // Method 3: Look for existing HTTP requests in network tab and hook into them
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    
    // This is a fallback - we'll intercept at the XMLHttpRequest level
    return {
      request: (req: any) => {
        // This will be our fallback interceptor
        return this.interceptXMLHttpRequest(req);
      }
    };
  }

  private createPatchedRequest(originalHttpClient: any) {
    return (req: HttpRequest<any> | string, ...args: any[]): Observable<any> => {
      // Normalize the request
      let httpRequest: HttpRequest<any>;
      
      if (typeof req === 'string') {
        // Handle string URL requests
        const method = args[0]?.method || 'GET';
        httpRequest = new HttpRequest(method, req, args[0]?.body, args[0]);
      } else {
        httpRequest = req;
      }

      const flags = getNplFeatureFlags();

      if (flags.enableLogging) {
        console.log(`🔍 Checking request: ${httpRequest.method} ${httpRequest.url}`);
      }

      // Check if this request should be routed to NPL
      const route = matchModernizationRoute(httpRequest);
      
      if (!route) {
        if (flags.enableLogging) {
          console.log(`➡️ No modernization route match - passing through: ${httpRequest.method} ${httpRequest.url}`);
        }
        return this.originalHttpRequest(req, ...args);
      }

      if (flags.enableLogging) {
        console.log(`🔄 Routing ${route.feature} ${route.operation.toUpperCase()} request to ${route.operation === 'read' ? 'GraphQL' : 'NPL'}: ${httpRequest.method} ${httpRequest.url}`);
      }

      // Route based on operation type
      if (route.operation === 'read' && flags.enableGraphQL) {
        return this.transformer.transformToGraphQL(httpRequest).pipe(
          catchError(error => {
            if (flags.enableLogging) {
              console.error('GraphQL transformation failed, falling back to ThingsBoard:', error);
            }
            return this.originalHttpRequest(req, ...args);
          })
        );
      }

      if (route.operation === 'write' && flags.enableNplEngine) {
        return this.transformer.transformToNPL(httpRequest).pipe(
          catchError(error => {
            if (flags.enableLogging) {
              console.error('NPL transformation failed, falling back to ThingsBoard:', error);
            }
            return this.originalHttpRequest(req, ...args);
          })
        );
      }

      // Fallback to original request
      if (flags.enableLogging) {
        console.log(`➡️ Passing through to ThingsBoard: ${httpRequest.method} ${httpRequest.url}`);
      }
      return this.originalHttpRequest(req, ...args);
    };
  }

  private interceptXMLHttpRequest(req: any): Observable<any> {
    // This is a fallback method if we can't patch HttpClient directly
    // We'll use XMLHttpRequest interception
    console.log('Using XMLHttpRequest interception fallback');
    
    return new Observable(observer => {
      const xhr = new XMLHttpRequest();
      const method = req.method || 'GET';
      const url = req.url;
      
      xhr.open(method, url, true);
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            observer.next(new HttpResponse({
              body: response,
              status: xhr.status,
              statusText: xhr.statusText,
              url: url
            }));
          } catch (e) {
            observer.next(new HttpResponse({
              body: xhr.responseText,
              status: xhr.status,
              statusText: xhr.statusText,
              url: url
            }));
          }
        } else {
          observer.error(new HttpErrorResponse({
            status: xhr.status,
            statusText: xhr.statusText,
            url: url
          }));
        }
        observer.complete();
      };

      xhr.onerror = () => {
        observer.error(new HttpErrorResponse({
          status: xhr.status,
          statusText: xhr.statusText,
          url: url
        }));
      };

      if (req.body) {
        xhr.send(JSON.stringify(req.body));
      } else {
        xhr.send();
      }
    });
  }

  unpatch() {
    if (!this.isPatched || !this.originalHttpRequest) return;

    try {
      const tbHttpClient = this.findThingsBoardHttpClient();
      if (tbHttpClient && this.originalHttpRequest) {
        tbHttpClient.request = this.originalHttpRequest;
        this.isPatched = false;
        console.log('✅ Successfully unpatched ThingsBoard HttpClient');
      }
    } catch (error) {
      console.error('❌ Failed to unpatch HttpClient:', error);
    }
  }
}
