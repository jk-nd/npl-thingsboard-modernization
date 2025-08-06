/**
 * Tenant Management Modernization Overlay
 * Injected by Nginx to enable NPL modernization features
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    NPL_ENGINE_URL: '/api/npl',
    GRAPHQL_URL: '/api/graphql',
    THINGSBOARD_URL: '/api',
    ENABLED_FEATURES: ['tenant-management', 'device-management'],
    DEBUG: true
  };

  // Feature flags
  const FEATURES = {
    'tenant-management': {
      enabled: true,
      writeOperations: ['POST /api/tenant', 'PUT /api/tenant', 'DELETE /api/tenant', 'POST /api/tenants/bulk', 'POST /api/tenants/bulk/delete'],
      readOperations: ['GET /api/tenant', 'GET /api/tenants', 'GET /api/tenant/info', 'GET /api/tenantInfos']
    },
    'device-management': {
      enabled: true,
      writeOperations: ['POST /api/device', 'PUT /api/device', 'DELETE /api/device', 'POST /api/devices/bulk'],
      readOperations: ['GET /api/device', 'GET /api/devices', 'GET /api/device/info']
    }
  };

  // Utility functions
  const Utils = {
    log: function(message, data = null) {
      if (CONFIG.DEBUG) {
        console.log(`[Tenant Overlay] ${message}`, data);
      }
    },

    isFeatureEnabled: function(feature) {
      return FEATURES[feature] && FEATURES[feature].enabled;
    },

    getCurrentUser: function() {
      // Extract user info from ThingsBoard context
      const userElement = document.querySelector('[data-user]');
      if (userElement) {
        return JSON.parse(userElement.dataset.user);
      }
      return null;
    },

    getCurrentTenant: function() {
      // Extract tenant info from ThingsBoard context
      const tenantElement = document.querySelector('[data-tenant]');
      if (tenantElement) {
        return JSON.parse(tenantElement.dataset.tenant);
      }
      return null;
    }
  };

  // HTTP Interceptor for tenant operations
  class TenantHttpInterceptor {
    constructor() {
      this.originalFetch = window.fetch;
      this.originalXHROpen = XMLHttpRequest.prototype.open;
      this.originalXHRSend = XMLHttpRequest.prototype.send;
      this.init();
    }

    init() {
      if (!Utils.isFeatureEnabled('tenant-management')) {
        Utils.log('Tenant management feature disabled');
        return;
      }

      this.interceptFetch();
      this.interceptXHR();
      Utils.log('Tenant HTTP interceptor initialized');
    }

    interceptFetch() {
      window.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = init.method || 'GET';

        if (this.shouldIntercept(url, method)) {
          return this.handleInterceptedRequest(url, method, init.body);
        }

        return this.originalFetch(input, init);
      };
    }

    interceptXHR() {
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._method = method;
        this._url = url;
        this.originalOpen.apply(this, [method, url, ...args]);
      };

      XMLHttpRequest.prototype.send = function(data) {
        if (this._url && this._method && this.shouldIntercept(this._url, this._method)) {
          this.handleInterceptedXHRRequest(this._url, this._method, data);
        } else {
          this.originalSend.call(this, data);
        }
      };
    }

    shouldIntercept(url, method) {
      const tenantPatterns = [
        /\/api\/tenant$/,
        /\/api\/tenant\/[^\/]+$/,
        /\/api\/tenants$/,
        /\/api\/tenantInfos$/,
        /\/api\/tenants\/bulk$/,
        /\/api\/tenants\/bulk\/delete$/
      ];

      return tenantPatterns.some(pattern => pattern.test(url));
    }

    async handleInterceptedRequest(url, method, body) {
      Utils.log(`Intercepting tenant request: ${method} ${url}`);

      try {
        if (method === 'GET') {
          // Route to GraphQL for reads
          return await this.routeToGraphQL(url);
        } else {
          // Route to NPL Engine for writes
          return await this.routeToNplEngine(url, method, body);
        }
      } catch (error) {
        Utils.log('Error handling intercepted request:', error);
        throw error;
      }
    }

    async routeToGraphQL(url) {
      // Transform REST URL to GraphQL query
      const graphqlQuery = this.transformToGraphQL(url);
      
      const response = await this.originalFetch(CONFIG.GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader()
        },
        body: JSON.stringify({
          query: graphqlQuery
        })
      });

      const data = await response.json();
      return new Response(JSON.stringify(data.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    async routeToNplEngine(url, method, body) {
      // Transform to NPL Engine format
      const nplRequest = this.transformToNplRequest(url, method, body);
      
      const response = await this.originalFetch(CONFIG.NPL_ENGINE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader()
        },
        body: JSON.stringify(nplRequest)
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    transformToGraphQL(url) {
      // Transform REST endpoints to GraphQL queries
      if (url.match(/\/api\/tenant\/[^\/]+$/)) {
        const id = url.split('/').pop();
        return `
          query GetTenant($id: ID!) {
            tenant(id: $id) {
              id
              name
              title
              region
              country
              stateName
              city
              address
              address2
              zip
              phone
              email
              limits {
                maxUsers
                maxDevices
                maxAssets
                maxCustomers
              }
              createdTime
              additionalInfo
            }
          }
        `;
      } else if (url === '/api/tenants') {
        return `
          query GetTenants {
            tenants {
              id
              name
              title
              region
              country
              stateName
              city
              address
              address2
              zip
              phone
              email
              limits {
                maxUsers
                maxDevices
                maxAssets
                maxCustomers
              }
              createdTime
              additionalInfo
            }
          }
        `;
      }
      
      return '';
    }

    transformToNplRequest(url, method, body) {
      const user = Utils.getCurrentUser();
      
      if (method === 'POST' && url === '/api/tenant') {
        return {
          protocolName: 'tenantManagement.TenantManagement',
          method: 'createTenant',
          party: {
            entity: { email: [user.email] },
            access: {}
          },
          parameters: {
            tenantData: JSON.parse(body)
          }
        };
      } else if (method === 'PUT' && url.match(/\/api\/tenant\/[^\/]+$/)) {
        const id = url.split('/').pop();
        return {
          protocolName: 'tenantManagement.TenantManagement',
          method: 'updateTenant',
          party: {
            entity: { email: [user.email] },
            access: {}
          },
          parameters: {
            id: id,
            tenantData: JSON.parse(body)
          }
        };
      } else if (method === 'DELETE' && url.match(/\/api\/tenant\/[^\/]+$/)) {
        const id = url.split('/').pop();
        return {
          protocolName: 'tenantManagement.TenantManagement',
          method: 'deleteTenant',
          party: {
            entity: { email: [user.email] },
            access: {}
          },
          parameters: {
            id: id
          }
        };
      }
      
      return {};
    }

    getAuthHeader() {
      // Get auth token from ThingsBoard context
      const token = localStorage.getItem('tb.auth.token') || 
                   sessionStorage.getItem('tb.auth.token') ||
                   document.querySelector('meta[name="auth-token"]')?.content;
      
      return token ? `Bearer ${token}` : '';
    }
  }

  // UI Enhancement for tenant management
  class TenantUIEnhancer {
    constructor() {
      this.init();
    }

    init() {
      if (!Utils.isFeatureEnabled('tenant-management')) {
        return;
      }

      this.enhanceTenantForms();
      this.enhanceTenantTables();
      this.addModernizationIndicators();
      Utils.log('Tenant UI enhancer initialized');
    }

    enhanceTenantForms() {
      // Add validation and real-time feedback
      const forms = document.querySelectorAll('form[data-entity="tenant"]');
      forms.forEach(form => {
        this.addFormValidation(form);
        this.addRealTimeFeedback(form);
      });
    }

    enhanceTenantTables() {
      // Add bulk operations and enhanced filtering
      const tables = document.querySelectorAll('table[data-entity="tenant"]');
      tables.forEach(table => {
        this.addBulkOperations(table);
        this.addEnhancedFiltering(table);
      });
    }

    addModernizationIndicators() {
      // Add visual indicators for NPL-modernized features
      const indicators = document.createElement('div');
      indicators.className = 'npl-modernization-indicators';
      indicators.innerHTML = `
        <div class="indicator tenant-modernized" title="Tenant management modernized with NPL">
          <span class="icon">⚡</span>
          <span class="text">NPL Modernized</span>
        </div>
      `;
      
      const header = document.querySelector('.tb-header');
      if (header) {
        header.appendChild(indicators);
      }
    }

    addFormValidation(form) {
      // Add client-side validation
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.addEventListener('blur', () => this.validateField(input));
        input.addEventListener('input', () => this.clearFieldError(input));
      });
    }

    addRealTimeFeedback(form) {
      // Add real-time feedback for form submissions
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
        
        try {
          const formData = new FormData(form);
          const response = await fetch(form.action, {
            method: form.method,
            body: formData
          });
          
          if (response.ok) {
            this.showSuccessMessage('Tenant operation completed successfully');
          } else {
            this.showErrorMessage('Operation failed. Please try again.');
          }
        } catch (error) {
          this.showErrorMessage('Network error. Please check your connection.');
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      });
    }

    addBulkOperations(table) {
      // Add bulk operation buttons
      const bulkContainer = document.createElement('div');
      bulkContainer.className = 'bulk-operations';
      bulkContainer.innerHTML = `
        <button class="btn btn-primary bulk-import" data-action="import">
          <i class="material-icons">file_upload</i>
          Bulk Import
        </button>
        <button class="btn btn-danger bulk-delete" data-action="delete">
          <i class="material-icons">delete_sweep</i>
          Bulk Delete
        </button>
      `;
      
      table.parentNode.insertBefore(bulkContainer, table);
    }

    addEnhancedFiltering(table) {
      // Add enhanced filtering capabilities
      const filterContainer = document.createElement('div');
      filterContainer.className = 'enhanced-filters';
      filterContainer.innerHTML = `
        <input type="text" placeholder="Search tenants..." class="search-input">
        <select class="filter-select">
          <option value="">All Regions</option>
          <option value="Global">Global</option>
          <option value="US">US</option>
          <option value="EU">EU</option>
        </select>
      `;
      
      table.parentNode.insertBefore(filterContainer, table);
    }

    validateField(field) {
      const value = field.value.trim();
      const fieldName = field.name;
      
      if (fieldName === 'name' && value.length === 0) {
        this.showFieldError(field, 'Tenant name is required');
      } else if (fieldName === 'email' && !this.isValidEmail(value)) {
        this.showFieldError(field, 'Please enter a valid email address');
      } else {
        this.clearFieldError(field);
      }
    }

    showFieldError(field, message) {
      this.clearFieldError(field);
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      errorDiv.textContent = message;
      errorDiv.style.color = 'red';
      errorDiv.style.fontSize = '12px';
      errorDiv.style.marginTop = '4px';
      
      field.parentNode.appendChild(errorDiv);
      field.classList.add('error');
    }

    clearFieldError(field) {
      const errorDiv = field.parentNode.querySelector('.field-error');
      if (errorDiv) {
        errorDiv.remove();
      }
      field.classList.remove('error');
    }

    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showSuccessMessage(message) {
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'notification success';
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    }

    showErrorMessage(message) {
      // Show error notification
      const notification = document.createElement('div');
      notification.className = 'notification error';
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  }

  // Initialize overlay when DOM is ready
  function initOverlay() {
    Utils.log('Initializing tenant management overlay');
    
    // Initialize HTTP interceptor
    new TenantHttpInterceptor();
    
    // Initialize UI enhancer
    new TenantUIEnhancer();
    
    Utils.log('Tenant management overlay initialized successfully');
  }

  // Start overlay when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay);
  } else {
    initOverlay();
  }

})(); 