#!/bin/bash

# Bootstrap NPL Protocol Instances
# This script creates the necessary protocol instances for the NPL modernization system

set -e

echo "🚀 Starting NPL Protocol Bootstrap..."

# Configuration
ENGINE_URL="http://localhost:12000"
THINGSBOARD_URL="http://localhost:8081"
OIDC_PROXY_URL="http://localhost:8081/api/protocol/openid-connect"
SYSADMIN_USER="sysadmin@thingsboard.org"
SYSADMIN_PASSWORD="sysadmin"
TENANT_USER="tenant@thingsboard.org"
TENANT_PASSWORD="tenant"
CUSTOMER_USER="user@thingsboard.org"
CUSTOMER_PASSWORD="user"

# Function to get ThingsBoard JWT token
get_thingsboard_jwt() {
    local USERNAME=$1
    local PASSWORD=$2
    echo "🔑 Step 1: Getting ThingsBoard JWT for user: $USERNAME"
    
    TB_JWT=$(curl -s -X POST "$THINGSBOARD_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | jq -r .token)
    
    if [ "$TB_JWT" = "null" ] || [ -z "$TB_JWT" ]; then
        echo "❌ Failed to get ThingsBoard JWT for $USERNAME"
        return 1
    fi
    
    echo "✅ ThingsBoard JWT obtained for $USERNAME"
    return 0
}

# Function to exchange ThingsBoard JWT for NPL Engine token
exchange_for_npl_token() {
    local TB_JWT=$1
    echo "🔄 Step 2: Exchanging ThingsBoard JWT for NPL Engine token..."
    
    ACCESS_TOKEN=$(curl -s -X POST "$OIDC_PROXY_URL/token/exchange" \
        -H "Content-Type: application/json" \
        -d "{\"token\":\"$TB_JWT\"}" | jq -r .access_token)
    
    if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
        echo "❌ Failed to exchange JWT for NPL Engine token"
        return 1
    fi
    
    echo "✅ NPL Engine access token obtained"
    return 0
}

# Function to get access token (two-step process)
get_access_token() {
    local USERNAME=$1
    local PASSWORD=$2
    echo "🔑 Getting access token for user: $USERNAME"
    
    if get_thingsboard_jwt "$USERNAME" "$PASSWORD"; then
        if exchange_for_npl_token "$TB_JWT"; then
            echo "✅ Complete authentication successful for $USERNAME"
            return 0
        fi
    fi
    
    echo "❌ Authentication failed for $USERNAME"
    return 1
}

# Function to check if DeviceManagement instance exists
check_device_management_instance() {
    echo "🔍 Checking for existing DeviceManagement instance..."
    
    RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$ENGINE_URL/npl/deviceManagement/DeviceManagement/" || echo "404")
    
    if echo "$RESPONSE" | jq -e '.items | length > 0' > /dev/null 2>&1; then
        INSTANCE_ID=$(echo "$RESPONSE" | jq -r '.items[0].id' 2>/dev/null)
        echo "✅ DeviceManagement instance already exists: $INSTANCE_ID"
        echo "$INSTANCE_ID"
        return 0
    else
        echo "⚠️ No DeviceManagement instance found"
        return 1
    fi
}

# Function to create DeviceManagement instance
create_device_management_instance() {
    echo "🏗️ Creating DeviceManagement protocol instance..."
    
    PAYLOAD='{
        "@parties": [
            {
                "entity": {
                    "email": ["sysadmin@thingsboard.org"]
                },
                "access": {}
            },
            {
                "entity": {
                    "email": ["tenant@thingsboard.org"]
                },
                "access": {}
            },
            {
                "entity": {
                    "email": ["user@thingsboard.org"]
                },
                "access": {}
            }
        ]
    }'
    
    echo "📦 Sending request to create DeviceManagement instance..."
    RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        "$ENGINE_URL/npl/deviceManagement/DeviceManagement/")
    
    if echo "$RESPONSE" | jq -e '."@id"' > /dev/null 2>&1; then
        INSTANCE_ID=$(echo "$RESPONSE" | jq -r '."@id"')
        echo "✅ DeviceManagement instance created with ID: $INSTANCE_ID"
        echo "🎯 Available actions:"
        echo "$RESPONSE" | jq -r '."@actions" | keys[]' | head -5 | sed 's/^/   - /'
        echo "   - (and more...)"
        return 0
    else
        echo "❌ Failed to create DeviceManagement instance"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Function to verify instance is working
verify_instance() {
    local INSTANCE_ID=$1
    echo "🧪 Verifying DeviceManagement instance: $INSTANCE_ID"
    
    RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$ENGINE_URL/npl/deviceManagement/DeviceManagement/$INSTANCE_ID")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        echo "✅ Instance verification successful"
        echo "📋 Instance details:"
        echo "$RESPONSE" | jq '.'
        return 0
    else
        echo "❌ Instance verification failed"
        return 1
    fi
}

# Main execution
main() {
    echo "🎯 NPL Protocol Bootstrap Script"
    echo "================================"
    
    # Get authentication token (try sysadmin first)
    if get_access_token "$SYSADMIN_USER" "$SYSADMIN_PASSWORD"; then
        echo "✅ Using sysadmin credentials for bootstrap"
    elif get_access_token "$TENANT_USER" "$TENANT_PASSWORD"; then
        echo "✅ Using tenant credentials for bootstrap"
    else
        echo "❌ Failed to authenticate with any ThingsBoard user"
        exit 1
    fi
    
    # Check if DeviceManagement instance already exists
    if EXISTING_ID=$(check_device_management_instance); then
        echo "✅ Using existing DeviceManagement instance: $EXISTING_ID"
        verify_instance "$EXISTING_ID"
    else
        # Create new DeviceManagement instance
        if create_device_management_instance; then
            echo "🎉 DeviceManagement protocol instance bootstrap completed successfully!"
        else
            echo "💥 Bootstrap failed"
            exit 1
        fi
    fi
    
    echo ""
    echo "🎊 Protocol bootstrap completed!"
    echo "👥 DeviceManagement instance is now available for:"
    echo "   - sys_admin (sysadmin@thingsboard.org)"
    echo "   - tenant_admin (tenant@thingsboard.org)" 
    echo "   - customer_user (user@thingsboard.org)"
    echo ""
    echo "🔗 You can now test device operations via the Service Worker!"
}

# Run main function
main "$@"
