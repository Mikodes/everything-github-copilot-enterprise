---
applyTo: "**/*.cs"
excludeAgent: ""
---

# xUnit Testing Instructions

These instructions define testing best practices using xUnit for .NET applications. Follow these patterns for reliable, maintainable tests.

## Project Structure

```
tests/
├── MyApp.Domain.Tests/
│   ├── Entities/
│   └── ValueObjects/
├── MyApp.Application.Tests/
│   ├── Features/
│   │   └── Orders/
│   │       ├── CreateOrderCommandTests.cs
│   │       └── GetOrderQueryTests.cs
│   └── Common/
├── MyApp.Infrastructure.Tests/
│   ├── Persistence/
│   └── Services/
├── MyApp.Api.Tests/
│   ├── Endpoints/
│   └── Integration/
└── MyApp.Tests.Common/
    ├── Builders/
    ├── Fakes/
    └── Fixtures/
```

## Test Naming Convention

```csharp
// ✅ Method_Scenario_ExpectedResult
[Fact]
public void CalculateTotal_WithDiscount_ReturnsDiscountedPrice()

[Fact]
public async Task CreateOrder_WithValidData_ReturnsCreatedOrder()

[Fact]
public void Validate_WhenEmailIsEmpty_ReturnsValidationError()

// ✅ For parameterized tests
[Theory]
[InlineData(100, 10, 90)]
[InlineData(200, 20, 160)]
public void CalculateTotal_WithVariousDiscounts_ReturnsCorrectAmount(
    decimal price, decimal discountPercent, decimal expected)
```

## Test Structure (AAA Pattern)

```csharp
[Fact]
public async Task CreateOrder_WithValidRequest_ReturnsCreatedOrder()
{
    // Arrange
    var customerId = 1;
    var request = new CreateOrderCommand
    {
        CustomerId = customerId,
        Items = [new OrderItemDto { ProductId = 1, Quantity = 2 }]
    };

    _customerRepository
        .GetByIdAsync(customerId, Arg.Any<CancellationToken>())
        .Returns(new Customer { Id = customerId, Name = "Test" });

    // Act
    var result = await _handler.Handle(request, CancellationToken.None);

    // Assert
    result.Should().NotBeNull();
    result.CustomerId.Should().Be(customerId);
    result.Items.Should().HaveCount(1);

    await _orderRepository.Received(1)
        .AddAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>());
}
```

## Unit Tests

### Testing Domain Entities

```csharp
public class OrderTests
{
    [Fact]
    public void AddItem_WithValidProduct_IncreasesTotalItemCount()
    {
        // Arrange
        var order = OrderBuilder.Create().Build();
        var product = ProductBuilder.Create().WithPrice(100m).Build();

        // Act
        order.AddItem(product, quantity: 2);

        // Assert
        order.Items.Should().HaveCount(1);
        order.Items.First().Quantity.Should().Be(2);
    }

    [Fact]
    public void AddItem_WithZeroQuantity_ThrowsArgumentException()
    {
        // Arrange
        var order = OrderBuilder.Create().Build();
        var product = ProductBuilder.Create().Build();

        // Act
        var act = () => order.AddItem(product, quantity: 0);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*quantity*");
    }

    [Theory]
    [InlineData(OrderStatus.Pending, OrderStatus.Confirmed, true)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Shipped, true)]
    [InlineData(OrderStatus.Shipped, OrderStatus.Pending, false)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Confirmed, false)]
    public void CanTransitionTo_VariousStatuses_ReturnsExpectedResult(
        OrderStatus current, OrderStatus target, bool expected)
    {
        // Arrange
        var order = OrderBuilder.Create().WithStatus(current).Build();

        // Act
        var result = order.CanTransitionTo(target);

        // Assert
        result.Should().Be(expected);
    }
}
```

### Testing Value Objects

