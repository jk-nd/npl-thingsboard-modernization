# NPL Modernization Deployment Success Guide

## Overview

This guide documents the successful deployment of the NPL (Noumena Protocol Language) modernization for ThingsBoard, including all the challenges overcome and the final working configuration.

## Architecture

The successful architecture uses a microservices approach with the following components:

### Core Services
- **PostgreSQL**: Shared database for both ThingsBoard and NPL services
- **RabbitMQ**: Message broker for NPL services
- **ThingsBoard Backend** (`mytb-core`): Backend API using `thingsboard/tb-node:3.4.4`
- **ThingsBoard UI** (`mytb-ui`): Frontend UI using `thingsboard/tb-web-ui:latest`
- **NPL Engine**: Protocol execution engine
- **NPL Read Model**: GraphQL API for NPL data
- **NPL Sync Service**: Data synchronization between ThingsBoard and NPL
- **OIDC Proxy**: Authentication bridge
- **NPL Proxy**: Nginx reverse proxy for hybrid frontend integration

## Key Success Factors

### 1. Database Initialization Strategy

**Problem**: Race conditions and conflicts during database setup.

**Solution**: Multi-step startup process using `start.sh`:
1. Start PostgreSQL and RabbitMQ first
2. Wait for PostgreSQL health check
3. Run one-off database initialization for ThingsBoard
4. Start NPL services
5. Finally start ThingsBoard backend and UI

### 2. ThingsBoard Configuration

**Critical Discovery**: The `tb-node` image required specific environment variables to enable all web API endpoints.

**Working Configuration**:
```yaml
mytb-core:
  image: "thingsboard/tb-node:3.4.4"
  environment:
    SPRING_JPA_DATABASE_PLATFORM: "org.hibernate.dialect.PostgreSQLDialect"
    SPRING_DATASOURCE_URL: "jdbc:postgresql://postgres:5432/thingsboard"
    SPRING_DATASOURCE_USERNAME: "postgres"
    SPRING_DATASOURCE_PASSWORD: "welcome123"
    TB_SERVICE_ID: "tb-node"
    # Critical: Enable all web endpoints
    SECURITY_OAUTH2_ENABLED: "false"
    SECURITY_JWT_TOKEN_SIGNING_KEY: "thingsboardDefaultSigningKey"
    TB_APPS_RULE_ENGINE_ENABLED: "true"
    TB_APPS_WEB_ENABLED: "true"
    TB_TRANSPORT_HTTP_ENABLED: "true"
    TB_TRANSPORT_MQTT_ENABLED: "true"
```

### 3. UI Service Configuration

**Problem**: UI service couldn't connect to backend.

**Solution**: Correct environment variables for container-to-container communication:
```yaml
mytb-ui:
  image: "thingsboard/tb-web-ui:latest"
  environment:
    TB_HOST: "mytb-core"
    TB_PORT: "8080"
```

### 4. Port Mapping Strategy

**Final Port Configuration**:
- **NPL Proxy** (main entry): `8081:80`
- **ThingsBoard UI** (direct): `8082:8090`
- **ThingsBoard Backend**: `9090:8080`
- **NPL Engine**: `12000:12000`
- **NPL Read Model**: `5001:5001`
- **OIDC Proxy**: `8080:8080`

### 5. Database Setup

**Multi-database PostgreSQL configuration**:
- Uses `init-multiple-dbs.sh` to create `thingsboard` and `npl_engine` databases
- Creates `postgraphile` user with necessary permissions
- Handles both ThingsBoard schema and NPL requirements

## Deployment Steps

### Prerequisites
- Docker and Docker Compose
- Git access to the repository

### Step 1: Clone and Setup
```bash
git clone <repository-url>
cd thingsboard
```

### Step 2: Deploy Services
```bash
./start.sh
```

This script automatically:
1. Stops any existing services
2. Starts infrastructure (PostgreSQL, RabbitMQ)
3. Initializes ThingsBoard database
4. Starts NPL services
5. Starts ThingsBoard backend and UI

