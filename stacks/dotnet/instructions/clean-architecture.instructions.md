---
applyTo: "**/*.cs"
excludeAgent: ""
---

# Clean Architecture Instructions

These instructions define patterns for implementing Clean Architecture in .NET applications. Follow these principles for maintainable, testable, and scalable systems.

## Core Principles

1. **Dependency Rule**: Dependencies point inward (Domain has no external dependencies)
2. **Independence**: Business logic is independent of frameworks, UI, and databases
3. **Testability**: Business rules can be tested without external dependencies
4. **Flexibility**: External components can be replaced without affecting business logic

## Layer Structure

```
Solution/
├── src/
│   ├── MyApp.Domain/           # Enterprise Business Rules
│   ├── MyApp.Application/      # Application Business Rules
│   ├── MyApp.Infrastructure/   # External Concerns
│   └── MyApp.WebApi/           # Presentation
└── tests/
    ├── MyApp.Domain.Tests/
    ├── MyApp.Application.Tests/
    ├── MyApp.Infrastructure.Tests/
    └── MyApp.WebApi.Tests/
```

## Domain Layer

The innermost layer containing enterprise business rules.

### Entities

```csharp
// ✅ Rich domain entity
public class Order : Entity<int>, IAggregateRoot
{
    private readonly List<OrderItem> _items = [];
    private readonly List<DomainEvent> _domainEvents = [];

    public string OrderNumber { get; private set; } = default!;
    public int CustomerId { get; private set; }
    public Customer Customer { get; private set; } = default!;
    public OrderStatus Status { get; private set; }
    public Money Total { get; private set; } = Money.Zero;
    public Address ShippingAddress { get; private set; } = default!;
    public DateTime CreatedAt { get; private set; }
    public DateTime? ShippedAt { get; private set; }

    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public IReadOnlyCollection<DomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    private Order() { } // EF Core

    public static Order Create(
        Customer customer,
        Address shippingAddress,
        DateTime createdAt)
    {
        Guard.Against.Null(customer);
        Guard.Against.Null(shippingAddress);

        var order = new Order
        {
            OrderNumber = GenerateOrderNumber(),
            CustomerId = customer.Id,
            Customer = customer,
            Status = OrderStatus.Pending,
            ShippingAddress = shippingAddress,
            CreatedAt = createdAt
        };

        order.AddDomainEvent(new OrderCreatedEvent(order));

        return order;
    }

    public void AddItem(Product product, int quantity)
    {
        Guard.Against.Null(product);
        Guard.Against.NegativeOrZero(quantity);

        if (Status != OrderStatus.Pending)
            throw new DomainException("Cannot modify a non-pending order");

        var existingItem = _items.FirstOrDefault(i => i.ProductId == product.Id);

        if (existingItem is not null)
        {
            existingItem.IncreaseQuantity(quantity);
        }
        else
        {
            _items.Add(new OrderItem(product, quantity));
        }

        RecalculateTotal();
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new DomainException("Only pending orders can be confirmed");

        if (!_items.Any())
            throw new DomainException("Cannot confirm an empty order");

        Status = OrderStatus.Confirmed;
        AddDomainEvent(new OrderConfirmedEvent(this));
    }

    public void Ship(DateTime shippedAt)
    {
        if (Status != OrderStatus.Confirmed)
            throw new DomainException("Only confirmed orders can be shipped");

        Status = OrderStatus.Shipped;
        ShippedAt = shippedAt;
        AddDomainEvent(new OrderShippedEvent(this));
    }

    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Shipped || Status == OrderStatus.Delivered)
            throw new DomainException("Cannot cancel shipped or delivered orders");

        var previousStatus = Status;
        Status = OrderStatus.Cancelled;
        AddDomainEvent(new OrderCancelledEvent(this, previousStatus, reason));
    }

    private void RecalculateTotal()
    {
        Total = _items.Aggregate(
            Money.Zero,
            (sum, item) => sum + item.LineTotal);
    }

    private void AddDomainEvent(DomainEvent domainEvent)
    {
        _domainEvents.Add(domainEvent);
    }

    public void ClearDomainEvents() => _domainEvents.Clear();

    private static string GenerateOrderNumber() =>
        $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..8].ToUpper()}";
}
```

