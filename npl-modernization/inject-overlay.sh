#!/bin/bash

# NPL Modernization Overlay Injection Script
# This script injects the NPL overlay bundle into the ThingsBoard Docker container

set -e

CONTAINER_NAME="mytb"
OVERLAY_BUNDLE="npl-modernization/frontend-overlay/dist/frontend-overlay/main.js"
CONTAINER_STATIC_DIR="/usr/share/thingsboard/static"
CONTAINER_OVERLAY_DIR="$CONTAINER_STATIC_DIR/assets/overlay"
CONTAINER_INDEX_HTML="$CONTAINER_STATIC_DIR/index.html"

echo "🚀 NPL Modernization Overlay Injection"
echo "======================================"

# Check if container is running
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Error: ThingsBoard container '$CONTAINER_NAME' is not running"
    echo "   Start it with: docker start $CONTAINER_NAME"
    exit 1
fi

# Check if overlay bundle exists
if [ ! -f "$OVERLAY_BUNDLE" ]; then
    echo "❌ Error: Overlay bundle not found at $OVERLAY_BUNDLE"
    echo "   Build it first with: cd npl-modernization/frontend-overlay && npm run build"
    exit 1
fi

echo "📦 Copying overlay bundle to container..."
docker cp "$OVERLAY_BUNDLE" "$CONTAINER_NAME:$CONTAINER_OVERLAY_DIR/npl-overlay.js"

echo "🔧 Injecting script tag into index.html..."
# Create a backup of the original index.html
docker exec $CONTAINER_NAME cp $CONTAINER_INDEX_HTML ${CONTAINER_INDEX_HTML}.backup

# Inject script tag before </body>
docker exec $CONTAINER_NAME sed -i 's|</body>|  <!-- NPL Modernization Overlay -->\n  <script src="assets/overlay/npl-overlay.js" defer></script>\n</body>|' $CONTAINER_INDEX_HTML

echo "✅ Overlay injection complete!"
echo ""
echo "🌐 Access ThingsBoard at: http://localhost:9090"
echo "📊 Check browser console for NPL interceptor logs"
echo ""
echo "🔄 To update the overlay:"
echo "   1. Rebuild: cd npl-modernization/frontend-overlay && npm run build"
echo "   2. Re-run this script: ./npl-modernization/inject-overlay.sh"
echo ""
echo "🔄 To remove the overlay:"
echo "   docker exec $CONTAINER_NAME cp ${CONTAINER_INDEX_HTML}.backup $CONTAINER_INDEX_HTML" 