#!/bin/bash
#
# Copyright © 2016-2025 The Thingsboard Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

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

echo "--- Step 1: Starting base infrastructure (Postgres, RabbitMQ)..."
docker-compose up -d postgres rabbitmq

wait_for_healthy "postgres"

echo "--- Step 2: Initializing ThingsBoard database..."
# This command runs the installation for the tb-node image
docker-compose run --rm -e INSTALL_TB=true -e LOAD_DEMO=true -e "install_data_dir=/usr/share/thingsboard/data" mytb-core

echo "--- Step 3: Starting NPL services..."
docker-compose up -d engine read-model sync-service oidc-proxy npl-proxy

wait_for_healthy "engine"

echo "--- Step 4: Starting ThingsBoard (mytb-core) and UI (mytb-ui)..."
docker-compose up -d mytb-core mytb-ui

echo ""
echo "--- ✅ All services are starting up in the correct order."
echo "--- To monitor ThingsBoard, run: docker-compose logs -f mytb-core" 