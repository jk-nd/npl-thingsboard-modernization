# Data Loading and Telemetry Generation

## Overview

The NPL modernization project includes scripts for loading demo data and generating realistic telemetry data. These scripts help in setting up a development or testing environment with meaningful data.

## Scripts

### 1. `load-demo-data.sh`

This script loads ThingsBoard's demo data and creates additional test devices with telemetry.

```bash
# Usage
./load-demo-data.sh
```

#### What it does:

1. Checks if ThingsBoard is running and accessible
2. Loads demo data including:
   - Demo dashboards with widgets
   - Sample devices and device profiles
   - Customer and tenant data
3. Creates additional test devices with telemetry
4. Generates 24 hours of historical data for:
   - Temperature (18-30°C range)
   - Humidity (40-60% range)
   - CPU usage (for Raspberry Pi devices)

#### Key Features:
- Uses `ts_kv_dictionary` for efficient key storage
- Generates realistic, fluctuating values using SQL functions
- Updates both historical (`ts_kv`) and latest (`ts_kv_latest`) tables

### 2. `generate-demo-telemetry.sh`

This script generates realistic telemetry data for existing devices.

```bash
# Usage
./generate-demo-telemetry.sh
```

#### What it does:

1. Adds telemetry keys to dictionary:
   ```sql
   INSERT INTO ts_kv_dictionary (key, key_id) VALUES 
       ('temperature', 100), 
       ('humidity', 101), 
       ('battery', 102),
       ('cpu_usage', 103),
       ('memory_usage', 104),
       ('disk_usage', 105)
   ```

2. Generates data for specific device types:
   - DHT11 Demo Device: temperature, humidity
   - Raspberry Pi Demo Device: temperature, humidity, CPU usage
   - Thermostats: battery level

3. Uses SQL to create realistic patterns:
   ```sql
   -- Example: Temperature generation
   INSERT INTO ts_kv (entity_id, key, ts, dbl_v) 
   SELECT 
       d.id, 
       100, -- temperature key
       extract(epoch from (now() - interval '1 hour' * i)) * 1000, 
       20 + 10 * sin(i * 0.5) + random() * 5
   FROM device d 
   CROSS JOIN generate_series(0, 23) i 
   WHERE d.name IN ('DHT11 Demo Device', 'Raspberry Pi Demo Device');
   ```

### 3. `fix-telemetry.sh`

A utility script to fix telemetry data issues and ensure proper timestamps.

```bash
# Usage
./fix-telemetry.sh
```

#### What it does:

1. Clears existing telemetry data for demo devices
2. Generates new data with current timestamps
3. Updates `ts_kv_latest` table
4. Tests the telemetry API to verify data accessibility

#### Key Features:
- Uses current timestamp for data generation
- Includes API testing
- Provides detailed logging

## Database Schema Used

### Key Tables

1. `ts_kv_dictionary`:
   ```sql
   key         | key_id 
   ------------+--------
   temperature |     18
   humidity    |     19
   cpu_usage   |    103
   ```

2. `ts_kv`:
   ```sql
   entity_id | key | ts | dbl_v
   ----------+-----+----+-------
   device_id |  18 | t1 | 23.5
   device_id |  19 | t1 | 45.2
   ```

3. `ts_kv_latest`:
   ```sql
   entity_id | key | ts | dbl_v
   ----------+-----+----+-------
   device_id |  18 | t  | 23.5
   ```

## Best Practices

1. **Data Generation**:
   - Use realistic value ranges
   - Include some randomness for variety
   - Create patterns using sine waves
   - Use appropriate time intervals

2. **Database Operations**:
   - Use batch inserts for efficiency
   - Update dictionary before data insertion
   - Maintain both historical and latest values
   - Use appropriate indexes

3. **Testing**:
   - Verify data via SQL queries
   - Test API endpoints
   - Check UI visualization
   - Validate WebSocket updates

## Troubleshooting

1. **Missing Data in UI**:
   - Check `ts_kv_dictionary` for correct key mappings
   - Verify data exists in both `ts_kv` and `ts_kv_latest`
   - Ensure timestamps are in milliseconds
   - Validate device IDs

2. **API Issues**:
   - Check API endpoint accessibility
   - Verify authentication token
   - Validate WebSocket connections
   - Check nginx proxy configuration

3. **Data Quality**:
   - Verify value ranges are realistic
   - Check timestamp continuity
   - Ensure no duplicate timestamps
   - Validate data types (double, string, etc.) 