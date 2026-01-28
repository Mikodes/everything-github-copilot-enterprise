# Approved Patterns

This document contains patterns approved for use in this project.

## Domain Patterns

### Rich Domain Entity

```csharp
public class Order : Entity<int>, IAggregateRoot
{
    private readonly List<OrderItem> _items = [];

    // Properties with private setters
    public OrderStatus Status { get; private set; }

    // Collections as readonly
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    // Factory method for creation
    public static Order Create(Customer customer, DateTime createdAt)
    {
        var order = new Order
        {
            CustomerId = customer.Id,
            Status = OrderStatus.Draft,
            CreatedAt = createdAt
        };
        order.AddDomainEvent(new OrderCreatedEvent(order));
        return order;
    }

    // Domain methods with business logic
    public void Submit()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Only draft orders can be submitted");

        Status = OrderStatus.Pending;
        AddDomainEvent(new OrderSubmittedEvent(this));
    }
}
```

### Value Object

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

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
```

## Application Patterns

### Command with Handler

```csharp
public record CreateOrderCommand(int CustomerId, List<OrderItemDto> Items)
    : IRequest<Result<int>>;

public class CreateOrderCommandHandler
    : IRequestHandler<CreateOrderCommand, Result<int>>
{
    private readonly IOrderRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateOrderCommandHandler(
        IOrderRepository repository,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<int>> Handle(
        CreateOrderCommand request,
        CancellationToken ct)
    {
        // Validation via FluentValidation pipeline
        // Business logic
        // Persistence
        // Return result
    }
}
```

### Query with Projection

```csharp
public record GetOrdersQuery(
    int? CustomerId,
    OrderStatus? Status,
    int Page = 1,
    int PageSize = 20) : IRequest<Result<PagedResult<OrderListItem>>>;

public class GetOrdersQueryHandler
    : IRequestHandler<GetOrdersQuery, Result<PagedResult<OrderListItem>>>
{
    private readonly IApplicationDbContext _context;

    public async Task<Result<PagedResult<OrderListItem>>> Handle(
        GetOrdersQuery request,
        CancellationToken ct)
    {
        var query = _context.Orders.AsNoTracking();

        if (request.CustomerId.HasValue)
            query = query.Where(o => o.CustomerId == request.CustomerId);

        if (request.Status.HasValue)
            query = query.Where(o => o.Status == request.Status);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(o => new OrderListItem(o.Id, o.Status, o.Total))
            .ToListAsync(ct);

        return new PagedResult<OrderListItem>(
            items, request.Page, request.PageSize, totalCount);
    }
}
```

### Result Pattern

```csharp
public class Result<T>
{
    public T? Value { get; }
    public Error? Error { get; }
    public bool IsSuccess => Error is null;
    public bool IsFailure => !IsSuccess;

    private Result(T? value, Error? error)
    {
        Value = value;
        Error = error;
    }

    public static Result<T> Success(T value) => new(value, null);
    public static Result<T> Failure(Error error) => new(default, error);
}

public record Error(string Code, string Message);

public static class DomainErrors
{
    public static class Order
    {
        public static Error NotFound => new("Order.NotFound", "Order was not found");
        public static Error InvalidStatus => new("Order.InvalidStatus", "Invalid order status");
    }
}
```

## API Patterns

### Minimal API Endpoint

```csharp
public static class OrderEndpoints
{
    public static RouteGroupBuilder MapOrderEndpoints(this RouteGroupBuilder group)
    {
        var orders = group.MapGroup("/orders").WithTags("Orders");

        orders.MapGet("/", GetOrders);
        orders.MapGet("/{id:int}", GetOrderById);
        orders.MapPost("/", CreateOrder);

        return group;
    }

    private static async Task<IResult> GetOrderById(
        int id,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.Send(new GetOrderByIdQuery(id), ct);

        return result.IsSuccess
            ? TypedResults.Ok(result.Value)
            : TypedResults.NotFound();
    }
}
```

## Testing Patterns

### Unit Test with AAA

```csharp
[Fact]
public async Task CreateOrder_WithValidData_ReturnsOrderId()
{
    // Arrange
    var customer = CustomerBuilder.Create().Build();
    var command = new CreateOrderCommand(customer.Id, items);

    _customerRepository.GetByIdAsync(customer.Id).Returns(customer);

    // Act
    var result = await _handler.Handle(command, CancellationToken.None);

    // Assert
    result.IsSuccess.Should().BeTrue();
    result.Value.Should().BeGreaterThan(0);

    await _orderRepository.Received(1).AddAsync(Arg.Any<Order>());
}
```

### Test Builder

```csharp
public class OrderBuilder
{
    private int _customerId = 1;
    private OrderStatus _status = OrderStatus.Draft;
    private readonly List<OrderItem> _items = [];

    public static OrderBuilder Create() => new();

    public OrderBuilder WithCustomerId(int id)
    {
        _customerId = id;
        return this;
    }

    public OrderBuilder WithStatus(OrderStatus status)
    {
        _status = status;
        return this;
    }

    public OrderBuilder WithItem(int productId, int quantity, decimal price)
    {
        _items.Add(new OrderItem(productId, quantity, Money.Create(price, "USD")));
        return this;
    }

    public Order Build()
    {
        var order = new Order { CustomerId = _customerId, Status = _status };
        foreach (var item in _items) order.AddItem(item);
        return order;
    }
}
```

## Infrastructure Patterns

### Repository Implementation

```csharp
public class OrderRepository : IOrderRepository
{
    private readonly ApplicationDbContext _context;

    public OrderRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await _context.Orders.FindAsync([id], ct);
    }

    public async Task<Order?> GetByIdWithItemsAsync(int id, CancellationToken ct)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
    }

    public async Task AddAsync(Order order, CancellationToken ct)
    {
        await _context.Orders.AddAsync(order, ct);
    }
}
```

### EF Core Configuration

```csharp
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.OwnsOne(o => o.Total, money =>
        {
            money.Property(m => m.Amount).HasPrecision(18, 2);
            money.Property(m => m.Currency).HasMaxLength(3);
        });

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(o => o.CustomerId);
        builder.HasIndex(o => o.Status);
    }
}
```
