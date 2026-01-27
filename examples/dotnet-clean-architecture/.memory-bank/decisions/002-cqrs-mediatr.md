# ADR-002: CQRS with MediatR

## Status

Accepted

## Date

2024-01-15

## Context

We need a pattern for handling commands (state changes) and queries (data retrieval) in our application layer. Requirements:

- Clear separation of read and write operations
- Consistent validation approach
- Cross-cutting concerns (logging, validation) applied uniformly
- Testable handlers
- Avoid bloated service classes

## Options Considered

### Option 1: Service Classes
Traditional service layer with methods for each operation.

```csharp
public class OrderService
{
    public Task<Order> CreateAsync(CreateOrderRequest request) { }
    public Task<Order> GetByIdAsync(int id) { }
    public Task UpdateAsync(int id, UpdateOrderRequest request) { }
    public Task DeleteAsync(int id) { }
}
```

**Pros:**
- Simple and familiar
- Easy to understand

**Cons:**
- Services tend to grow large
- Hard to apply cross-cutting concerns
- Testing requires mocking entire service

### Option 2: CQRS with MediatR
Separate Command and Query objects with handlers.

```csharp
public record CreateOrderCommand(int CustomerId) : IRequest<Result<int>>;

public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, Result<int>>
{
    public async Task<Result<int>> Handle(CreateOrderCommand request, CancellationToken ct)
    {
        // Implementation
    }
}
```

**Pros:**
- Single responsibility handlers
- Pipeline behaviors for cross-cutting concerns
- Highly testable
- Natural separation of commands and queries

**Cons:**
- More files (command, handler, validator, response)
- Indirection can be confusing initially
- Overhead for simple operations

### Option 3: CQRS with Custom Dispatcher
Build own command/query infrastructure.

**Pros:**
- Full control
- No external dependency

**Cons:**
- Reinventing the wheel
- Maintenance burden
- Missing ecosystem (behaviors, etc.)

## Decision

We choose **CQRS with MediatR** for the following reasons:

1. **Separation of Concerns**: Each handler does one thing
2. **Pipeline Behaviors**: Validation, logging, performance monitoring applied automatically
3. **Testability**: Handlers are easy to unit test
4. **Scalability**: Easy to add new operations without touching existing code
5. **Community**: Well-established pattern with good documentation

## Implementation

### Commands (Write Operations)

```csharp
// Command definition
public record CreateOrderCommand(
    int CustomerId,
    List<OrderItemDto> Items) : IRequest<Result<int>>;

// Handler
public class CreateOrderCommandHandler
    : IRequestHandler<CreateOrderCommand, Result<int>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IUnitOfWork _unitOfWork;

    public async Task<Result<int>> Handle(
        CreateOrderCommand request,
        CancellationToken ct)
    {
        // Create order
        // Save to repository
        // Return result
    }
}

// Validator
public class CreateOrderCommandValidator
    : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        RuleFor(x => x.Items).NotEmpty();
    }
}
```

### Queries (Read Operations)

```csharp
// Query definition
public record GetOrderByIdQuery(int Id) : IRequest<Result<OrderResponse>>;

// Handler
public class GetOrderByIdQueryHandler
    : IRequestHandler<GetOrderByIdQuery, Result<OrderResponse>>
{
    private readonly IApplicationDbContext _context;

    public async Task<Result<OrderResponse>> Handle(
        GetOrderByIdQuery request,
        CancellationToken ct)
    {
        var order = await _context.Orders
            .AsNoTracking()
            .ProjectTo<OrderResponse>()
            .FirstOrDefaultAsync(o => o.Id == request.Id, ct);

        return order is not null
            ? Result.Success(order)
            : Result.Failure<OrderResponse>(DomainErrors.Order.NotFound);
    }
}
```

### Pipeline Behaviors

```csharp
// Execution order
services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(ApplicationAssembly).Assembly);
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(UnhandledExceptionBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(PerformanceBehavior<,>));
});
```

## Consequences

### Positive
- Clear structure for all operations
- Easy to add validation
- Logging and metrics automatically applied
- Unit testing is straightforward

### Negative
- More files per feature
- Indirection may confuse newcomers
- Some overhead for very simple operations

### Guidelines

1. Use commands for any state-changing operation
2. Use queries for all read operations
3. Commands return `Result<T>` (not the entity)
4. Queries can use projection for performance
5. One handler per command/query
6. Validators are optional but recommended for commands

## File Organization

```
Features/
└── Orders/
    ├── Commands/
    │   ├── CreateOrder/
    │   │   ├── CreateOrderCommand.cs
    │   │   ├── CreateOrderCommandHandler.cs
    │   │   └── CreateOrderCommandValidator.cs
    │   └── UpdateOrder/
    │       └── ...
    └── Queries/
        ├── GetOrderById/
        │   ├── GetOrderByIdQuery.cs
        │   └── GetOrderByIdQueryHandler.cs
        └── GetOrders/
            └── ...
```

## References

- [MediatR Documentation](https://github.com/jbogard/MediatR)
- [CQRS Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs)
