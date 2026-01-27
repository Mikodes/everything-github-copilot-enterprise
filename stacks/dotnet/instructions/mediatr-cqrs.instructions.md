---
applyTo: "**/*.cs"
excludeAgent: ""
---

# MediatR & CQRS Instructions

These instructions define patterns for implementing CQRS (Command Query Responsibility Segregation) using MediatR in .NET applications.

## MediatR Setup

### Registration

```csharp
// Program.cs or DependencyInjection.cs
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(ApplicationAssemblyMarker).Assembly);

    // Pipeline behaviors (order matters!)
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(UnhandledExceptionBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(PerformanceBehavior<,>));
});
```

## Command Pattern

### Command Definition

```csharp
// ✅ Commands represent intent to change state
public record CreateOrderCommand(
    int CustomerId,
    List<OrderItemDto> Items,
    string? Notes) : IRequest<Result<OrderResponse>>;

// ✅ Command with no return (void operation)
public record DeleteOrderCommand(int OrderId) : IRequest<Result>;

// ✅ Use records for immutability
public record UpdateOrderCommand(
    int OrderId,
    OrderStatus NewStatus,
    string? Reason) : IRequest<Result<OrderResponse>>;
```

### Command Handler

```csharp
// ✅ Handler with clear responsibilities
public class CreateOrderCommandHandler
    : IRequestHandler<CreateOrderCommand, Result<OrderResponse>>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly TimeProvider _timeProvider;

    public CreateOrderCommandHandler(
        IOrderRepository orderRepository,
        ICustomerRepository customerRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        TimeProvider timeProvider)
    {
        _orderRepository = orderRepository;
        _customerRepository = customerRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _timeProvider = timeProvider;
    }

    public async Task<Result<OrderResponse>> Handle(
        CreateOrderCommand request,
        CancellationToken cancellationToken)
    {
        // Validate business rules
        var customer = await _customerRepository.GetByIdAsync(
            request.CustomerId, cancellationToken);

        if (customer is null)
        {
            return Result.Failure<OrderResponse>(
                DomainErrors.Customer.NotFound(request.CustomerId));
        }

        if (!customer.IsActive)
        {
            return Result.Failure<OrderResponse>(
                DomainErrors.Customer.Inactive(request.CustomerId));
        }

        // Create domain entity
        var order = Order.Create(
            customer,
            request.Notes,
            _timeProvider.GetUtcNow().DateTime);

        foreach (var item in request.Items)
        {
            order.AddItem(item.ProductId, item.Quantity, item.UnitPrice);
        }

        // Persist
        await _orderRepository.AddAsync(order, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Return response
        var response = _mapper.Map<OrderResponse>(order);
        return Result.Success(response);
    }
}
```

### Command Validation

```csharp
// ✅ FluentValidation for commands
public class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.CustomerId)
            .GreaterThan(0)
            .WithMessage("Customer ID must be greater than 0");

        RuleFor(x => x.Items)
            .NotEmpty()
            .WithMessage("Order must have at least one item");

        RuleForEach(x => x.Items)
            .ChildRules(item =>
            {
                item.RuleFor(i => i.ProductId)
                    .GreaterThan(0);
                item.RuleFor(i => i.Quantity)
                    .GreaterThan(0)
                    .LessThanOrEqualTo(100);
                item.RuleFor(i => i.UnitPrice)
                    .GreaterThan(0);
            });

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .When(x => x.Notes is not null);
    }
}
```

## Query Pattern

### Query Definition

```csharp
// ✅ Queries return data without side effects
public record GetOrderByIdQuery(int OrderId) : IRequest<Result<OrderResponse>>;

public record GetOrdersQuery(
    int? CustomerId,
    OrderStatus? Status,
    DateTime? FromDate,
    DateTime? ToDate,
    int Page = 1,
    int PageSize = 20) : IRequest<Result<PagedResult<OrderListItemResponse>>>;

public record GetOrderSummaryQuery(
    int CustomerId,
    int Year) : IRequest<Result<OrderSummaryResponse>>;
```

### Query Handler

```csharp
// ✅ Query handlers are typically simpler
public class GetOrderByIdQueryHandler
    : IRequestHandler<GetOrderByIdQuery, Result<OrderResponse>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public GetOrderByIdQueryHandler(
        IApplicationDbContext context,
        IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<Result<OrderResponse>> Handle(
        GetOrderByIdQuery request,
        CancellationToken cancellationToken)
    {
        var order = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Customer)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId, cancellationToken);

        if (order is null)
        {
            return Result.Failure<OrderResponse>(
                DomainErrors.Order.NotFound(request.OrderId));
        }

        return _mapper.Map<OrderResponse>(order);
    }
}

// ✅ Query with projection for performance
public class GetOrdersQueryHandler
    : IRequestHandler<GetOrdersQuery, Result<PagedResult<OrderListItemResponse>>>
{
    private readonly IApplicationDbContext _context;

    public async Task<Result<PagedResult<OrderListItemResponse>>> Handle(
        GetOrdersQuery request,
        CancellationToken cancellationToken)
    {
        var query = _context.Orders.AsNoTracking();

        // Apply filters
        if (request.CustomerId.HasValue)
            query = query.Where(o => o.CustomerId == request.CustomerId);

        if (request.Status.HasValue)
            query = query.Where(o => o.Status == request.Status);

        if (request.FromDate.HasValue)
            query = query.Where(o => o.CreatedAt >= request.FromDate);

        if (request.ToDate.HasValue)
            query = query.Where(o => o.CreatedAt <= request.ToDate);

        // Get total count
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply pagination and projection
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(o => new OrderListItemResponse(
                o.Id,
                o.OrderNumber,
                o.Customer.Name,
                o.Status,
                o.Total,
                o.CreatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResult<OrderListItemResponse>(
            items, request.Page, request.PageSize, totalCount);
    }
}
```

