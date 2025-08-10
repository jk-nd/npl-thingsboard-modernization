import { NgModule, APP_INITIALIZER } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ApolloModule, APOLLO_OPTIONS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache } from '@apollo/client/core';

import { NplModernizationInterceptor } from './npl-modernization/interceptors/npl-modernization.interceptor';
import { DeviceModernizationInterceptor } from './npl-modernization/interceptors/device-modernization.interceptor';
import { TenantModernizationInterceptor } from './npl-modernization/interceptors/tenant-modernization.interceptor';
import { GraphQLConfigService } from './npl-modernization/config/apollo.config';
import { ServiceWorkerManagerService } from './npl-modernization/services/service-worker-manager.service';

function initializeServiceWorker(swManager: ServiceWorkerManagerService) {
  // Force inclusion of ServiceWorkerManagerService in the bundle
  console.log('🚀 Initializing NPL Service Worker Manager:', swManager.constructor.name);
  
  return () => {
    // Add a small delay to ensure ThingsBoard is fully loaded
    setTimeout(async () => {
      try {
        console.log('🔄 Starting Service Worker registration...');
        await swManager.registerServiceWorker();
        console.log('🎉 NPL Service Worker ready for request interception');
      } catch (error) {
        console.error('❌ Failed to initialize NPL Service Worker:', error);
      }
    }, 1000);
  };
}

@NgModule({
  imports: [HttpClientModule, ApolloModule],
  providers: [
    GraphQLConfigService,
    ServiceWorkerManagerService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeServiceWorker,
      deps: [ServiceWorkerManagerService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: NplModernizationInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DeviceModernizationInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TenantModernizationInterceptor,
      multi: true
    },
    {
      provide: APOLLO_OPTIONS,
      deps: [HttpLink],
      useFactory: (httpLink: HttpLink) => ({
        cache: new InMemoryCache(),
        link : httpLink.create({ uri: '/api/graphql' })
      })
    }
  ]
})
export class OverlayModule {
  constructor(private swManager: ServiceWorkerManagerService) {
    // Force Service Worker registration on module construction
    console.log('🏗️ OverlayModule constructor - forcing SW registration');
    setTimeout(() => {
      this.swManager.registerServiceWorker().then(
        () => console.log('✅ Service Worker registered from constructor'),
        (error) => console.error('❌ Service Worker registration failed from constructor:', error)
      );
    }, 1500);
  }
}

// Direct Service Worker registration as a backup
declare global {
  interface Window {
    nplOverlayBootstrap: any;
  }
}

// Override the bootstrap function to add direct Service Worker registration
setTimeout(() => {
  const originalBootstrap = window.nplOverlayBootstrap;
  window.nplOverlayBootstrap = (injector: any) => {
    console.log('🎯 NPL Overlay Bootstrap intercepted - registering Service Worker directly');
    
    // Register Service Worker directly
    if ('serviceWorker' in navigator) {
      setTimeout(async () => {
        try {
          console.log('🔄 Registering Service Worker from bootstrap override...');
          const registration = await navigator.serviceWorker.register('/npl-service-worker.js', { scope: '/' });
          console.log('✅ Service Worker registered successfully from bootstrap override:', registration);
        } catch (error) {
          console.error('❌ Service Worker registration failed from bootstrap override:', error);
        }
      }, 2000);
    } else {
      console.warn('⚠️ Service Workers not supported in this browser');
    }
    
    // Call original bootstrap
    if (originalBootstrap) {
      originalBootstrap(injector);
    }
  };
}, 100);