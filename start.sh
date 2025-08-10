#!/bin/bash

set -e

# Function to get the ID of a container for a given service
get_container_id() {
    local service_name="$1"
    docker-compose ps -q "$service_name"
}

# Function to wait for a container to become healthy
wait_for_healthy() {
    local service_name="$1"
    echo "--- Waiting for $service_name to become healthy..."

    # Wait for the container to exist first
    while [ -z "$(get_container_id "$service_name")" ]; do
        echo "Waiting for $service_name container to be created..."
        sleep 2
    done

    local container_id
    container_id=$(get_container_id "$service_name")

    while [ "$(docker inspect -f '{{.State.Health.Status}}' "$container_id")" != "healthy" ]; do
        printf "."
        sleep 5
    done

    echo ""
    echo "--- $service_name is healthy!"
}

echo "--- Bringing down any existing services for a clean start..."
docker-compose down --remove-orphans --volumes

echo "--- Step 1: Building and deploying NPL overlay..."
cd npl-modernization/frontend-overlay
echo "Building NPL overlay..."
npm run build
echo "Copying overlay files to correct location..."
cp -r dist/frontend-overlay/* dist/npl-modernization/
# Find the main.js file and copy it as npl-overlay.js
rm -f dist/npl-modernization/npl-overlay.js
cp $(ls dist/npl-modernization/main.*.js | head -1) dist/npl-modernization/npl-overlay.js
echo "✅ NPL overlay built and deployed"
cd ../..

echo "--- Step 2: Starting base infrastructure (Postgres, RabbitMQ)..."
docker-compose up -d postgres rabbitmq

wait_for_healthy "postgres"

echo "--- Step 3: Initializing ThingsBoard database with demo data..."
docker-compose run --rm -e INSTALL_TB=true -e LOAD_DEMO=true -e "install_data_dir=/usr/share/thingsboard/data" mytb-core

echo "--- Step 4: Starting NPL services..."
docker-compose up -d engine read-model sync-service oidc-proxy npl-proxy

wait_for_healthy "engine"

echo "--- Step 5: Starting ThingsBoard (mytb-core) and UI (mytb-ui)..."
docker-compose up -d mytb-core mytb-ui

wait_for_healthy "mytb-core"

echo "--- Step 6: Bootstrapping NPL protocol instances..."
cd npl-modernization
chmod +x bootstrap-protocols.sh
./bootstrap-protocols.sh
cd ..

echo ""
echo "--- ✅ All services are running and NPL protocols are bootstrapped!"
echo "--- ThingsBoard UI: http://localhost:8081"
echo "--- Default login: tenant@thingsboard.org / tenant"
echo "--- To monitor ThingsBoard, run: docker-compose logs -f mytb-core" 