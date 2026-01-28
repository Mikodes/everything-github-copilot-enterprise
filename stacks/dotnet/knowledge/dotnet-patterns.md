# .NET Approved Patterns

This document contains approved patterns for .NET development in this project. Follow these patterns for consistency and maintainability.

## Architecture Patterns

### Clean Architecture

Our projects follow Clean Architecture with these layers:

```
Domain (innermost)
  └── Application
        └── Infrastructure
              └── Presentation (outermost)
```

**Rules:**
- Domain has no external dependencies
- Application depends only on Domain
- Infrastructure implements Application interfaces
- Presentation orchestrates calls

### CQRS with MediatR

Use Command Query Responsibility Segregation for complex domains:

```csharp
// Command (changes state)
public record CreateOrderCommand(int CustomerId, List<OrderItemDto> Items)
    : IRequest<Result<int>>;

// Query (returns data)
public record GetOrderByIdQuery(int Id) : IRequest<Result<OrderResponse>>;

// Handler
public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, Result<int>>
{
    public async Task<Result<int>> Handle(CreateOrderCommand request, CancellationToken ct)
    {
        // Implementation
    }
}
```

### Result Pattern

Use Result pattern instead of exceptions for expected failures:

```csharp
public class Result<T>
{
    public T? Value { get; }
    public Error? Error { get; }
    public bool IsSuccess => Error is null;
    public bool IsFailure => !IsSuccess;

    public static Result<T> Success(T value) => new(value, null);
    public static Result<T> Failure(Error error) => new(default, error);
}

// Usage
public async Task<Result<Order>> CreateOrderAsync(CreateOrderRequest request)
{
    var customer = await _customerRepo.GetByIdAsync(request.CustomerId);

    if (customer is null)
        return Result.Failure<Order>(DomainErrors.Customer.NotFound);

    // Continue with order creation
    return Result.Success(order);
}
```

## Domain Patterns

### Rich Domain Entities

Entities encapsulate business logic:

```csharp
public class Order : Entity<int>, IAggregateRoot
{
    private readonly List<OrderItem> _items = [];

    // Private setter - modify only through methods
    public OrderStatus Status { get; private set; }

    // Factory method for creation
    public static Order Create(Customer customer, DateTime createdAt)
    {
        Guard.Against.Null(customer);

        var order = new Order
        {
            CustomerId = customer.Id,
            Status = OrderStatus.Draft,
            CreatedAt = createdAt
        };

        order.AddDomainEvent(new OrderCreatedEvent(order));
        return order;
    }

    // Domain method with business rules
    public void Submit()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Only draft orders can be submitted");

        if (!_items.Any())
            throw new DomainException("Order must have items");

        Status = OrderStatus.Submitted;
        AddDomainEvent(new OrderSubmittedEvent(this));
    }
}
```

### Value Objects

Use value objects for concepts defined by their attributes:

```csharp
public sealed class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Money Create(decimal amount, string currency)
    {
        if (amount < 0)
            throw new DomainException("Amount cannot be negative");

        return new Money(amount, currency.ToUpperInvariant());
    }

    public static Money operator +(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new DomainException("Cannot add different currencies");

        return new Money(a.Amount + b.Amount, a.Currency);
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
```

### Domain Events

Raise events when significant domain changes occur:

```csharp
public abstract record DomainEvent
{
    public Guid Id { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}

public record OrderCreatedEvent(Order Order) : DomainEvent;
public record OrderShippedEvent(Order Order) : DomainEvent;
```

## Data Access Patterns

### Repository Pattern

Abstract data access behind interfaces:

```csharp
// Interface in Application layer
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<Order?> GetByIdWithItemsAsync(int id, CancellationToken ct = default);
    Task AddAsync(Order order, CancellationToken ct = default);
    void Update(Order order);
}

// Implementation in Infrastructure
public class OrderRepository : IOrderRepository
{
    private readonly ApplicationDbContext _context;

    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        return await _context.Orders.FindAsync([id], ct);
    }
}
```

### Unit of Work

Coordinate multiple repository operations:

```csharp
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

// Usage
public async Task<Order> CreateOrderAsync(CreateOrderRequest request, CancellationToken ct)
{
    var order = Order.Create(customer, DateTime.UtcNow);
    await _orderRepository.AddAsync(order, ct);
    await _unitOfWork.SaveChangesAsync(ct);
    return order;
}
```

### Specification Pattern

Encapsulate query logic:

```csharp
public interface ISpecification<T>
{
    Expression<Func<T, bool>>? Criteria { get; }
    List<Expression<Func<T, object>>> Includes { get; }
    Expression<Func<T, object>>? OrderBy { get; }
    int? Take { get; }
    int? Skip { get; }
}

public class OrdersByCustomerSpec : Specification<Order>
{
    public OrdersByCustomerSpec(int customerId)
    {
        Query.Where(o => o.CustomerId == customerId)
             .Include(o => o.Items)
             .OrderByDescending(o => o.CreatedAt);
    }
}
```

