#!/bin/bash

# Load Demo Data Script for ThingsBoard NPL Modernization
# This script loads demo data, widgets, and dashboards into ThingsBoard
# Focus: NPL Modernized UI at http://localhost:8081

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ThingsBoard Demo Data Loader ===${NC}"

# Check if ThingsBoard is running
check_tb_status() {
    echo -e "${YELLOW}Checking ThingsBoard status...${NC}"
    
    # Check if mytb-core is healthy
    if ! docker-compose ps mytb-core | grep -q "healthy"; then
        echo -e "${RED}❌ ThingsBoard core is not healthy. Please ensure the system is running.${NC}"
        echo -e "${YELLOW}Run: ./start.sh${NC}"
        exit 1
    fi
    
    # Check if NPL Proxy UI is accessible
    if ! curl -s -f http://localhost:8081 > /dev/null; then
        echo -e "${RED}❌ NPL Proxy UI is not accessible at http://localhost:8081${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ ThingsBoard is running and accessible${NC}"
}

# Load demo data using ThingsBoard's built-in demo data loader
load_demo_data() {
    echo -e "${YELLOW}Loading demo data, widgets, and dashboards...${NC}"
    
    # Run the ThingsBoard demo data loader
    docker-compose run --rm \
        -e INSTALL_TB=false \
        -e LOAD_DEMO=true \
        -e "install_data_dir=/usr/share/thingsboard/data" \
        mytb-core
    
    echo -e "${GREEN}✅ Demo data loaded successfully${NC}"
}

# Create additional test devices with telemetry
create_test_devices() {
    echo -e "${YELLOW}Creating additional test devices with telemetry...${NC}"
    
    # Connect to PostgreSQL and insert test data
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << 'EOF'
-- Insert additional test devices
INSERT INTO device (id, name, type, label, tenant_id, customer_id, device_profile_id, created_time, updated_time)
SELECT 
    gen_random_uuid(),
    'Test Device ' || i,
    'sensor',
    'Test Device ' || i || ' Label',
    (SELECT id FROM tenant WHERE tenant_profile_id = (SELECT id FROM tenant_profile WHERE name = 'Default')),
    (SELECT id FROM customer WHERE tenant_id = (SELECT id FROM tenant WHERE tenant_profile_id = (SELECT id FROM tenant_profile WHERE name = 'Default')) LIMIT 1),
    (SELECT id FROM device_profile WHERE name = 'default' LIMIT 1),
    extract(epoch from now()) * 1000,
    extract(epoch from now()) * 1000
FROM generate_series(1, 5) i
ON CONFLICT DO NOTHING;

-- Insert telemetry data for the last 24 hours
INSERT INTO ts_kv (entity_id, key, ts, bool_v, str_v, long_v, dbl_v, json_v)
SELECT 
    d.id,
    'temperature',
    extract(epoch from (now() - interval '1 hour' * i)) * 1000,
    NULL,
    NULL,
    NULL,
    20 + 10 * sin(i * 0.5) + random() * 5,
    NULL
FROM device d
CROSS JOIN generate_series(0, 23) i
WHERE d.name LIKE 'Test Device%'
ON CONFLICT DO NOTHING;

INSERT INTO ts_kv (entity_id, key, ts, bool_v, str_v, long_v, dbl_v, json_v)
SELECT 
    d.id,
    'humidity',
    extract(epoch from (now() - interval '1 hour' * i)) * 1000,
    NULL,
    NULL,
    NULL,
    40 + 20 * sin(i * 0.3) + random() * 10,
    NULL
FROM device d
CROSS JOIN generate_series(0, 23) i
WHERE d.name LIKE 'Test Device%'
ON CONFLICT DO NOTHING;

INSERT INTO ts_kv (entity_id, key, ts, bool_v, str_v, long_v, dbl_v, json_v)
SELECT 
    d.id,
    'battery',
    extract(epoch from (now() - interval '1 hour' * i)) * 1000,
    NULL,
    NULL,
    NULL,
    80 + 10 * sin(i * 0.2) + random() * 5,
    NULL
FROM device d
CROSS JOIN generate_series(0, 23) i
WHERE d.name LIKE 'Test Device%'
ON CONFLICT DO NOTHING;

-- Update latest telemetry
INSERT INTO ts_kv_latest (entity_id, key, ts, bool_v, str_v, long_v, dbl_v, json_v)
SELECT 
    entity_id,
    key,
    MAX(ts),
    bool_v,
    str_v,
    long_v,
    dbl_v,
    json_v
FROM ts_kv 
WHERE entity_id IN (SELECT id FROM device WHERE name LIKE 'Test Device%')
GROUP BY entity_id, key, bool_v, str_v, long_v, dbl_v, json_v
ON CONFLICT (entity_id, key) DO UPDATE SET
    ts = EXCLUDED.ts,
    bool_v = EXCLUDED.bool_v,
    str_v = EXCLUDED.str_v,
    long_v = EXCLUDED.long_v,
    dbl_v = EXCLUDED.dbl_v,
    json_v = EXCLUDED.json_v;

EOF

    echo -e "${GREEN}✅ Test devices and telemetry data created${NC}"
}

# Display summary
show_summary() {
    echo -e "${BLUE}=== Demo Data Summary ===${NC}"
    echo -e "${GREEN}✅ Demo data loaded successfully${NC}"
    echo -e "${GREEN}✅ Test devices created with telemetry${NC}"
    echo -e "${YELLOW}📊 Access NPL Modernized UI: http://localhost:8081${NC}"
    echo -e "${YELLOW}🔑 Login: tenant@thingsboard.org / tenant${NC}"
    echo -e "${YELLOW}📱 Legacy ThingsBoard UI: http://localhost:8082${NC}"
    echo -e "${BLUE}📋 Available demo content:${NC}"
    echo -e "   • Demo dashboards with widgets"
    echo -e "   • Sample devices with telemetry"
    echo -e "   • Device profiles and asset types"
    echo -e "   • Customer and tenant data"
    echo -e "   • Additional test devices with 24h telemetry"
}

# Main execution
main() {
    check_tb_status
    load_demo_data
    create_test_devices
    show_summary
}

# Run main function
main "$@" 