import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { getNplFeatureFlags } from '../config/feature-flags';

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isActive: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceWorkerManagerService {
  private statusSubject = new BehaviorSubject<ServiceWorkerStatus>({
    isSupported: false,
    isRegistered: false,
    isActive: false
  });

  public status$ = this.statusSubject.asObservable();

  constructor() {
    this.checkServiceWorkerSupport();
  }

  private checkServiceWorkerSupport(): void {
    const isSupported = 'serviceWorker' in navigator;
    
    this.updateStatus({
      isSupported,
      isRegistered: false,
      isActive: false,
      error: isSupported ? undefined : 'Service Workers not supported in this browser'
    });

    if (isSupported) {
      this.checkExistingRegistration();
    }
  }

  private async checkExistingRegistration(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        this.updateStatus({
          isSupported: true,
          isRegistered: true,
          isActive: registration.active !== null
        });

        // Listen for state changes
        this.setupRegistrationListeners(registration);
      }
    } catch (error) {
      console.error('Error checking service worker registration:', error);
    }
  }

  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    const flags = getNplFeatureFlags();
    
    if (!flags.enableInterceptor) {
      this.log('🔕 NPL Service Worker disabled by feature flag');
      return null;
    }

    if (!this.statusSubject.value.isSupported) {
      const error = 'Service Workers not supported in this browser';
      this.updateStatus({ ...this.statusSubject.value, error });
      throw new Error(error);
    }

    try {
      this.log('🚀 Registering NPL Service Worker...');

      const registration = await navigator.serviceWorker.register('/npl-service-worker.js', {
        scope: '/'
      });

      this.log('✅ NPL Service Worker registered successfully');

      this.updateStatus({
        isSupported: true,
        isRegistered: true,
        isActive: registration.active !== null
      });

      this.setupRegistrationListeners(registration);

      // If there's a waiting service worker, activate it immediately
      if (registration.waiting) {
        this.log('📤 Activating waiting service worker...');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        this.log('🔄 Service Worker update found');
        
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.log('🆕 New Service Worker installed, will activate on next page load');
            }
          });
        }
      });

      return registration;

    } catch (error) {
      const errorMessage = `Failed to register service worker: ${error instanceof Error ? error.message : String(error)}`;
      this.log(`❌ ${errorMessage}`);
      
      this.updateStatus({
        isSupported: true,
        isRegistered: false,
        isActive: false,
        error: errorMessage
      });
      
      throw error;
    }
  }

  async unregisterServiceWorker(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        const unregistered = await registration.unregister();
        
        if (unregistered) {
          this.log('✅ NPL Service Worker unregistered');
          this.updateStatus({
            isSupported: true,
            isRegistered: false,
            isActive: false
          });
        }
        
        return unregistered;
      }
      
      return true;
    } catch (error) {
      this.log(`❌ Failed to unregister service worker: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private setupRegistrationListeners(registration: ServiceWorkerRegistration): void {
    // Listen for service worker state changes
    if (registration.installing) {
      this.trackWorkerState(registration.installing, 'installing');
    }
    
    if (registration.waiting) {
      this.trackWorkerState(registration.waiting, 'waiting');
    }
    
    if (registration.active) {
      this.trackWorkerState(registration.active, 'active');
    }

    // Listen for controller changes (when new SW takes control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.log('🔄 Service Worker controller changed');
      this.updateStatus({
        ...this.statusSubject.value,
        isActive: true
      });
    });

    // Listen for messages from the service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });
  }

  private trackWorkerState(worker: ServiceWorker, workerType: string): void {
    worker.addEventListener('statechange', () => {
      this.log(`📡 Service Worker (${workerType}) state: ${worker.state}`);
      
      const isActive = worker.state === 'activated' || worker.state === 'redundant';
      this.updateStatus({
        ...this.statusSubject.value,
        isActive
      });
    });
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const data = event.data;
    
    if (data && data.type) {
      switch (data.type) {
        case 'NPL_ROUTE_SUCCESS':
          this.log(`✅ NPL routing success: ${data.route}`);
          break;
          
        case 'NPL_ROUTE_ERROR':
          this.log(`❌ NPL routing error: ${data.error}`);
          break;
          
        case 'NPL_FALLBACK':
          this.log(`⚠️ NPL fallback: ${data.reason}`);
          break;
          
        default:
          this.log(`📨 Service Worker message: ${data.type}`);
      }
    }
  }

  sendMessageToServiceWorker(message: any): void {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    } else {
      this.log('⚠️ No active service worker to send message to');
    }
  }

  getStatus(): ServiceWorkerStatus {
    return this.statusSubject.value;
  }

  isReady(): boolean {
    const status = this.statusSubject.value;
    return status.isSupported && status.isRegistered && status.isActive && !status.error;
  }

  private updateStatus(status: ServiceWorkerStatus): void {
    this.statusSubject.next(status);
  }

  private log(message: string): void {
    const flags = getNplFeatureFlags();
    if (flags.enableLogging) {
      console.log(`[NPL SW Manager] ${message}`);
    }
  }

  // Utility method to force refresh when new SW is available
  async forceRefreshForUpdate(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (registration && registration.waiting) {
      // Tell the waiting service worker to skip waiting and become active
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload the page to use the new service worker
      window.location.reload();
    }
  }
}