## API Patterns

### REST Endpoints

Follow REST conventions:

```csharp
// Resource-based URLs
GET    /api/orders           // List
GET    /api/orders/{id}      // Get single
POST   /api/orders           // Create
PUT    /api/orders/{id}      // Full update
PATCH  /api/orders/{id}      // Partial update
DELETE /api/orders/{id}      // Delete

// Sub-resources
GET    /api/orders/{id}/items
POST   /api/orders/{id}/items
```

### Problem Details for Errors

Return RFC 7807 Problem Details:

```csharp
return TypedResults.Problem(
    statusCode: StatusCodes.Status404NotFound,
    title: "Order not found",
    detail: $"Order with ID {id} was not found",
    instance: context.Request.Path);
```

### Pagination

Always paginate collections:

```csharp
public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}
```

## Service Patterns

### Dependency Injection

Register services by lifetime:

```csharp
// Singleton - one instance for app lifetime
builder.Services.AddSingleton<ICacheService, MemoryCacheService>();

// Scoped - one instance per request
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AppDbContext>());

// Transient - new instance each time
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();
```

### Options Pattern

Configure services with strongly-typed options:

```csharp
public class JwtOptions
{
    public const string SectionName = "Jwt";
    public required string Issuer { get; init; }
    public required string SecretKey { get; init; }
}

// Registration
builder.Services.AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Usage
public class TokenService(IOptions<JwtOptions> options)
{
    private readonly JwtOptions _options = options.Value;
}
```

### Service Layer

Business logic in services:

```csharp
public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _timeProvider;

    public async Task<Result<Order>> CreateAsync(CreateOrderRequest request, CancellationToken ct)
    {
        // Validation
        // Business logic
        // Persistence
        // Return result
    }
}
```

## Validation Patterns

### FluentValidation

Separate validation logic:

```csharp
public class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.CustomerId)
            .GreaterThan(0);

        RuleFor(x => x.Items)
            .NotEmpty()
            .WithMessage("Order must have at least one item");

        RuleForEach(x => x.Items)
            .SetValidator(new OrderItemValidator());
    }
}
```

### Validation Pipeline Behavior

Validate in MediatR pipeline:

```csharp
public class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        if (!_validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);
        var results = await Task.WhenAll(
            _validators.Select(v => v.ValidateAsync(context, ct)));

        var failures = results
            .SelectMany(r => r.Errors)
            .Where(f => f is not null)
            .ToList();

        if (failures.Any())
            throw new ValidationException(failures);

        return await next();
    }
}
```

## Testing Patterns

### Test Naming

```csharp
// Method_Scenario_ExpectedResult
[Fact]
public void CreateOrder_WithValidData_ReturnsOrder()

[Fact]
public async Task GetById_WhenNotFound_ReturnsNotFoundResult()
```

### AAA Pattern

```csharp
[Fact]
public async Task CreateOrder_WithValidRequest_SavesAndReturnsOrder()
{
    // Arrange
    var request = new CreateOrderCommand(1, items);
    _customerRepo.GetByIdAsync(1).Returns(new Customer());

    // Act
    var result = await _handler.Handle(request, CancellationToken.None);

    // Assert
    result.IsSuccess.Should().BeTrue();
    await _orderRepo.Received(1).AddAsync(Arg.Any<Order>());
}
```

### Test Builders

```csharp
public class OrderBuilder
{
    private int _customerId = 1;
    private OrderStatus _status = OrderStatus.Draft;

    public OrderBuilder WithCustomerId(int id) { _customerId = id; return this; }
    public OrderBuilder WithStatus(OrderStatus status) { _status = status; return this; }

    public Order Build() => new Order { CustomerId = _customerId, Status = _status };
}
```

## Async Patterns

### Async/Await Best Practices

```csharp
// Always use async suffix
public async Task<Order> GetOrderAsync(int id, CancellationToken ct)

// Always pass CancellationToken
await _repository.GetByIdAsync(id, cancellationToken);

// Don't use .Result or .Wait()
// ❌ var order = _service.GetOrderAsync(id).Result;
// ✅ var order = await _service.GetOrderAsync(id);

// Use ConfigureAwait(false) in libraries
await Task.Delay(100).ConfigureAwait(false);
```

### Parallel Operations

```csharp
// Parallel independent operations
var customerTask = _customerService.GetByIdAsync(customerId, ct);
var productsTask = _productService.GetByIdsAsync(productIds, ct);

await Task.WhenAll(customerTask, productsTask);

var customer = await customerTask;
var products = await productsTask;
```
