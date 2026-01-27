# ADR-001: Clean Architecture

## Status

Accepted

## Date

2024-01-15

## Context

We need to choose an architecture pattern for our e-commerce API that:
- Supports complex business logic
- Is testable without infrastructure dependencies
- Allows independent evolution of components
- Is familiar to the team
- Scales well as the project grows

## Options Considered

### Option 1: N-Tier Architecture
Traditional layers: Presentation → Business → Data Access

**Pros:**
- Simple and familiar
- Quick to start

**Cons:**
- Business logic often leaks into other layers
- Hard to test without database
- Tight coupling to data access

### Option 2: Vertical Slice Architecture
Feature folders with all layers together

**Pros:**
- Feature isolation
- Easy to understand feature scope
- Good for CRUD-heavy apps

**Cons:**
- Cross-cutting concerns harder to manage
- Code duplication across slices
- Less structure for complex domains

### Option 3: Clean Architecture
Concentric layers with dependency rule pointing inward

**Pros:**
- Domain isolated from infrastructure
- Highly testable
- Flexible to change
- Clear boundaries

**Cons:**
- More initial setup
- More files/projects
- Can be over-engineered for simple apps

## Decision

We choose **Clean Architecture** with the following structure:

```
Domain (innermost)
  └── Application
        └── Infrastructure
              └── Presentation (outermost)
```

### Layer Responsibilities

**Domain:**
- Entities (Order, Product, Customer)
- Value Objects (Money, Address)
- Domain Events
- Domain Exceptions
- No external dependencies

**Application:**
- Use cases (Commands, Queries)
- Interface definitions (repositories, services)
- DTOs
- Validation
- Depends only on Domain

**Infrastructure:**
- Repository implementations
- External service integrations
- Database context
- Implements Application interfaces

**Presentation:**
- API endpoints
- Middleware
- Request/Response mapping
- Orchestrates Application layer

## Consequences

### Positive
- Business logic is isolated and testable
- Can change database without touching domain
- Clear boundaries prevent accidental coupling
- Team can work on layers independently

### Negative
- More initial setup time
- Need to maintain multiple projects
- Some duplication (DTOs, mappings)
- Learning curve for new team members

### Mitigations
- Use MediatR to reduce boilerplate
- Use Mapster for efficient mapping
- Document patterns in Memory Bank
- Pair programming for onboarding

## Implementation Notes

1. Domain project has no NuGet references except Ardalis.GuardClauses
2. Application uses MediatR for CQRS
3. Use Result pattern instead of exceptions for expected failures
4. Infrastructure implements interfaces via dependency injection

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Clean Architecture Solution Template](https://github.com/jasontaylordev/CleanArchitecture)
