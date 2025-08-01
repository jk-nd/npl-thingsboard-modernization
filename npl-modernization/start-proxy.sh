#!/bin/bash

# NPL Modernization Proxy Setup
# This script starts an nginx proxy that injects our overlay into ThingsBoard

set -e

echo "🚀 Starting NPL Modernization Proxy"
echo "==================================="

# Check if ThingsBoard container is running
if ! docker ps | grep -q mytb; then
    echo "❌ Error: ThingsBoard container 'mytb' is not running"
    echo "   Start it with: docker start mytb"
    exit 1
fi

# Check if overlay bundle exists
OVERLAY_BUNDLE="npl-modernization/frontend-overlay/dist/frontend-overlay/main.js"
if [ ! -f "$OVERLAY_BUNDLE" ]; then
    echo "❌ Error: Overlay bundle not found at $OVERLAY_BUNDLE"
    echo "   Build it first with: cd npl-modernization/frontend-overlay && npm run build"
    exit 1
fi

# Create overlay directory
mkdir -p npl-modernization/overlay

# Copy overlay bundle
echo "📦 Copying overlay bundle..."
cp "$OVERLAY_BUNDLE" npl-modernization/overlay/npl-overlay.js

# Stop existing proxy if running
docker stop npl-proxy 2>/dev/null || true
docker rm npl-proxy 2>/dev/null || true

# Start nginx proxy
echo "🌐 Starting nginx proxy..."
docker run -d \
    --name npl-proxy \
    --add-host=host.docker.internal:host-gateway \
    -p 8081:8081 \
    -v "$(pwd)/npl-modernization/nginx-proxy.conf:/etc/nginx/nginx.conf:ro" \
    -v "$(pwd)/npl-modernization/overlay:/usr/share/nginx/html/overlay:ro" \
    nginx:alpine

echo "✅ Proxy started successfully!"
echo ""
echo "🌐 Access ThingsBoard with overlay at: http://localhost:8081"
echo "📊 Original ThingsBoard at: http://localhost:9090"
echo ""
echo "🔄 To update the overlay:"
echo "   1. Rebuild: cd npl-modernization/frontend-overlay && npm run build"
echo "   2. Copy: cp npl-modernization/frontend-overlay/dist/frontend-overlay/main.js npl-modernization/overlay/npl-overlay.js"
echo "   3. Refresh browser"
echo ""
echo "🛑 To stop the proxy:"
echo "   docker stop npl-proxy" 