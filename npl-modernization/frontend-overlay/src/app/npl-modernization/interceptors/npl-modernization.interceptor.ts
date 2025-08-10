import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RequestTransformerService } from '../services/request-transformer.service';
import { getNplFeatureFlags } from '../config/feature-flags';
import { matchModernizationRoute } from '../config/modernization-routes';

@Injectable()
export class NplModernizationInterceptor implements HttpInterceptor {

  constructor(private transformer: RequestTransformerService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const flags = getNplFeatureFlags();
    
    // If NPL interceptor is disabled, pass everything through to ThingsBoard
    if (!flags.enableInterceptor) {
      if (flags.enableLogging) {
        console.log(`🔕 NPL Interceptor disabled - passing through: ${req.method} ${req.url}`);
      }
      return next.handle(req);
    }

    // Check if this request matches any modernization routes
    const route = matchModernizationRoute(req);
    if (!route) {
      if (flags.enableLogging) {
        console.log(`➡️ No modernization route match - passing through: ${req.method} ${req.url}`);
      }
      return next.handle(req);
    }

    // Route based on operation type
    if (route.operation === 'read' && flags.enableGraphQL) {
      if (flags.enableLogging) {
        console.log(`🔄 Routing ${route.feature} READ request to GraphQL: ${req.method} ${req.url}`);
      }
      
      return this.transformer.transformToGraphQL(req).pipe(
        catchError(error => {
          if (flags.enableLogging) {
            console.error('GraphQL transformation failed, falling back to ThingsBoard:', error);
          }
          return next.handle(req);
        })
      );
    }

    if (route.operation === 'write' && flags.enableNplEngine) {
      if (flags.enableLogging) {
        console.log(`🔄 Routing ${route.feature} WRITE request to NPL: ${req.method} ${req.url}`);
      }
      
      return this.transformer.transformToNPL(req).pipe(
        catchError(error => {
          if (flags.enableLogging) {
            console.error('NPL transformation failed, falling back to ThingsBoard:', error);
          }
          return next.handle(req);
        })
      );
    }

    // For all other requests, pass through to ThingsBoard unchanged
    if (flags.enableLogging) {
      console.log(`➡️ Passing through to ThingsBoard: ${req.method} ${req.url}`);
    }
    return next.handle(req);
  }
}