## Pipeline Behaviors

### Validation Behavior

```csharp
public class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!_validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);

        var validationResults = await Task.WhenAll(
            _validators.Select(v => v.ValidateAsync(context, cancellationToken)));

        var failures = validationResults
            .SelectMany(r => r.Errors)
            .Where(f => f is not null)
            .ToList();

        if (failures.Count != 0)
            throw new ValidationException(failures);

        return await next();
    }
}
```

### Logging Behavior

```csharp
public class LoggingBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;
    private readonly ICurrentUserService _currentUser;

    public LoggingBehavior(
        ILogger<LoggingBehavior<TRequest, TResponse>> logger,
        ICurrentUserService currentUser)
    {
        _logger = logger;
        _currentUser = currentUser;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        var userId = _currentUser.UserId ?? "Anonymous";

        _logger.LogInformation(
            "Handling {RequestName} for user {UserId}",
            requestName, userId);

        var response = await next();

        _logger.LogInformation(
            "Handled {RequestName} for user {UserId}",
            requestName, userId);

        return response;
    }
}
```

### Performance Behavior

```csharp
public class PerformanceBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<PerformanceBehavior<TRequest, TResponse>> _logger;
    private readonly Stopwatch _timer = new();

    public PerformanceBehavior(ILogger<PerformanceBehavior<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        _timer.Start();

        var response = await next();

        _timer.Stop();

        var elapsedMilliseconds = _timer.ElapsedMilliseconds;

        if (elapsedMilliseconds > 500)
        {
            var requestName = typeof(TRequest).Name;

            _logger.LogWarning(
                "Long running request: {RequestName} ({ElapsedMs}ms)",
                requestName, elapsedMilliseconds);
        }

        return response;
    }
}
```

### Transaction Behavior

```csharp
public class TransactionBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ICommand<TResponse> // Only for commands
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<TransactionBehavior<TRequest, TResponse>> _logger;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            _logger.LogInformation("Begin transaction for {RequestName}", requestName);

            var response = await next();

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation("Committed transaction for {RequestName}", requestName);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transaction failed for {RequestName}", requestName);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
```

## Notifications (Domain Events)

```csharp
// ✅ Define domain events
public record OrderCreatedEvent(Order Order) : INotification;
public record OrderStatusChangedEvent(Order Order, OrderStatus OldStatus) : INotification;

// ✅ Publish events
public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, Result<OrderResponse>>
{
    private readonly IPublisher _publisher;

    public async Task<Result<OrderResponse>> Handle(
        CreateOrderCommand request,
        CancellationToken cancellationToken)
    {
        // ... create order ...

        await _publisher.Publish(new OrderCreatedEvent(order), cancellationToken);

        return _mapper.Map<OrderResponse>(order);
    }
}

// ✅ Handle events
public class OrderCreatedEventHandler : INotificationHandler<OrderCreatedEvent>
{
    private readonly IEmailService _emailService;
    private readonly ILogger<OrderCreatedEventHandler> _logger;

    public async Task Handle(
        OrderCreatedEvent notification,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Order {OrderId} created", notification.Order.Id);

        await _emailService.SendOrderConfirmationAsync(
            notification.Order,
            cancellationToken);
    }
}

// ✅ Multiple handlers for same event
public class OrderCreatedInventoryHandler : INotificationHandler<OrderCreatedEvent>
{
    public async Task Handle(
        OrderCreatedEvent notification,
        CancellationToken cancellationToken)
    {
        // Reserve inventory
    }
}
```

## File Organization

```
Application/
├── Common/
│   ├── Interfaces/
│   │   ├── ICommand.cs
│   │   └── IQuery.cs
│   ├── Behaviors/
│   │   ├── ValidationBehavior.cs
│   │   ├── LoggingBehavior.cs
│   │   └── PerformanceBehavior.cs
│   └── Models/
│       ├── Result.cs
│       └── PagedResult.cs
├── Features/
│   ├── Orders/
│   │   ├── Commands/
│   │   │   ├── CreateOrder/
│   │   │   │   ├── CreateOrderCommand.cs
│   │   │   │   ├── CreateOrderCommandHandler.cs
│   │   │   │   └── CreateOrderCommandValidator.cs
│   │   │   └── UpdateOrderStatus/
│   │   │       └── ...
│   │   ├── Queries/
│   │   │   ├── GetOrderById/
│   │   │   │   ├── GetOrderByIdQuery.cs
│   │   │   │   └── GetOrderByIdQueryHandler.cs
│   │   │   └── GetOrders/
│   │   │       └── ...
│   │   └── EventHandlers/
│   │       └── OrderCreatedEventHandler.cs
│   └── Customers/
│       └── ...
└── DependencyInjection.cs
```

## Usage in Controllers

```csharp
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

        return result.IsSuccess
            ? Ok(result.Value)
            : NotFound(result.Error);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderCommand command, CancellationToken ct)
    {
        var result = await _sender.Send(command, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value)
            : BadRequest(result.Error);
    }
}
```
