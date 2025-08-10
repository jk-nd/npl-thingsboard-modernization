# NPL Frontend Overlay

**⚠️ DEPRECATED**: This Angular overlay has been replaced by the **Service Worker integration approach**.

## Current Implementation: Service Worker

The NPL modernization now uses a **Service Worker** (`ui-ngx/src/assets/overlay/npl-service-worker.js`) to intercept and route ThingsBoard UI requests to NPL backend services.

### Key Benefits of Service Worker Approach:
- ✅ **No frontend code changes** required in ThingsBoard UI
- ✅ **Seamless integration** with existing UI
- ✅ **Request interception** at the network level
- ✅ **Read-your-writes consistency** built-in
- ✅ **Easier deployment** and maintenance

## Service Worker Location

The active Service Worker implementation is located at:
```
ui-ngx/src/assets/overlay/npl-service-worker.js
```

## Documentation

For complete Service Worker implementation details, see:
- [Service Worker Integration Guide](../docs/SERVICE_WORKER_INTEGRATION.md)
- [Frontend Integration Analysis](../docs/FRONTEND_INTEGRATION_ANALYSIS.md)

## Legacy Angular Overlay (DEPRECATED)

This directory contains the previous Angular-based overlay approach, which has been superseded by the Service Worker implementation. The Angular components are kept for reference but are not actively used.

### Previous Implementation
- Angular HTTP interceptors
- Custom services and components
- Complex routing configuration
- Extensive frontend modifications required

### Migration to Service Worker
The Service Worker approach eliminates the need for:
- Angular build pipeline modifications
- Custom HTTP interceptors
- Complex service dependencies
- Frontend code changes

## Build (Legacy)

If you need to work with the legacy Angular overlay:

```bash
# Install dependencies
npm install

# Build the project
ng build

# Run tests
ng test

# Development server
ng serve
```

Build artifacts are stored in the `dist/` directory and deployed to `../overlay/` for nginx serving.

## Current Status

**Active**: Service Worker at `ui-ngx/src/assets/overlay/npl-service-worker.js`  
**Deprecated**: Angular overlay in this directory  
**Recommended**: Use Service Worker for all new development

---

*This README reflects the transition to Service Worker-based integration. For current implementation details, refer to the Service Worker documentation.*
