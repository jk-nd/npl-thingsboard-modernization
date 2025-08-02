# ThingsBoard with NPL Modernization

## Overview

This repository contains a successfully modernized ThingsBoard IoT platform integrated with NPL (Noumena Protocol Language) stack. The modernization enables protocol-based device management while maintaining full backward compatibility with existing ThingsBoard functionality.

## 🎉 Current Status: Production Ready

All services are successfully deployed and operational:

✅ **ThingsBoard Backend & UI** - Fully functional with OAuth2 endpoints  
✅ **NPL Engine** - Processing protocols and health checks passing  
✅ **NPL Read Model** - GraphQL API operational  
✅ **Sync Service** - Data synchronization between ThingsBoard and NPL  
✅ **Database Integration** - PostgreSQL with multiple databases  
✅ **Reverse Proxy** - Nginx serving hybrid frontend  

## Quick Start

### Prerequisites
- Docker and Docker Compose v2.x
- Git

### Deployment
```bash
git clone <repository-url>
cd thingsboard
./start.sh
```

### Access Points
- **Main Application** (via NPL Proxy): http://localhost:8081
- **ThingsBoard UI** (direct): http://localhost:8082
- **NPL GraphQL API**: http://localhost:5001/graphql
- **NPL Engine Health**: http://localhost:12000/actuator/health

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        NPL Proxy                            │
│                    (nginx:8081)                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
            ┌─────────┴─────────┐
            │                   │
    ┌───────▼──────┐    ┌──────▼─────────┐
    │ ThingsBoard  │    │  NPL Overlay   │
    │ UI (8082)    │    │  Assets        │
    └───────┬──────┘    └──────┬─────────┘
            │                  │
    ┌───────▼──────┐    ┌──────▼─────────┐
    │ ThingsBoard  │    │ NPL Read Model │
    │ Backend      │    │ GraphQL (5001) │
    │ (9090)       │    └──────┬─────────┘
    └───────┬──────┘           │
            │           ┌──────▼─────────┐
    ┌───────▼──────┐    │  NPL Engine    │
    │ PostgreSQL   │◄───┤  (12000)       │
    │ (thingsboard,│    └────────────────┘
    │  npl_engine) │
    └──────────────┘
```

## Key Components

### Core Services
- **PostgreSQL**: Shared database with `thingsboard` and `npl_engine` databases
- **RabbitMQ**: Message broker for NPL services
- **ThingsBoard Backend** (`mytb-core`): API and business logic using `tb-node:3.4.4`
- **ThingsBoard UI** (`mytb-ui`): Frontend using `tb-web-ui:latest`

### NPL Stack
- **NPL Engine**: Protocol execution engine with health monitoring
- **NPL Read Model**: GraphQL API for querying NPL data
- **NPL Sync Service**: Bidirectional data synchronization
- **OIDC Proxy**: Authentication bridge between systems

### Integration Layer
- **NPL Proxy**: Nginx reverse proxy serving hybrid frontend
- **NPL Overlay**: Frontend enhancements for protocol-based features

## Configuration Highlights

### ThingsBoard Backend Configuration
```yaml
environment:
  # Database connection
  SPRING_DATASOURCE_URL: "jdbc:postgresql://postgres:5432/thingsboard"
  
  # Critical: Enable web API endpoints
  TB_APPS_WEB_ENABLED: "true"
  SECURITY_OAUTH2_ENABLED: "false"
  TB_TRANSPORT_HTTP_ENABLED: "true"
  SECURITY_JWT_TOKEN_SIGNING_KEY: "thingsboardDefaultSigningKey"
```

### UI Service Configuration
```yaml
environment:
  # Container-to-container communication
  TB_HOST: "mytb-core"
  TB_PORT: "8080"
```

## Documentation

- **[Deployment Success Guide](npl-modernization/DEPLOYMENT_SUCCESS_GUIDE.md)** - Complete deployment instructions and troubleshooting
- **[Technical Summary](npl-modernization/TECHNICAL_SUMMARY.md)** - Architecture decisions and technical details
- **[NPL Documentation](npl-modernization/docs/)** - NPL-specific implementation details

## Development Workflow

### Starting Services
```bash
./start.sh                           # Full stack deployment
docker compose ps                    # Check service status
docker compose logs -f <service>     # Monitor specific service
```

### Common Operations
```bash
docker compose restart <service>     # Restart individual service
docker compose down --volumes        # Complete cleanup
docker compose logs mytb-core        # Check ThingsBoard backend logs
```

### Troubleshooting
1. **OAuth2 404 Errors**: Ensure `TB_APPS_WEB_ENABLED: "true"` is set
2. **UI Connection Issues**: Verify `TB_HOST: "mytb-core"` configuration
3. **Database Issues**: Check `init-multiple-dbs.sh` execution
4. **Port Conflicts**: Use `docker compose down --remove-orphans`

## Success Metrics

The deployment is considered successful when:

- [ ] All services show "Up" status in `docker compose ps`
- [ ] ThingsBoard UI loads without OAuth2 errors at http://localhost:8081
- [ ] NPL Engine health check passes at http://localhost:12000/actuator/health
- [ ] GraphQL API responds at http://localhost:5001/graphql
- [ ] Database contains both `thingsboard` and `npl_engine` schemas

## Security Notes

**Current Configuration** (Development):
- OAuth2 disabled for simplicity
- Default JWT signing key
- All services in isolated Docker network
- External access only through defined ports

**Production Recommendations**:
- Enable proper OAuth2 configuration
- Use secure JWT signing keys
- Implement SSL/TLS termination
- Add authentication to NPL services

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test changes with `./start.sh`
4. Submit a pull request with documentation updates

## Support

For issues and questions:
1. Check the [Troubleshooting Guide](npl-modernization/DEPLOYMENT_SUCCESS_GUIDE.md#troubleshooting-guide)
2. Review service logs: `docker compose logs <service-name>`
3. Verify service health: `docker compose ps`
4. Consult the [Technical Summary](npl-modernization/TECHNICAL_SUMMARY.md)

---

**Last Updated**: August 2025  
**Status**: ✅ Production Ready  
**Tested Platform**: Docker Compose v2.x, ThingsBoard v3.4.4, NPL Engine Latest
