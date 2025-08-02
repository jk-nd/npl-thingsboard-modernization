# Telemetry Integration in NPL Modernization

## Overview

The NPL modernization project handles telemetry data through a hybrid approach:

1. **Source of Truth**: ThingsBoard remains the source of truth for telemetry data
2. **Data Storage**: Telemetry is stored in PostgreSQL using ThingsBoard's schema (`ts_kv` and `ts_kv_latest` tables)
3. **API Routing**: Telemetry requests are automatically routed to ThingsBoard's backend
4. **Real-time Updates**: WebSocket connections for live telemetry updates are proxied to ThingsBoard

## Architecture

### Components

1. **Request Transformer**
   - Identifies telemetry endpoints in `isReadOperation()`
   - Forces fallback to ThingsBoard by throwing an error in `transformToGraphQL()`
   - Telemetry endpoints handled:
     - `/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries`
     - `/api/plugins/telemetry/DEVICE/{deviceId}/values/attributes`

2. **NPL Interceptor**
   - Catches telemetry errors and falls back to ThingsBoard
   - Uses `catchError` operator to handle the fallback gracefully

3. **Nginx Proxy**
   - Routes API requests to ThingsBoard backend
   - Special handling for WebSocket connections at `/api/ws/`
   - Maintains WebSocket connection for real-time updates

### Database Schema

ThingsBoard uses two main tables for telemetry:

1. **ts_kv**: Historical time-series data
   - `entity_id`: Device ID
   - `key`: References `ts_kv_dictionary`
   - `ts`: Timestamp
   - `dbl_v`, `str_v`, etc.: Value columns for different types

2. **ts_kv_latest**: Latest values
   - Same structure as `ts_kv`
   - Only stores most recent value per key

3. **ts_kv_dictionary**: Key mapping
   - Maps string keys to numeric IDs for efficiency
   - Example: 'temperature' → 18, 'humidity' → 19

## Implementation Details

### Nginx Configuration

```nginx
# WebSocket telemetry endpoint
location /api/ws/ {
    proxy_pass http://mytb-core:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    # ... other headers ...
}
```

### Request Transformer

```typescript
// Telemetry endpoints in readEndpoints array
/^\/api\/plugins\/telemetry\/DEVICE\/([^\/]+)\/values\/timeseries$/,
/^\/api\/plugins\/telemetry\/DEVICE\/([^\/]+)\/values\/attributes$/,

// Fallback handling
if (telemetryMatch) {
  throw new Error('Telemetry not implemented in NPL yet - falling back to ThingsBoard');
}
```

### Interceptor Fallback

```typescript
return this.transformer.transformToGraphQL(req).pipe(
  catchError(error => {
    if (flags.enableLogging) {
      console.error('GraphQL transformation failed, falling back to ThingsBoard:', error);
    }
    return next.handle(req);
  })
);
```

## Future Considerations

1. **NPL Telemetry Implementation**
   - Could implement telemetry in NPL protocols
   - Would require time-series data model in NPL
   - Need to consider real-time update mechanisms

2. **Data Migration**
   - Current approach keeps telemetry in ThingsBoard
   - Future migration could move historical data to NPL

3. **Performance Optimization**
   - Consider caching strategies
   - Evaluate time-series database options
   - Optimize WebSocket connections

## Testing

1. **API Testing**
   - Verify telemetry REST endpoints
   - Test WebSocket connections
   - Check historical data queries

2. **UI Testing**
   - Verify real-time updates
   - Test data visualization widgets
   - Check time range selections 