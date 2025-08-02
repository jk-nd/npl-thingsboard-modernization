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

echo "🧪 NPL DeviceManagement Integration Test Runner"
echo "=============================================="

# Change to test directory
cd "$(dirname "$0")"

# Set default environment variables if not provided
export TB_URL="${TB_URL:-http://localhost:8082}"
export NPL_PROXY_URL="${NPL_PROXY_URL:-http://localhost:8081}"
export NPL_ENGINE_URL="${NPL_ENGINE_URL:-http://localhost:12000}"
export NPL_READ_MODEL_URL="${NPL_READ_MODEL_URL:-http://localhost:5001}"
export TB_USERNAME="${TB_USERNAME:-tenant@thingsboard.org}"
export TB_PASSWORD="${TB_PASSWORD:-tenant}"
export VERBOSE_TESTS="${VERBOSE_TESTS:-false}"

echo "📋 Test Configuration:"
echo "  ThingsBoard URL: $TB_URL"
echo "  NPL Proxy URL: $NPL_PROXY_URL"
echo "  NPL Engine URL: $NPL_ENGINE_URL"
echo "  NPL Read Model URL: $NPL_READ_MODEL_URL"
echo "  Username: $TB_USERNAME"
echo "  Verbose: $VERBOSE_TESTS"
echo ""

# Check if services are running
echo "🔍 Checking service health..."

check_service() {
    local url=$1
    local name=$2
    
    if curl -f -s "$url" > /dev/null 2>&1 || curl -f -s "$url/api/health" > /dev/null 2>&1; then
        echo "  ✅ $name is running"
        return 0
    else
        echo "  ❌ $name is not responding at $url"
        return 1
    fi
}

# Check all services
SERVICES_OK=true

check_service "$TB_URL" "ThingsBoard" || SERVICES_OK=false
check_service "$NPL_PROXY_URL" "NPL Proxy" || SERVICES_OK=false
check_service "$NPL_ENGINE_URL" "NPL Engine" || SERVICES_OK=false
check_service "$NPL_READ_MODEL_URL" "NPL Read Model" || SERVICES_OK=false

if [ "$SERVICES_OK" = false ]; then
    echo ""
    echo "⚠️  Some services are not responding. Tests may fail."
    echo "Please ensure all Docker services are running:"
    echo "  docker compose ps"
    echo ""
    
    # Ask user if they want to continue
    read -p "Continue with tests anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Tests cancelled"
        exit 1
    fi
fi

echo ""
echo "🏗️  Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "  Dependencies already installed"
fi

echo ""
echo "🚀 Running NPL DeviceManagement Integration Tests..."
echo ""

# Run tests with different modes based on arguments
case "${1:-all}" in
    "quick")
        echo "🏃 Running quick tests (read operations only)..."
        npm test -- --testNamePattern="should handle device read operations"
        ;;
    "integration")
        echo "🔗 Running integration tests..."
        npm test -- --testNamePattern="should integrate with NPL Engine"
        ;;
    "performance")
        echo "⚡ Running performance tests..."
        npm test -- --testNamePattern="should perform within acceptable limits"
        ;;
    "coverage")
        echo "📊 Running tests with coverage..."
        npm run test:coverage
        ;;
    "watch")
        echo "👀 Running tests in watch mode..."
        npm run test:watch
        ;;
    "standalone")
        echo "🎯 Running standalone test runner..."
        npm run test:integration
        ;;
    "all"|*)
        echo "🎯 Running all tests..."
        npm test
        ;;
esac

echo ""
echo "✅ Test run completed!"
echo ""
echo "📊 Test Results Summary:"
echo "  Check the output above for detailed results"
echo "  Coverage report (if generated): ./coverage/index.html"
echo "  Test logs available in Jest output"
echo ""
echo "🎉 NPL DeviceManagement Integration Testing Complete!" 