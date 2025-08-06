/**
 * Device Modernization Overlay Script
 * Injected by Nginx to transform REST calls to GraphQL/NPL
 */

(function() {
  'use strict';

  // Device HTTP Interceptor
  class DeviceHttpInterceptor {
    constructor() {
      this.setupInterception();
      console.log('🔧 Device HTTP Interceptor initialized');
    }

    setupInterception() {
      // Intercept fetch requests
      const originalFetch = window.fetch;
      window.fetch = async (url, options = {}) => {
        if (this.isDeviceRequest(url)) {
          return this.handleDeviceRequest(url, options);
        }
        return originalFetch(url, options);
      };

      // Intercept XMLHttpRequest
      const originalXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (window.deviceInterceptor && window.deviceInterceptor.isDeviceRequest(url)) {
          window.deviceInterceptor.handleXHRRequest(this, method, url, ...args);
        } else {
          originalXHROpen.call(this, method, url, ...args);
        }
      };
    }

    isDeviceRequest(url) {
      return url.includes('/api/device') || url.includes('/api/devices');
    }

    async handleDeviceRequest(url, options) {
      const method = options.method || 'GET';
      
      if (this.isWriteOperation(url, method)) {
        return this.routeToNplEngine(url, options);
      } else {
        return this.routeToGraphQL(url, options);
      }
    }

    isWriteOperation(url, method) {
      const writeMethods = ['POST', 'PUT', 'DELETE'];
      const writePatterns = [
        '/api/device',
        '/api/device/',
        '/api/devices/bulk',
        '/api/devices/bulk/delete'
      ];
      
      return writeMethods.includes(method) && 
             writePatterns.some(pattern => url.includes(pattern));
    }

    async routeToNplEngine(url, options) {
      const nplUrl = this.transformToNplUrl(url);
      console.log(`🔄 Device Overlay: Routing to NPL Engine: ${url} -> ${nplUrl}`);
      
      const nplOptions = {
        ...options,
        headers: {
          ...options.headers,
          'X-NPL-Modernization': 'device'
        }
      };

      try {
        const response = await fetch(nplUrl, nplOptions);
        console.log(`✅ Device NPL Engine Response: ${response.status}`);
        return response;
      } catch (error) {
        console.error(`❌ Device NPL Engine Error: ${error.message}`);
        throw error;
      }
    }

    async routeToGraphQL(url, options) {
      const graphqlUrl = this.transformToGraphQLUrl(url);
      console.log(`🔄 Device Overlay: Routing to GraphQL: ${url} -> ${graphqlUrl}`);
      
      const graphqlOptions = {
        ...options,
        headers: {
          ...options.headers,
          'X-GraphQL-Modernization': 'device'
        }
      };

      try {
        const response = await fetch(graphqlUrl, graphqlOptions);
        console.log(`✅ Device GraphQL Response: ${response.status}`);
        return response;
      } catch (error) {
        console.error(`❌ Device GraphQL Error: ${error.message}`);
        throw error;
      }
    }

    transformToNplUrl(originalUrl) {
      const nplBaseUrl = 'http://localhost:12000/api';
      
      if (originalUrl.includes('/api/device') && !originalUrl.includes('/api/devices')) {
        if (originalUrl.includes('/assign')) {
          return `${nplBaseUrl}/deviceManagement.DeviceManagement/assignDeviceToCustomer`;
        } else if (originalUrl.includes('/unassign')) {
          return `${nplBaseUrl}/deviceManagement.DeviceManagement/unassignDeviceFromCustomer`;
        } else if (originalUrl.includes('/credentials')) {
          return `${nplBaseUrl}/deviceManagement.DeviceManagement/updateDeviceCredentials`;
        } else {
          return `${nplBaseUrl}/deviceManagement.DeviceManagement/saveDevice`;
        }
      } else if (originalUrl.includes('/api/devices/bulk')) {
        return `${nplBaseUrl}/deviceManagement.DeviceManagement/bulkImportDevices`;
      } else if (originalUrl.includes('/api/devices/bulk/delete')) {
        return `${nplBaseUrl}/deviceManagement.DeviceManagement/bulkDeleteDevices`;
      }
      
      return originalUrl;
    }

    transformToGraphQLUrl(originalUrl) {
      return 'http://localhost:4000/graphql';
    }

    handleXHRRequest(xhr, method, url, ...args) {
      if (this.isWriteOperation(url, method)) {
        const nplUrl = this.transformToNplUrl(url);
        console.log(`🔄 Device Overlay XHR: Routing to NPL Engine: ${url} -> ${nplUrl}`);
        xhr.open(method, nplUrl, ...args);
        xhr.setRequestHeader('X-NPL-Modernization', 'device');
      } else {
        const graphqlUrl = this.transformToGraphQLUrl(url);
        console.log(`🔄 Device Overlay XHR: Routing to GraphQL: ${url} -> ${graphqlUrl}`);
        xhr.open(method, graphqlUrl, ...args);
        xhr.setRequestHeader('X-GraphQL-Modernization', 'device');
      }
    }
  }

  // Device UI Enhancer
  class DeviceUIEnhancer {
    constructor() {
      this.setupUIEnhancements();
      console.log('🎨 Device UI Enhancer initialized');
    }

    setupUIEnhancements() {
      // Add modernization indicators
      this.addModernizationIndicators();
      
      // Enhance device forms
      this.enhanceDeviceForms();
      
      // Add bulk operation buttons
      this.addBulkOperationButtons();
      
      // Add validation indicators
      this.addValidationIndicators();
    }

    addModernizationIndicators() {
      const deviceElements = document.querySelectorAll('[data-entity-type="device"]');
      deviceElements.forEach(element => {
        const indicator = document.createElement('span');
        indicator.className = 'npl-modernization-indicator';
        indicator.textContent = '🔧 NPL';
        indicator.style.cssText = `
          background: #4CAF50;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          margin-left: 5px;
        `;
        element.appendChild(indicator);
      });
    }

    enhanceDeviceForms() {
      const deviceForms = document.querySelectorAll('form[data-entity-type="device"]');
      deviceForms.forEach(form => {
        // Add real-time validation
        this.addRealTimeValidation(form);
        
        // Add NPL-specific fields
        this.addNplFields(form);
      });
    }

    addRealTimeValidation(form) {
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.addEventListener('blur', () => {
          this.validateField(input);
        });
      });
    }

    validateField(field) {
      const value = field.value;
      const fieldName = field.name;
      
      // Basic validation rules
      const validations = {
        name: (val) => val.length >= 3,
        type: (val) => val.length > 0,
        label: (val) => val.length > 0
      };
      
      if (validations[fieldName]) {
        const isValid = validations[fieldName](value);
        this.showFieldValidation(field, isValid);
      }
    }

    showFieldValidation(field, isValid) {
      field.style.borderColor = isValid ? '#4CAF50' : '#f44336';
      
      // Remove existing validation message
      const existingMessage = field.parentNode.querySelector('.validation-message');
      if (existingMessage) {
        existingMessage.remove();
      }
      
      if (!isValid) {
        const message = document.createElement('div');
        message.className = 'validation-message';
        message.textContent = 'This field is required and must be valid';
        message.style.cssText = `
          color: #f44336;
          font-size: 12px;
          margin-top: 2px;
        `;
        field.parentNode.appendChild(message);
      }
    }

    addNplFields(form) {
      // Add NPL-specific fields if they don't exist
      if (!form.querySelector('[name="nplValidation"]')) {
        const nplField = document.createElement('input');
        nplField.type = 'hidden';
        nplField.name = 'nplValidation';
        nplField.value = 'enabled';
        form.appendChild(nplField);
      }
    }

    addBulkOperationButtons() {
      const deviceListContainers = document.querySelectorAll('.device-list, .devices-container');
      deviceListContainers.forEach(container => {
        if (!container.querySelector('.bulk-operations')) {
          const bulkOps = document.createElement('div');
          bulkOps.className = 'bulk-operations';
          bulkOps.innerHTML = `
            <button class="btn btn-primary bulk-import-btn" onclick="window.deviceUIEnhancer.showBulkImport()">
              📥 Bulk Import
            </button>
            <button class="btn btn-danger bulk-delete-btn" onclick="window.deviceUIEnhancer.showBulkDelete()">
              🗑️ Bulk Delete
            </button>
          `;
          bulkOps.style.cssText = `
            margin: 10px 0;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
          `;
          container.insertBefore(bulkOps, container.firstChild);
        }
      });
    }

    showBulkImport() {
      const modal = document.createElement('div');
      modal.className = 'bulk-import-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <h3>Bulk Import Devices</h3>
          <textarea placeholder="Paste CSV or JSON data here..." rows="10" style="width: 100%; margin: 10px 0;"></textarea>
          <div style="text-align: right;">
            <button onclick="this.closest('.bulk-import-modal').remove()">Cancel</button>
            <button onclick="window.deviceUIEnhancer.executeBulkImport(this)">Import</button>
          </div>
        </div>
      `;
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      `;
      document.body.appendChild(modal);
    }

    showBulkDelete() {
      const selectedDevices = document.querySelectorAll('input[name="deviceIds"]:checked');
      if (selectedDevices.length === 0) {
        alert('Please select devices to delete');
        return;
      }
      
      if (confirm(`Are you sure you want to delete ${selectedDevices.length} devices?`)) {
        const deviceIds = Array.from(selectedDevices).map(input => input.value);
        this.executeBulkDelete(deviceIds);
      }
    }

    async executeBulkImport(button) {
      const textarea = button.closest('.modal-content').querySelector('textarea');
      const data = textarea.value;
      
      try {
        const response = await fetch('/api/devices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devices: this.parseBulkData(data) })
        });
        
        const result = await response.json();
        alert(`Bulk import completed: ${result.importedCount} imported, ${result.failedCount} failed`);
        button.closest('.bulk-import-modal').remove();
        location.reload();
      } catch (error) {
        alert(`Bulk import failed: ${error.message}`);
      }
    }

    async executeBulkDelete(deviceIds) {
      try {
        const response = await fetch('/api/devices/bulk/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceIds })
        });
        
        const result = await response.json();
        alert(`Bulk delete completed: ${result.deletedCount} devices deleted`);
        location.reload();
      } catch (error) {
        alert(`Bulk delete failed: ${error.message}`);
      }
    }

    parseBulkData(data) {
      // Simple CSV parser - in production, use a proper CSV library
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const device = {};
        headers.forEach((header, index) => {
          device[header] = values[index] || '';
        });
        return device;
      });
    }

    addValidationIndicators() {
      // Add validation indicators to device forms
      const deviceForms = document.querySelectorAll('form[data-entity-type="device"]');
      deviceForms.forEach(form => {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.addEventListener('click', (e) => {
            if (!this.validateForm(form)) {
              e.preventDefault();
              alert('Please fix validation errors before submitting');
            }
          });
        }
      });
    }

    validateForm(form) {
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;
      
      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          this.showFieldValidation(field, false);
          isValid = false;
        } else {
          this.showFieldValidation(field, true);
        }
      });
      
      return isValid;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDeviceOverlay);
  } else {
    initializeDeviceOverlay();
  }

  function initializeDeviceOverlay() {
    // Initialize interceptors
    window.deviceInterceptor = new DeviceHttpInterceptor();
    window.deviceUIEnhancer = new DeviceUIEnhancer();
    
    console.log('🚀 Device Modernization Overlay initialized');
  }

})(); 