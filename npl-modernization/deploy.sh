#!/bin/bash

# NPL Modernization Deployment Script
# This script automates the complete deployment and instantiation process

set -e

echo "🚀 Starting NPL Modernization Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed"
        exit 1
    fi
    
    print_success "All prerequisites are met"
}

# Start the NPL stack
start_stack() {
    print_status "Starting NPL stack..."
    
    if [ -f "docker-compose.yml" ]; then
        docker compose up -d
        print_success "NPL stack started"
    else
        print_error "docker-compose.yml not found"
        exit 1
    fi
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for NPL Engine
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:12000/health > /dev/null 2>&1; then
            print_success "NPL Engine is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "NPL Engine failed to start within timeout"
            exit 1
        fi
        
        print_status "Waiting for NPL Engine... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    # Wait for OIDC Proxy
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            print_success "OIDC Proxy is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "OIDC Proxy failed to start within timeout"
            exit 1
        fi
        
        print_status "Waiting for OIDC Proxy... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
}

# Get JWT token
get_token() {
    print_status "Getting JWT token..."
    
    local token_response
    token_response=$(curl -s -X POST http://localhost:8080/protocol/openid-connect/token \
        -H "Content-Type: application/json" \
        -d '{"username":"tenant@thingsboard.org","password":"tenant"}')
    
    if [ $? -ne 0 ]; then
        print_error "Failed to get token"
        exit 1
    fi
    
    TOKEN=$(echo "$token_response" | jq -r '.access_token')
    
    if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
        print_error "Failed to extract token from response"
        echo "Response: $token_response"
        exit 1
    fi
    
    print_success "JWT token obtained (length: ${#TOKEN})"
}

# Deploy protocol
deploy_protocol() {
    print_status "Deploying protocol..."
    
    if [ ! -f "deployment.zip" ]; then
        print_error "deployment.zip not found"
        print_status "Please ensure the deployment package is prepared"
        exit 1
    fi
    
    local deploy_response
    deploy_response=$(curl -s -X POST http://localhost:12400/management/application \
        -H "Authorization: Bearer $TOKEN" \
        -F "archive=@deployment.zip")
    
    if [ $? -ne 0 ]; then
        print_error "Failed to deploy protocol"
        exit 1
    fi
    
    print_success "Protocol deployment completed"
    echo "$deploy_response" | jq .
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
        http://localhost:12000/npl/deviceManagement/DeviceManagement/)
    
    if [ "$status_code" = "401" ]; then
        print_success "Protocol endpoints are available (401 is expected for unauthenticated access)"
    elif [ "$status_code" = "404" ]; then
        print_error "Protocol endpoints not found - deployment may have failed"
        exit 1
    else
        print_warning "Unexpected status code: $status_code"
    fi
}

# Create protocol instance
create_instance() {
    print_status "Creating protocol instance..."
    
    local instance_response
    instance_response=$(curl -s -X POST http://localhost:12000/api/engine/protocols \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "prototypeId": "/deviceManagement/DeviceManagement",
            "parties": [
                {"entity": {"claims": {"email": ["sysadmin@thingsboard.org"]}}, "access": {}},
                {"entity": {"claims": {"email": ["tenant@thingsboard.org"]}}, "access": {}},
                {"entity": {"claims": {"email": ["customer@thingsboard.org"]}}, "access": {}}
            ]
        }')
    
    if [ $? -ne 0 ]; then
        print_error "Failed to create protocol instance"
        exit 1
    fi
    
    PROTOCOL_ID=$(echo "$instance_response" | jq -r '.result.value')
    
    if [ "$PROTOCOL_ID" = "null" ] || [ -z "$PROTOCOL_ID" ]; then
        print_error "Failed to extract protocol instance ID"
        echo "Response: $instance_response"
        exit 1
    fi
    
    print_success "Protocol instance created with ID: $PROTOCOL_ID"
    echo "$instance_response" | jq .
}

# Test protocol endpoints
test_endpoints() {
    print_status "Testing protocol endpoints..."
    
    # Test device creation
    print_status "Testing device creation..."
    local create_response
    create_response=$(curl -s -X POST "http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/createDevice" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "device": {
                "id": "test-device-001",
                "name": "Test Device",
                "type": "sensor",
                "tenantId": "tenant-001",
                "credentials": "encrypted-credentials",
                "label": "Test Label",
                "deviceProfileId": "profile-001",
                "firmwareId": "firmware-001",
                "softwareId": "software-001",
                "externalId": "ext-001",
                "version": 1,
                "additionalInfo": "Additional info",
                "createdTime": 1640995200000,
                "deviceData": "device-data"
            }
        }')
    
    echo "$create_response" | jq .
    
    # Test device retrieval
    print_status "Testing device retrieval..."
    local get_response
    get_response=$(curl -s -X POST "http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/getDeviceById" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"id": "test-device-001"}')
    
    echo "$get_response" | jq .
    
    print_success "Protocol endpoint tests completed"
}

# Main execution
main() {
    echo "=========================================="
    echo "NPL Modernization Deployment Script"
    echo "=========================================="
    
    check_prerequisites
    start_stack
    wait_for_services
    get_token
    deploy_protocol
    verify_deployment
    create_instance
    test_endpoints
    
    echo "=========================================="
    print_success "Deployment completed successfully!"
    echo "=========================================="
    echo ""
    echo "Protocol Instance ID: $PROTOCOL_ID"
    echo "API Endpoint: http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID"
    echo ""
    echo "You can now interact with the protocol using the endpoints:"
    echo "- POST /createDevice"
    echo "- POST /getDeviceById"
    echo "- POST /getAllDevices"
    echo "- POST /updateDevice"
    echo "- POST /deleteDevice"
    echo "- POST /assignDeviceToCustomer"
    echo "- POST /unassignDeviceFromCustomer"
    echo ""
    echo "Example:"
    echo "curl -X POST http://localhost:12000/npl/deviceManagement/DeviceManagement/$PROTOCOL_ID/getAllDevices \\"
    echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
    echo "  -H \"Content-Type: application/json\" \\"
    echo "  -d '{}'"
}

# Run main function
main "$@" 