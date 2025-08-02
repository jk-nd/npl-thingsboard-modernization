#!/bin/bash
set -e

# Function to get the ID of a container for a given service
get_container_id() {
    docker-compose ps -q "$1"
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
docker-compose down --remove-orphans

echo "--- Step 1: Starting base infrastructure (Postgres, RabbitMQ)..."
docker-compose up -d postgres rabbitmq

wait_for_healthy "postgres"

echo "--- Step 2: Initializing ThingsBoard database..."
docker-compose run --rm -e INSTALL_TB=true -e LOAD_DEMO=true -e "install_data_dir=/usr/share/thingsboard/data" mytb-core

echo "--- Step 3: Starting NPL services..."
docker-compose up -d engine read-model sync-service oidc-proxy npl-proxy

wait_for_healthy "engine"

echo "--- Step 4: Starting ThingsBoard (mytb-core) and UI (mytb-ui)..."
docker-compose up -d mytb-core mytb-ui

echo ""
echo "--- ✅ All services are starting up in the correct order."
echo "--- To monitor ThingsBoard, run: docker-compose logs -f mytb-core" 