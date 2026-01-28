# Project Context

## Overview

**Project Name**: ECommerceApi
**Type**: REST API
**Domain**: E-commerce (orders, products, customers)
**Status**: Active Development

## Technology Stack

### Runtime & Framework
- **.NET**: 8.0 LTS
- **ASP.NET Core**: 8.0
- **C#**: 12

### Data Layer
- **ORM**: Entity Framework Core 8
- **Database**: PostgreSQL 16
- **Migrations**: EF Core Code-First

### Architecture & Patterns
- **Architecture**: Clean Architecture
- **CQRS**: MediatR
- **Validation**: FluentValidation
- **Mapping**: Mapster

### API
- **Style**: Minimal APIs (organized with endpoint classes)
- **Documentation**: OpenAPI (Swashbuckle)
- **Versioning**: URL segment (/api/v1/)

### Testing
- **Framework**: xUnit
- **Mocking**: NSubstitute
- **Assertions**: FluentAssertions
- **Integration**: WebApplicationFactory + Testcontainers

### Observability
- **Logging**: Serilog (structured)
- **Metrics**: .NET Metrics + Prometheus
- **Tracing**: OpenTelemetry

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation                            │
│                   (ECommerceApi.WebApi)                      │
│              Minimal APIs, Middleware, Filters               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Application                             │
│                (ECommerceApi.Application)                    │
│        Commands, Queries, Handlers, Validators               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                        Domain                                │
│                  (ECommerceApi.Domain)                       │
│          Entities, Value Objects, Domain Events              │
└─────────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────┴───────────────────────────────────┐
│                    Infrastructure                            │
│               (ECommerceApi.Infrastructure)                  │
│        Persistence, External Services, Repositories          │
└─────────────────────────────────────────────────────────────┘
```

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| MediatR | 12.x | CQRS implementation |
| FluentValidation | 11.x | Request validation |
| Mapster | 7.x | Object mapping |
| Serilog | 3.x | Structured logging |
| Npgsql.EntityFrameworkCore.PostgreSQL | 8.x | PostgreSQL provider |

## Project Conventions

### Naming
- **Commands**: `{Action}{Entity}Command` (e.g., `CreateOrderCommand`)
- **Queries**: `Get{Entity}[By{Filter}]Query` (e.g., `GetOrderByIdQuery`)
- **Handlers**: `{Command/Query}Handler`
- **Validators**: `{Request}Validator`

### Folder Structure
- Feature folders in Application layer
- One file per class
- Tests mirror source structure

### Code Style
- Primary constructors for DI
- Records for DTOs and requests
- Result pattern for expected failures
- Exceptions for unexpected failures

## Environment Configuration

| Environment | Database | Logging |
|-------------|----------|---------|
| Development | Local PostgreSQL (Docker) | Console + Seq |
| Staging | Azure PostgreSQL | Application Insights |
| Production | Azure PostgreSQL | Application Insights |

## Getting Started

```bash
# Start dependencies
docker-compose up -d

# Run migrations
dotnet ef database update --project src/ECommerceApi.Infrastructure

# Run API
dotnet run --project src/ECommerceApi.WebApi

# Run tests
dotnet test
```

## Related Documentation

- [Architecture Decision Records](../decisions/)
- [Module Contexts](../modules/)
- [Approved Patterns](../knowledge/patterns.md)
