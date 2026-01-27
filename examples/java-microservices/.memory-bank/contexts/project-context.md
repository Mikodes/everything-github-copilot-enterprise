# Project Context: E-Commerce Microservices

## Overview

| Field | Value |
|-------|-------|
| **Project Name** | E-Commerce Microservices Platform |
| **Version** | 1.0.0-SNAPSHOT |
| **Status** | Active Development |
| **Team** | Platform Engineering |
| **Repository** | github.com/example/ecommerce-microservices |

## Description

A modern e-commerce platform built with microservices architecture using Spring Boot and Spring Cloud. The system handles order processing, inventory management, and customer notifications.

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Java | 21 (LTS) | Primary language |
| Spring Boot | 3.2.x | Application framework |
| Spring Cloud | 2023.0.x | Microservices infrastructure |
| PostgreSQL | 16 | Primary database |
| Apache Kafka | 3.6 | Event streaming |
| Redis | 7 | Caching |

### Build & Development

| Tool | Version | Purpose |
|------|---------|---------|
| Gradle | 8.5 | Build tool |
| Docker | 24+ | Containerization |
| Testcontainers | 1.19 | Integration testing |

### Libraries

| Library | Purpose |
|---------|---------|
| Lombok | Boilerplate reduction |
| MapStruct | Object mapping |
| Resilience4j | Circuit breakers |
| Micrometer | Observability |
| springdoc-openapi | API documentation |

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│                    (Spring Cloud Gateway)                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
┌─────────▼─────┐  ┌──────▼──────┐  ┌─────▼───────┐
│ Order Service │  │  Inventory  │  │ Notification│
│               │  │   Service   │  │   Service   │
└───────┬───────┘  └──────┬──────┘  └─────┬───────┘
        │                 │               │
        │    ┌────────────┴───────────────┤
        │    │                            │
┌───────▼────▼─────┐              ┌───────▼───────┐
│     Kafka        │              │     Redis     │
│ (Event Streaming)│              │   (Cache)     │
└──────────────────┘              └───────────────┘
        │
┌───────▼───────────────────────────────────────────┐
│              PostgreSQL (per service)              │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐   │
│  │ orders  │  │inventory│  │  notifications  │   │
│  └─────────┘  └─────────┘  └─────────────────┘   │
└───────────────────────────────────────────────────┘
```

### Service Responsibilities

#### Order Service
- Create and manage orders
- Order lifecycle management (created → submitted → paid → shipped → delivered)
- Integration with inventory for stock reservation
- Integration with notification for order updates

#### Inventory Service
- Product catalog management
- Stock level tracking
- Stock reservation and release
- Low stock alerts

#### Notification Service
- Email notifications
- Push notifications
- SMS notifications (planned)
- Template management

## Development Standards

### Code Organization

```
service-name/
├── src/main/java/com/example/servicename/
│   ├── domain/           # Domain entities, value objects
│   │   ├── model/
│   │   ├── event/
│   │   └── exception/
│   ├── application/      # Use cases, application services
│   │   ├── port/
│   │   │   ├── in/       # Input ports (interfaces)
│   │   │   └── out/      # Output ports (interfaces)
│   │   └── service/
│   └── infrastructure/   # Adapters, controllers, repositories
│       └── adapter/
│           ├── in/
│           │   ├── web/
│           │   └── messaging/
│           └── out/
│               ├── persistence/
│               └── messaging/
├── src/main/resources/
│   ├── application.yml
│   ├── application-local.yml
│   └── db/migration/
└── src/test/
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Services | `{Domain}Service` | `OrderService` |
| Controllers | `{Domain}Controller` | `OrderController` |
| Repositories | `{Domain}Repository` | `OrderRepository` |
| DTOs | `{Domain}Dto`, `Create{Domain}Request` | `OrderDto`, `CreateOrderRequest` |
| Events | `{Domain}{Action}Event` | `OrderCreatedEvent` |

### API Conventions

- Base path: `/api/v1/{resource}`
- Use plural nouns for resources
- Use HTTP methods correctly (GET, POST, PUT, DELETE)
- Return Problem Details for errors
- Use pagination for collections

## Team Structure

| Role | Responsibilities |
|------|------------------|
| Tech Lead | Architecture decisions, code reviews |
| Backend Developers (3) | Feature development, testing |
| DevOps Engineer | CI/CD, infrastructure |
| QA Engineer | Testing strategy, automation |

## Current Sprint Focus

- [ ] Complete order cancellation feature
- [ ] Add payment service integration
- [ ] Improve test coverage to 85%
- [ ] Performance optimization for inventory queries

## Important Links

- **Jira Board**: https://jira.example.com/board/ECOM
- **Confluence**: https://confluence.example.com/ecommerce
- **CI/CD**: https://github.com/example/ecommerce-microservices/actions
- **Monitoring**: https://grafana.example.com/d/ecommerce

## Contact

- **Tech Lead**: tech-lead@example.com
- **Team Slack**: #team-ecommerce
- **On-call**: PagerDuty rotation

---

*Last updated: 2024-01-15*
*Next review: 2024-02-15*