### Value Objects

```csharp
// ✅ Immutable value object
public sealed class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    public static Money Zero => new(0, "USD");

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Money Create(decimal amount, string currency = "USD")
    {
        if (amount < 0)
            throw new DomainException("Amount cannot be negative");

        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
            throw new DomainException("Invalid currency code");

        return new Money(amount, currency.ToUpperInvariant());
    }

    public static Money operator +(Money left, Money right)
    {
        if (left.Currency != right.Currency)
            throw new DomainException("Cannot add different currencies");

        return new Money(left.Amount + right.Amount, left.Currency);
    }

    public static Money operator *(Money money, int multiplier)
    {
        return new Money(money.Amount * multiplier, money.Currency);
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }

    public override string ToString() => $"{Amount:N2} {Currency}";
}

// ✅ Value object with validation
public sealed class Email : ValueObject
{
    public string Value { get; }

    private Email(string value) => Value = value;

    public static Result<Email> Create(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Result.Failure<Email>(DomainErrors.Email.Empty);

        email = email.Trim().ToLowerInvariant();

        if (email.Length > 320)
            return Result.Failure<Email>(DomainErrors.Email.TooLong);

        if (!IsValidFormat(email))
            return Result.Failure<Email>(DomainErrors.Email.InvalidFormat);

        return new Email(email);
    }

    private static bool IsValidFormat(string email) =>
        Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;
}
```

### Domain Events

```csharp
// ✅ Domain event base
public abstract class DomainEvent
{
    public Guid Id { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}

// ✅ Specific domain events
public sealed class OrderCreatedEvent : DomainEvent
{
    public Order Order { get; }
    public OrderCreatedEvent(Order order) => Order = order;
}

public sealed class OrderConfirmedEvent : DomainEvent
{
    public Order Order { get; }
    public OrderConfirmedEvent(Order order) => Order = order;
}
```

### Domain Services

```csharp
// ✅ Domain service for cross-aggregate logic
public class OrderPricingService
{
    public Money CalculateOrderTotal(
        IEnumerable<OrderItem> items,
        DiscountPolicy? discount,
        TaxPolicy taxPolicy)
    {
        var subtotal = items.Aggregate(
            Money.Zero,
            (sum, item) => sum + item.LineTotal);

        var discountedTotal = discount?.Apply(subtotal) ?? subtotal;
        var finalTotal = taxPolicy.Apply(discountedTotal);

        return finalTotal;
    }
}
```

## Application Layer

Contains application business rules and use cases.

### Use Cases (Commands/Queries)

```csharp
// ✅ Command with handler
public record CreateOrderCommand(
    int CustomerId,
    List<OrderItemDto> Items,
    AddressDto ShippingAddress) : IRequest<Result<int>>;

public class CreateOrderCommandHandler
    : IRequestHandler<CreateOrderCommand, Result<int>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IProductRepository _productRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _timeProvider;

    public CreateOrderCommandHandler(
        IOrderRepository orderRepository,
        ICustomerRepository customerRepository,
        IProductRepository productRepository,
        IUnitOfWork unitOfWork,
        TimeProvider timeProvider)
    {
        _orderRepository = orderRepository;
        _customerRepository = customerRepository;
        _productRepository = productRepository;
        _unitOfWork = unitOfWork;
        _timeProvider = timeProvider;
    }

    public async Task<Result<int>> Handle(
        CreateOrderCommand request,
        CancellationToken cancellationToken)
    {
        var customer = await _customerRepository.GetByIdAsync(
            request.CustomerId, cancellationToken);

        if (customer is null)
            return Result.Failure<int>(DomainErrors.Customer.NotFound);

        var shippingAddress = Address.Create(
            request.ShippingAddress.Street,
            request.ShippingAddress.City,
            request.ShippingAddress.PostalCode,
            request.ShippingAddress.Country);

        var order = Order.Create(
            customer,
            shippingAddress,
            _timeProvider.GetUtcNow().DateTime);

        foreach (var item in request.Items)
        {
            var product = await _productRepository.GetByIdAsync(
                item.ProductId, cancellationToken);

            if (product is null)
                return Result.Failure<int>(DomainErrors.Product.NotFound);

            order.AddItem(product, item.Quantity);
        }

        await _orderRepository.AddAsync(order, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return order.Id;
    }
}
```