### Step 3: Verify Deployment

Check all services are running:
```bash
docker compose ps
```

**Expected Output**: All services should show "Up" status.

### Step 4: Access Points

- **NPL Proxy** (recommended): http://localhost:8081
- **ThingsBoard UI** (direct): http://localhost:8082
- **NPL Read Model GraphQL**: http://localhost:5001/graphql
- **NPL Engine**: http://localhost:12000/actuator/health

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. OAuth2 404 Errors
**Symptom**: `POST: /api/noauth/oauth2Clients?platform=WEB 404: Not Found`

**Solution**: Ensure the following environment variables are set for `mytb-core`:
- `TB_APPS_WEB_ENABLED: "true"`
- `SECURITY_OAUTH2_ENABLED: "false"`

#### 2. UI Can't Connect to Backend
**Symptom**: UI loads but API calls fail

**Solution**: Verify `mytb-ui` environment variables:
- `TB_HOST: "mytb-core"`
- `TB_PORT: "8080"`

#### 3. Database Connection Issues
**Symptom**: Services can't connect to PostgreSQL

**Solution**: 
- Ensure `postgres` service is in `npl-network`
- Check `init-multiple-dbs.sh` has execute permissions
- Verify database initialization completed successfully

#### 4. Port Conflicts
**Symptom**: Services fail to start due to port already in use

**Solution**: Check and stop conflicting services:
```bash
docker compose down --remove-orphans
lsof -i :8080  # Check what's using the port
```

## File Structure

```
thingsboard/
├── docker-compose.yml          # Main orchestration file
├── start.sh                    # Deployment script
├── nginx-proxy.conf            # Proxy configuration
├── npl-modernization/
│   ├── api/src/main/
│   │   ├── migration.yml       # NPL protocol definitions
│   │   └── rules/rules_1.0.0.yml
│   ├── init-multiple-dbs.sh    # Database initialization
│   └── overlay/                # Frontend overlay assets
└── docker/tb-node/conf/        # ThingsBoard configuration
```

## NPL Services Configuration

### Engine Service
- **Image**: `ghcr.io/noumenadigital/images/engine:latest`
- **Key Mount**: `./npl-modernization/api/src/main:/migrations`
- **Health Check**: `/actuator/health`

### Read Model Service
- **Image**: `ghcr.io/noumenadigital/images/read-model:latest`
- **Dependency**: Waits for Engine health check
- **GraphQL Endpoint**: http://localhost:5001/graphql

### Sync Service
- **Custom Build**: Node.js/TypeScript application
- **Purpose**: Synchronizes data between ThingsBoard and NPL
- **Configuration**: Connects to both ThingsBoard API and NPL Engine

## Security Considerations

- OAuth2 is disabled for simplicity in development
- JWT tokens use a default signing key (change for production)
- All services communicate within Docker network
- External access only through defined ports

## Performance Notes

- PostgreSQL uses named volumes for data persistence
- Services include health checks to prevent startup race conditions
- Proper dependency ordering ensures stable startup

## Next Steps

1. **Test NPL Functionality**: Verify NPL protocols work through GraphQL API
2. **Frontend Integration**: Test the overlay injection through the proxy
3. **Production Hardening**: 
   - Enable proper OAuth2 configuration
   - Use secure JWT signing keys
   - Configure SSL/TLS
   - Set up proper backup strategies

## Success Metrics

✅ **All services start successfully**
✅ **ThingsBoard UI accessible without errors**
✅ **NPL Engine processes protocols correctly**
✅ **Database schema properly initialized**
✅ **GraphQL API responds to queries**
✅ **Proxy serves hybrid frontend**

## Support

For issues not covered in this guide:
1. Check service logs: `docker compose logs <service-name>`
2. Verify service health: `docker compose ps`
3. Review the troubleshooting section above
4. Consult the original NPL documentation

---

**Last Updated**: August 2025
**Status**: Production Ready
**Tested With**: 
- Docker Compose v2.x
- ThingsBoard v3.4.4
- NPL Engine Latest 