```csharp
public class EmailTests
{
    [Theory]
    [InlineData("test@example.com")]
    [InlineData("user.name@domain.co.uk")]
    public void Create_WithValidEmail_ReturnsEmail(string email)
    {
        // Act
        var result = Email.Create(email);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Value.Should().Be(email);
    }

    [Theory]
    [InlineData("")]
    [InlineData("invalid")]
    [InlineData("missing@")]
    [InlineData("@nodomain.com")]
    public void Create_WithInvalidEmail_ReturnsFailure(string email)
    {
        // Act
        var result = Email.Create(email);

        // Assert
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Equals_WithSameValue_ReturnsTrue()
    {
        // Arrange
        var email1 = Email.Create("test@example.com").Value;
        var email2 = Email.Create("test@example.com").Value;

        // Act & Assert
        email1.Should().Be(email2);
        (email1 == email2).Should().BeTrue();
    }
}
```

### Testing Services with Mocks

```csharp
public class OrderServiceTests
{
    private readonly IOrderRepository _orderRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _timeProvider;
    private readonly OrderService _sut;

    public OrderServiceTests()
    {
        _orderRepository = Substitute.For<IOrderRepository>();
        _customerRepository = Substitute.For<ICustomerRepository>();
        _unitOfWork = Substitute.For<IUnitOfWork>();
        _timeProvider = new FakeTimeProvider(new DateTimeOffset(2024, 1, 15, 10, 0, 0, TimeSpan.Zero));

        _sut = new OrderService(
            _orderRepository,
            _customerRepository,
            _unitOfWork,
            _timeProvider);
    }

    [Fact]
    public async Task CreateAsync_WithValidRequest_SavesOrderAndReturnsResponse()
    {
        // Arrange
        var customerId = 1;
        var request = new CreateOrderRequest(customerId, [new(1, 2)]);

        _customerRepository
            .GetByIdAsync(customerId, Arg.Any<CancellationToken>())
            .Returns(new Customer { Id = customerId, Name = "Test Customer" });

        _orderRepository
            .When(r => r.AddAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>()))
            .Do(ci => ci.Arg<Order>().Id = 1);

        // Act
        var result = await _sut.CreateAsync(request, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.CustomerId.Should().Be(customerId);

        await _orderRepository.Received(1)
            .AddAsync(Arg.Is<Order>(o =>
                o.CustomerId == customerId &&
                o.CreatedAt == _timeProvider.GetUtcNow().DateTime),
                Arg.Any<CancellationToken>());

        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateAsync_WhenCustomerNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var request = new CreateOrderRequest(999, [new(1, 2)]);

        _customerRepository
            .GetByIdAsync(999, Arg.Any<CancellationToken>())
            .Returns((Customer?)null);

        // Act
        var act = () => _sut.CreateAsync(request, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Customer*999*");

        await _orderRepository.DidNotReceive()
            .AddAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>());
    }
}
```

## Integration Tests

### Testing with WebApplicationFactory

```csharp
public class OrdersEndpointTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public OrdersEndpointTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetOrders_ReturnsOkWithOrders()
    {
        // Arrange
        await _factory.SeedDataAsync(async context =>
        {
            context.Orders.Add(OrderBuilder.Create().Build());
            await context.SaveChangesAsync();
        });

        // Act
        var response = await _client.GetAsync("/api/orders");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var orders = await response.Content.ReadFromJsonAsync<List<OrderResponse>>();
        orders.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateOrder_WithValidData_ReturnsCreated()
    {
        // Arrange
        var request = new CreateOrderRequest(1, [new(1, 2)]);

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();

        var order = await response.Content.ReadFromJsonAsync<OrderResponse>();
        order.Should().NotBeNull();
        order!.Id.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task CreateOrder_WithInvalidData_ReturnsBadRequest()
    {
        // Arrange
        var request = new CreateOrderRequest(0, []); // Invalid

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Errors.Should().NotBeEmpty();
    }
}
```

### Custom WebApplicationFactory

```csharp
public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _dbContainer = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            // Remove the real database
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor != null)
                services.Remove(descriptor);

            // Add test database
            services.AddDbContext<ApplicationDbContext>(options =>
            {
                options.UseSqlServer(_dbContainer.GetConnectionString());
            });

            // Replace time provider
            services.AddSingleton<TimeProvider>(new FakeTimeProvider());

            // Replace external services
            services.AddSingleton(Substitute.For<IEmailService>());
        });
    }

    public async Task SeedDataAsync(Func<ApplicationDbContext, Task> seeder)
    {
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await seeder(context);
    }

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();

        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await _dbContainer.DisposeAsync();
    }
}
```

