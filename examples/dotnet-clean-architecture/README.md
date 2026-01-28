# .NET Clean Architecture Example

This example demonstrates how to configure GitHub Copilot Enterprise with the Memory Bank system for a .NET Clean Architecture project.

## Project Overview

A sample e-commerce API built with:
- **.NET 8 LTS** - Long-term support release
- **ASP.NET Core** - Web API with Minimal APIs
- **Entity Framework Core 8** - Data access
- **MediatR** - CQRS implementation
- **FluentValidation** - Input validation
- **Clean Architecture** - Layer separation

## Solution Structure

```
ECommerceApi/
├── src/
│   ├── ECommerceApi.Domain/           # Enterprise business rules
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   └── Exceptions/
│   │
│   ├── ECommerceApi.Application/      # Application business rules
│   │   ├── Common/
│   │   │   ├── Interfaces/
│   │   │   ├── Behaviors/
│   │   │   └── Models/
│   │   ├── Features/
│   │   │   ├── Orders/
│   │   │   ├── Products/
│   │   │   └── Customers/
│   │   └── DependencyInjection.cs
│   │
│   ├── ECommerceApi.Infrastructure/   # External concerns
│   │   ├── Persistence/
│   │   │   ├── Configurations/
│   │   │   ├── Repositories/
│   │   │   └── ApplicationDbContext.cs
│   │   ├── Services/
│   │   └── DependencyInjection.cs
│   │
│   └── ECommerceApi.WebApi/           # Presentation
│       ├── Endpoints/
│       ├── Middleware/
│       ├── appsettings.json
│       └── Program.cs
│
├── tests/
│   ├── ECommerceApi.Domain.Tests/
│   ├── ECommerceApi.Application.Tests/
│   ├── ECommerceApi.Infrastructure.Tests/
│   └── ECommerceApi.WebApi.Tests/
│
├── .memory-bank/                       # GitHub Copilot context
│   ├── project/
│   │   └── context.md
│   ├── team/
│   │   └── context.md
│   ├── modules/
│   │   ├── orders/
│   │   │   └── context.md
│   │   └── products/
│   │       └── context.md
│   ├── decisions/
│   │   ├── 001-clean-architecture.md
│   │   └── 002-cqrs-mediatr.md
│   └── knowledge/
│       ├── patterns.md
│       └── troubleshooting.md
│
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       └── ci.yml
│
└── ECommerceApi.sln
```

## Getting Started

### Prerequisites

- .NET 8 SDK
- Docker (for database)
- Visual Studio 2022 / VS Code / Rider

### Setup

1. **Clone and restore**
   ```bash
   git clone <repository>
   cd ECommerceApi
   dotnet restore
   ```

2. **Start database**
   ```bash
   docker-compose up -d
   ```

3. **Run migrations**
   ```bash
   dotnet ef database update --project src/ECommerceApi.Infrastructure
   ```

4. **Run the API**
   ```bash
   dotnet run --project src/ECommerceApi.WebApi
   ```

5. **Access Swagger**
   - Navigate to `https://localhost:5001/swagger`

## Memory Bank Configuration

This project uses the Memory Bank system to provide context to GitHub Copilot. The `.memory-bank/` folder contains:

### Project Context (`project/context.md`)
- Technology stack and versions
- Architecture overview
- Key conventions

### Team Context (`team/context.md`)
- Team structure
- Coding standards
- Review process

### Module Contexts (`modules/*/context.md`)
- Domain-specific information
- API contracts
- Business rules

### Architecture Decisions (`decisions/*.md`)
- ADRs for key decisions
- Trade-offs and rationale

### Knowledge Base (`knowledge/*.md`)
- Approved patterns
- Troubleshooting guides

## Using with GitHub Copilot

1. **Install GitHub Copilot** in your IDE
2. **Reference Memory Bank** in your questions:
   - "Based on our project context, how should I implement a new Order feature?"
   - "What patterns should I use for the repository layer?"

3. **Use custom prompts** from `.github/prompts/`:
   - Create API Controller
   - Create EF Entity
   - Add Feature Module

## Key Patterns

### CQRS with MediatR

```csharp
// Command
public record CreateOrderCommand(int CustomerId, List<OrderItemDto> Items)
    : IRequest<Result<int>>;

// Handler
public class CreateOrderCommandHandler
    : IRequestHandler<CreateOrderCommand, Result<int>>
{
    public async Task<Result<int>> Handle(
        CreateOrderCommand request,
        CancellationToken cancellationToken)
    {
        // Implementation
    }
}
```

### Repository Pattern

```csharp
// Interface in Application
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}

// Implementation in Infrastructure
public class OrderRepository : IOrderRepository { }
```

### Result Pattern

```csharp
public async Task<Result<OrderResponse>> Handle(GetOrderQuery request, CancellationToken ct)
{
    var order = await _repository.GetByIdAsync(request.Id, ct);

    if (order is null)
        return Result.Failure<OrderResponse>(DomainErrors.Order.NotFound);

    return _mapper.Map<OrderResponse>(order);
}
```

## Testing

```bash
# Run all tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run specific project
dotnet test tests/ECommerceApi.Application.Tests
```

## Contributing

1. Check the Memory Bank for context
2. Follow patterns in `knowledge/patterns.md`
3. Create/update ADRs for significant changes
4. Ensure tests pass before PR

## License

MIT
