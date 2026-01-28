# Team Context

## Team Structure

**Team Name**: E-Commerce Platform Team
**Size**: 5 developers
**Methodology**: Scrum (2-week sprints)

## Team Members & Expertise

| Role | Focus Area |
|------|------------|
| Tech Lead | Architecture, code review, mentoring |
| Senior Developer | Backend, EF Core, performance |
| Senior Developer | API design, security |
| Developer | Full-stack, Blazor |
| Developer | Testing, DevOps |

## Communication

- **Daily Standup**: 9:30 AM
- **Sprint Planning**: Monday (start of sprint)
- **Retrospective**: Friday (end of sprint)
- **Slack Channel**: #ecommerce-platform
- **Code Review**: Required from 1 team member

## Development Workflow

### Branch Strategy

```
main (protected)
  └── develop
        └── feature/PROJ-123-add-order-feature
        └── bugfix/PROJ-456-fix-calculation
        └── hotfix/PROJ-789-security-patch
```

### Commit Convention

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Scope: orders, products, customers, api, infrastructure
```

### Pull Request Process

1. Create feature branch from `develop`
2. Implement with tests
3. Self-review code
4. Create PR with description
5. Request review from team member
6. Address feedback
7. Squash and merge

### PR Requirements

- [ ] All tests pass
- [ ] Code coverage maintained (>80%)
- [ ] No new Sonar issues
- [ ] Documentation updated (if applicable)
- [ ] Memory Bank updated (if significant changes)

## Coding Standards

### C# Conventions

```csharp
// Use primary constructors for DI
public class OrderService(IOrderRepository repository, ILogger<OrderService> logger)

// Use file-scoped namespaces
namespace ECommerceApi.Application.Features.Orders;

// Use records for DTOs
public record OrderResponse(int Id, string Status, decimal Total);

// Async suffix for async methods
public async Task<Order> GetOrderAsync(int id, CancellationToken ct)

// Always use CancellationToken
public async Task ProcessAsync(CancellationToken ct = default)
```

### API Conventions

```csharp
// RESTful URLs
GET    /api/v1/orders
GET    /api/v1/orders/{id}
POST   /api/v1/orders
PUT    /api/v1/orders/{id}
DELETE /api/v1/orders/{id}

// Sub-resources
GET    /api/v1/orders/{id}/items
POST   /api/v1/orders/{id}/items
```

### Testing Conventions

```csharp
// Test naming
[Fact]
public void MethodName_Scenario_ExpectedResult()

[Fact]
public async Task CreateOrder_WithValidData_ReturnsCreatedOrder()

// AAA pattern
// Arrange
// Act
// Assert
```

## Quality Gates

### Pre-Commit

- Code compiles
- Unit tests pass
- Formatting correct

### CI Pipeline

- All tests pass
- Code coverage >80%
- No critical security issues
- Docker image builds

### Pre-Deploy (Staging)

- Integration tests pass
- Performance tests pass
- Security scan clean

## Tools & Access

| Tool | Purpose | Access |
|------|---------|--------|
| GitHub | Source control, CI/CD | Team members |
| Azure DevOps | Work items, sprints | Team members |
| Seq | Log aggregation (dev) | Team members |
| Application Insights | Production monitoring | Tech lead, seniors |
| SonarCloud | Code quality | All (view), Lead (admin) |

## On-Call Rotation

- Weekly rotation among developers
- Primary + backup assignee
- Escalation: Primary → Backup → Tech Lead

## Knowledge Sharing

- **Tech Talks**: Bi-weekly, Friday 3 PM
- **Documentation**: Update Memory Bank, ADRs
- **Pair Programming**: Encouraged for complex features
- **Code Reviews**: Learning opportunity, not just validation

## Onboarding Checklist

1. [ ] Read project README
2. [ ] Read Memory Bank documentation
3. [ ] Set up local development environment
4. [ ] Run all tests
5. [ ] Review recent PRs
6. [ ] Pair with team member on first task
7. [ ] Complete first small PR
