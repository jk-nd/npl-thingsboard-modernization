#!/bin/bash

# Generate Demo Telemetry Data for ThingsBoard
# This script creates realistic telemetry data for demo devices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ThingsBoard Demo Telemetry Generator ===${NC}"

# Check if ThingsBoard is running
check_tb_status() {
    echo -e "${YELLOW}Checking ThingsBoard status...${NC}"
    
    if ! docker-compose ps mytb-core | grep -q "healthy"; then
        echo -e "${RED}❌ ThingsBoard core is not healthy. Please ensure the system is running.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ ThingsBoard is running${NC}"
}

# Generate telemetry data for demo devices
generate_telemetry() {
    echo -e "${YELLOW}Generating telemetry data for demo devices...${NC}"
    
    # Add telemetry keys to dictionary
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << 'EOF'
-- Add telemetry keys to dictionary
INSERT INTO ts_kv_dictionary (key, key_id) VALUES 
    ('temperature', 100), 
    ('humidity', 101), 
    ('battery', 102),
    ('cpu_usage', 103),
    ('memory_usage', 104),
    ('disk_usage', 105)
ON CONFLICT DO NOTHING;
EOF

    echo -e "${GREEN}✅ Telemetry keys added to dictionary${NC}"
    
    # Generate temperature data for DHT11 and Raspberry Pi devices
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << 'EOF'
-- Generate temperature data for the last 24 hours
INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
SELECT 
    d.id, 
    100, 
    extract(epoch from (now() - interval '1 hour' * i)) * 1000, 
    20 + 10 * sin(i * 0.5) + random() * 5
FROM device d 
CROSS JOIN generate_series(0, 23) i 
WHERE d.name IN ('DHT11 Demo Device', 'Raspberry Pi Demo Device')
ON CONFLICT DO NOTHING;
EOF

    echo -e "${GREEN}✅ Temperature data generated${NC}"
    
    # Generate humidity data
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << 'EOF'
-- Generate humidity data for the last 24 hours
INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
SELECT 
    d.id, 
    101, 
    extract(epoch from (now() - interval '1 hour' * i)) * 1000, 
    40 + 20 * sin(i * 0.3) + random() * 10
FROM device d 
CROSS JOIN generate_series(0, 23) i 
WHERE d.name IN ('DHT11 Demo Device', 'Raspberry Pi Demo Device')
ON CONFLICT DO NOTHING;
EOF

    echo -e "${GREEN}✅ Humidity data generated${NC}"
    
    # Generate battery data for thermostats
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << 'EOF'
-- Generate battery data for thermostats
INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
SELECT 
    d.id, 
    102, 
    extract(epoch from (now() - interval '1 hour' * i)) * 1000, 
    80 + 10 * sin(i * 0.2) + random() * 5
FROM device d 
CROSS JOIN generate_series(0, 23) i 
WHERE d.name LIKE 'Thermostat%'
ON CONFLICT DO NOTHING;
EOF

    echo -e "${GREEN}✅ Battery data generated${NC}"
    
    # Generate CPU usage for Raspberry Pi
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << 'EOF'
-- Generate CPU usage for Raspberry Pi
INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
SELECT 
    d.id, 
    103, 
    extract(epoch from (now() - interval '1 hour' * i)) * 1000, 
    30 + 40 * sin(i * 0.4) + random() * 20
FROM device d 
CROSS JOIN generate_series(0, 23) i 
WHERE d.name = 'Raspberry Pi Demo Device'
ON CONFLICT DO NOTHING;
EOF

    echo -e "${GREEN}✅ CPU usage data generated${NC}"
    
    # Update latest telemetry
    docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard << 'EOF'
-- Update latest telemetry table
INSERT INTO ts_kv_latest (entity_id, key, ts, dbl_v) 
SELECT 
    entity_id, 
    key, 
    MAX(ts), 
    dbl_v 
FROM ts_kv 
WHERE key IN (100, 101, 102, 103)
GROUP BY entity_id, key, dbl_v 
ON CONFLICT (entity_id, key) DO UPDATE SET 
    ts = EXCLUDED.ts, 
    dbl_v = EXCLUDED.dbl_v;
EOF

    echo -e "${GREEN}✅ Latest telemetry updated${NC}"
}

# Display summary
show_summary() {
    echo -e "${BLUE}=== Telemetry Generation Summary ===${NC}"
    
    # Count telemetry data points
    local total_points=$(docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard -t -c "SELECT COUNT(*) FROM ts_kv WHERE key IN (100, 101, 102, 103);" | tr -d ' ')
    local devices=$(docker exec -i thingsboard-postgres-1 psql -U postgres -d thingsboard -t -c "SELECT COUNT(DISTINCT entity_id) FROM ts_kv WHERE key IN (100, 101, 102, 103);" | tr -d ' ')
    
    echo -e "${GREEN}✅ Telemetry data generated successfully${NC}"
    echo -e "${YELLOW}📊 Total data points: ${total_points}${NC}"
    echo -e "${YELLOW}📱 Devices with telemetry: ${devices}${NC}"
    echo -e "${YELLOW}📊 Access ThingsBoard UI: http://localhost:8082${NC}"
    echo -e "${YELLOW}📱 Access NPL Modernized UI: http://localhost:8081${NC}"
    echo -e "${BLUE}📋 Available telemetry types:${NC}"
    echo -e "   • Temperature (DHT11, Raspberry Pi)"
    echo -e "   • Humidity (DHT11, Raspberry Pi)"
    echo -e "   • Battery (Thermostats)"
    echo -e "   • CPU Usage (Raspberry Pi)"
}

# Main execution
main() {
    check_tb_status
    generate_telemetry
    show_summary
}

# Run main function
main "$@" 