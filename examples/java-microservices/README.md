# Java Microservices Example

This example demonstrates how to configure GitHub Copilot Enterprise with the Everything GitHub Copilot Enterprise (EGCE) framework for a Java/Spring Boot microservices project.

## Project Overview

This is a sample e-commerce system consisting of three microservices:

- **Order Service**: Handles order creation, management, and lifecycle
- **Inventory Service**: Manages product stock and reservations
- **Notification Service**: Sends email and push notifications

## Technology Stack

- **Java**: 21 (LTS)
- **Spring Boot**: 3.2.x (LTS)
- **Spring Cloud**: 2023.0.x
- **Database**: PostgreSQL 16
- **Messaging**: Apache Kafka
- **Build Tool**: Gradle with Kotlin DSL

## Memory Bank Structure

```
.memory-bank/
├── contexts/
│   ├── project-context.md      # Overall project context
│   ├── order-service.md        # Order service module context
│   ├── inventory-service.md    # Inventory service module context
│   └── notification-service.md # Notification service module context
├── decisions/
│   ├── ADR-001-microservices.md
│   ├── ADR-002-event-driven.md
│   └── ADR-003-database-per-service.md
└── knowledge/
    ├── api-conventions.md
    ├── testing-strategy.md
    └── deployment-patterns.md
```

## Getting Started

### Prerequisites

- Java 21+
- Docker and Docker Compose
- Gradle 8.5+

### Running Locally

```bash
# Start infrastructure
docker-compose up -d

# Run services
./gradlew :order-service:bootRun
./gradlew :inventory-service:bootRun
./gradlew :notification-service:bootRun
```

### Running Tests

```bash
# All tests
./gradlew test

# With Testcontainers
./gradlew integrationTest
```

## Using with GitHub Copilot

### Recommended Chat Modes

1. **Dev Mode**: For feature development
   ```
   @workspace /dev Add a new endpoint to cancel orders
   ```

2. **Review Mode**: For code review
   ```
   @workspace /review Check the OrderService for potential issues
   ```

3. **Architect Mode**: For design decisions
   ```
   @workspace /architect Should we add a payment service?
   ```

### Recommended Agents

- **@spring-architect**: For Spring-specific architecture questions
- **@jpa-specialist**: For database and JPA questions
- **@spring-security-expert**: For security implementation

### Example Prompts

```
@workspace Create a new REST endpoint for order cancellation following our patterns

@workspace Add Spring Security with JWT to the order-service

@workspace Create integration tests for the OrderController using Testcontainers
```

## Project Conventions

### Code Style

- Use Lombok for boilerplate reduction
- Use MapStruct for DTO mapping
- Follow hexagonal architecture in domain services
- Use records for DTOs

### API Design

- RESTful endpoints with versioning: `/api/v1/...`
- Problem Details (RFC 7807) for errors
- OpenAPI documentation with springdoc

### Testing

- Unit tests with JUnit 5 and Mockito
- Integration tests with Testcontainers
- Minimum 80% coverage for new code

## Contributing

1. Read the Memory Bank context before making changes
2. Update relevant context files after significant changes
3. Create ADRs for architectural decisions
4. Follow the team's coding standards in `.memory-bank/knowledge/`
