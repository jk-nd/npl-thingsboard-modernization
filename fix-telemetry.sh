#!/bin/bash

# Fix Telemetry Data for ThingsBoard UI
# This script generates telemetry data that works with the ThingsBoard UI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Fixing Telemetry Data for ThingsBoard UI ===${NC}"

# Get current timestamp
CURRENT_TS=$(date +%s)000
echo -e "${YELLOW}Current timestamp: ${CURRENT_TS}${NC}"

# Generate telemetry data for the last 24 hours with proper timestamps
generate_current_telemetry() {
    echo -e "${YELLOW}Generating current telemetry data...${NC}"
    
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << EOF
-- Clear existing telemetry data for demo devices
DELETE FROM ts_kv WHERE entity_id IN (
    '33c88a70-6fc0-11f0-80d0-997f48d37700',  -- DHT11 Demo Device
    '33c99be0-6fc0-11f0-80d0-997f48d37700'   -- Raspberry Pi Demo Device
) AND key IN (18, 19, 103);

-- Generate temperature data for the last 24 hours (current time)
INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
SELECT 
    d.id, 
    18, 
    (${CURRENT_TS} - (i * 3600000))::bigint, 
    20 + 10 * sin(i * 0.5) + random() * 5
FROM device d 
CROSS JOIN generate_series(0, 23) i 
WHERE d.name IN ('DHT11 Demo Device', 'Raspberry Pi Demo Device');

-- Generate humidity data for the last 24 hours
INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
SELECT 
    d.id, 
    19, 
    (${CURRENT_TS} - (i * 3600000))::bigint, 
    40 + 20 * sin(i * 0.3) + random() * 10
FROM device d 
CROSS JOIN generate_series(0, 23) i 
WHERE d.name IN ('DHT11 Demo Device', 'Raspberry Pi Demo Device');

-- Generate CPU usage for Raspberry Pi
INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
SELECT 
    d.id, 
    103, 
    (${CURRENT_TS} - (i * 3600000))::bigint, 
    30 + 40 * sin(i * 0.4) + random() * 20
FROM device d 
CROSS JOIN generate_series(0, 23) i 
WHERE d.name = 'Raspberry Pi Demo Device';

-- Update latest telemetry table
DELETE FROM ts_kv_latest WHERE entity_id IN (
    '33c88a70-6fc0-11f0-80d0-997f48d37700',
    '33c99be0-6fc0-11f0-80d0-997f48d37700'
) AND key IN (18, 19, 103);

INSERT INTO ts_kv_latest (entity_id, key, ts, dbl_v) 
SELECT 
    entity_id, 
    key, 
    MAX(ts), 
    dbl_v 
FROM ts_kv 
WHERE entity_id IN (
    '33c88a70-6fc0-11f0-80d0-997f48d37700',
    '33c99be0-6fc0-11f0-80d0-997f48d37700'
) AND key IN (18, 19, 103)
GROUP BY entity_id, key, dbl_v;

-- Verify the data
SELECT 'Temperature data points:' as info, COUNT(*) as count 
FROM ts_kv 
WHERE entity_id = '33c88a70-6fc0-11f0-80d0-997f48d37700' AND key = 18
UNION ALL
SELECT 'Humidity data points:', COUNT(*) 
FROM ts_kv 
WHERE entity_id = '33c88a70-6fc0-11f0-80d0-997f48d37700' AND key = 19
UNION ALL
SELECT 'Latest telemetry records:', COUNT(*) 
FROM ts_kv_latest 
WHERE entity_id IN (
    '33c88a70-6fc0-11f0-80d0-997f48d37700',
    '33c99be0-6fc0-11f0-80d0-997f48d37700'
) AND key IN (18, 19, 103);
EOF

    echo -e "${GREEN}✅ Current telemetry data generated${NC}"
}

# Test the API
test_telemetry_api() {
    echo -e "${YELLOW}Testing telemetry API...${NC}"
    
    # Get fresh token
    TOKEN=$(curl -s -H "Content-Type: application/json" -X POST http://localhost:9090/api/auth/login -d '{"username":"tenant@thingsboard.org","password":"tenant"}' | jq -r '.token')
    
    # Test temperature data
    echo -e "${YELLOW}Testing temperature data...${NC}"
    curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:9090/api/plugins/telemetry/DEVICE/33c88a70-6fc0-11f0-80d0-997f48d37700/values/timeseries?keys=temperature&limit=3" | jq '.temperature'
    
    # Test humidity data
    echo -e "${YELLOW}Testing humidity data...${NC}"
    curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:9090/api/plugins/telemetry/DEVICE/33c88a70-6fc0-11f0-80d0-997f48d37700/values/timeseries?keys=humidity&limit=3" | jq '.humidity'
}

# Main execution
main() {
    generate_current_telemetry
    test_telemetry_api
    
    echo -e "${BLUE}=== Telemetry Fix Complete ===${NC}"
    echo -e "${GREEN}✅ Telemetry data has been regenerated with current timestamps${NC}"
    echo -e "${YELLOW}📊 Try accessing device telemetry in the ThingsBoard UI now${NC}"
    echo -e "${YELLOW}🌐 UI URL: http://localhost:8082${NC}"
}

# Run main function
main "$@" 