### Application Interfaces

```csharp
// ✅ Repository interfaces (defined in Application, implemented in Infrastructure)
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<Order?> GetByIdWithItemsAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<Order>> GetByCustomerIdAsync(int customerId, CancellationToken ct = default);
    Task AddAsync(Order order, CancellationToken ct = default);
    void Update(Order order);
    void Remove(Order order);
}

// ✅ Unit of Work interface
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken ct = default);
}

// ✅ External service interfaces
public interface IEmailService
{
    Task SendOrderConfirmationAsync(Order order, CancellationToken ct = default);
}

public interface IPaymentService
{
    Task<PaymentResult> ProcessPaymentAsync(Payment payment, CancellationToken ct = default);
}
```

## Infrastructure Layer

Contains implementations for external concerns.

### Repository Implementation

```csharp
// ✅ EF Core repository implementation
public class OrderRepository : IOrderRepository
{
    private readonly ApplicationDbContext _context;

    public OrderRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        return await _context.Orders.FindAsync([id], ct);
    }

    public async Task<Order?> GetByIdWithItemsAsync(int id, CancellationToken ct = default)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
    }

    public async Task<IReadOnlyList<Order>> GetByCustomerIdAsync(
        int customerId, CancellationToken ct = default)
    {
        return await _context.Orders
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task AddAsync(Order order, CancellationToken ct = default)
    {
        await _context.Orders.AddAsync(order, ct);
    }

    public void Update(Order order)
    {
        _context.Orders.Update(order);
    }

    public void Remove(Order order)
    {
        _context.Orders.Remove(order);
    }
}
```

### DbContext Configuration

```csharp
// ✅ DbContext with domain event dispatching
public class ApplicationDbContext : DbContext, IUnitOfWork
{
    private readonly IPublisher _publisher;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        IPublisher publisher)
        : base(options)
    {
        _publisher = publisher;
    }

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ApplicationDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        // Dispatch domain events before saving
        var domainEvents = ChangeTracker.Entries<Entity>()
            .SelectMany(e => e.Entity.DomainEvents)
            .ToList();

        var result = await base.SaveChangesAsync(ct);

        // Dispatch events after successful save
        foreach (var domainEvent in domainEvents)
        {
            await _publisher.Publish(domainEvent, ct);
        }

        // Clear events
        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            entry.Entity.ClearDomainEvents();
        }

        return result;
    }

    public async Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken ct = default)
    {
        return await Database.BeginTransactionAsync(ct);
    }
}
```

## Presentation Layer (WebApi)

```csharp
// ✅ Thin controller - delegates to MediatR
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly ISender _sender;

    public OrdersController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _sender.Send(new GetOrderByIdQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request, CancellationToken ct)
    {
        var command = new CreateOrderCommand(
            request.CustomerId,
            request.Items,
            request.ShippingAddress);

        var result = await _sender.Send(command, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { id = result.Value }, null)
            : BadRequest(result.Error);
    }
}
```

## Dependency Injection Setup

```csharp
// ✅ Layer-specific registration extensions
// Application/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        return services;
    }
}

// Infrastructure/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("Default")));

        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<ApplicationDbContext>());

        services.AddScoped<IEmailService, SmtpEmailService>();

        return services;
    }
}

// Program.cs
builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration);
```