## Test Builders

```csharp
public class OrderBuilder
{
    private int _id = 1;
    private int _customerId = 1;
    private OrderStatus _status = OrderStatus.Pending;
    private List<OrderItem> _items = [];
    private DateTime _createdAt = DateTime.UtcNow;

    public static OrderBuilder Create() => new();

    public OrderBuilder WithId(int id)
    {
        _id = id;
        return this;
    }

    public OrderBuilder WithCustomerId(int customerId)
    {
        _customerId = customerId;
        return this;
    }

    public OrderBuilder WithStatus(OrderStatus status)
    {
        _status = status;
        return this;
    }

    public OrderBuilder WithItem(int productId, int quantity, decimal unitPrice)
    {
        _items.Add(new OrderItem
        {
            ProductId = productId,
            Quantity = quantity,
            UnitPrice = unitPrice
        });
        return this;
    }

    public OrderBuilder WithCreatedAt(DateTime createdAt)
    {
        _createdAt = createdAt;
        return this;
    }

    public Order Build()
    {
        var order = new Order
        {
            Id = _id,
            CustomerId = _customerId,
            Status = _status,
            CreatedAt = _createdAt
        };

        foreach (var item in _items)
        {
            order.Items.Add(item);
        }

        return order;
    }
}
```

## Testing Async Code

```csharp
[Fact]
public async Task ProcessAsync_WithMultipleItems_ProcessesAllInParallel()
{
    // Arrange
    var items = Enumerable.Range(1, 10).Select(i => new Item(i)).ToList();
    var processedIds = new ConcurrentBag<int>();

    _processor.ProcessItemAsync(Arg.Any<Item>(), Arg.Any<CancellationToken>())
        .Returns(async ci =>
        {
            await Task.Delay(10); // Simulate work
            processedIds.Add(ci.Arg<Item>().Id);
        });

    // Act
    await _sut.ProcessAllAsync(items, CancellationToken.None);

    // Assert
    processedIds.Should().BeEquivalentTo(items.Select(i => i.Id));
}

[Fact]
public async Task ProcessAsync_WhenCancelled_StopsProcessing()
{
    // Arrange
    using var cts = new CancellationTokenSource();
    var items = Enumerable.Range(1, 100).Select(i => new Item(i)).ToList();

    _processor.ProcessItemAsync(Arg.Any<Item>(), Arg.Any<CancellationToken>())
        .Returns(async ci =>
        {
            await Task.Delay(100);
            ci.Arg<CancellationToken>().ThrowIfCancellationRequested();
        });

    // Act
    cts.CancelAfter(50);
    var act = () => _sut.ProcessAllAsync(items, cts.Token);

    // Assert
    await act.Should().ThrowAsync<OperationCanceledException>();
}
```

## Common Assertions with FluentAssertions

```csharp
// Collections
result.Should().NotBeNull();
result.Should().BeEmpty();
result.Should().HaveCount(5);
result.Should().Contain(x => x.Id == 1);
result.Should().BeInAscendingOrder(x => x.Name);
result.Should().AllSatisfy(x => x.IsActive.Should().BeTrue());

// Objects
order.Should().BeEquivalentTo(expected);
order.Should().BeEquivalentTo(expected, options =>
    options.Excluding(o => o.CreatedAt));

// Exceptions
act.Should().Throw<ArgumentException>()
    .WithMessage("*invalid*")
    .WithInnerException<InvalidOperationException>();

await actAsync.Should().ThrowAsync<ValidationException>()
    .Where(e => e.Errors.Any());

// Time
result.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));

// Strings
result.Email.Should().MatchRegex(@"^[\w.-]+@[\w.-]+\.\w+$");
result.Name.Should().StartWith("Order-");
```

## Test Categories

```csharp
// Use traits for categorization
[Fact]
[Trait("Category", "Unit")]
public void UnitTest() { }

[Fact]
[Trait("Category", "Integration")]
public async Task IntegrationTest() { }

[Fact]
[Trait("Category", "Slow")]
public async Task SlowTest() { }

// Run specific categories:
// dotnet test --filter "Category=Unit"
// dotnet test --filter "Category!=Slow"
```
