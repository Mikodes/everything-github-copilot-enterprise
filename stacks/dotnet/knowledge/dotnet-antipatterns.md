# .NET Anti-patterns to Avoid

This document lists anti-patterns commonly found in .NET applications. Avoid these patterns to maintain code quality and performance.

## Architecture Anti-patterns

### Anemic Domain Model

Entities that only hold data with logic in services:

```csharp
// ❌ AVOID: Anemic entity
public class Order
{
    public int Id { get; set; }
    public OrderStatus Status { get; set; }  // Public setter!
    public List<OrderItem> Items { get; set; } = [];
}

public class OrderService
{
    public void SubmitOrder(Order order)
    {
        order.Status = OrderStatus.Submitted;  // Logic in service
    }
}

// ✅ PREFER: Rich domain model
public class Order
{
    public OrderStatus Status { get; private set; }
    private readonly List<OrderItem> _items = [];

    public void Submit()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Only draft orders can be submitted");

        Status = OrderStatus.Submitted;
    }
}
```

### God Class / God Service

Classes that do too much:

```csharp
// ❌ AVOID: Service doing everything
public class OrderService
{
    public Order CreateOrder() { }
    public void SendOrderEmail() { }
    public void GenerateInvoicePdf() { }
    public void SyncWithERP() { }
    public void CalculateTaxes() { }
    public void ValidateInventory() { }
    // ... 50 more methods
}

// ✅ PREFER: Focused services
public class OrderService { }
public class OrderNotificationService { }
public class InvoiceService { }
public class InventoryService { }
```

### Leaky Abstractions

Exposing implementation details through interfaces:

```csharp
// ❌ AVOID: Leaking EF Core
public interface IOrderRepository
{
    DbSet<Order> Orders { get; }  // Exposes EF Core
    IQueryable<Order> Query();    // Exposes IQueryable
}

// ✅ PREFER: Clean interface
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken ct);
    Task<IReadOnlyList<Order>> GetByCustomerAsync(int customerId, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}
```

## Data Access Anti-patterns

### N+1 Query Problem

Loading related data in loops:

```csharp
// ❌ AVOID: N+1 queries
var orders = await _context.Orders.ToListAsync();
foreach (var order in orders)
{
    var items = order.Items;  // Lazy load - 1 query per order!
    var customer = order.Customer;  // Another query!
}

// ✅ PREFER: Eager loading
var orders = await _context.Orders
    .Include(o => o.Items)
    .Include(o => o.Customer)
    .ToListAsync();

// ✅ PREFER: Projection
var orders = await _context.Orders
    .Select(o => new OrderDto
    {
        Id = o.Id,
        CustomerName = o.Customer.Name,
        ItemCount = o.Items.Count
    })
    .ToListAsync();
```

### Loading All Data

Fetching entire tables:

```csharp
// ❌ AVOID: Loading everything
var allProducts = await _context.Products.ToListAsync();
var filtered = allProducts.Where(p => p.IsActive);  // Filtering in memory!

// ✅ PREFER: Database filtering
var activeProducts = await _context.Products
    .Where(p => p.IsActive)
    .ToListAsync();

// ✅ PREFER: Pagination
var products = await _context.Products
    .Where(p => p.IsActive)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();
```

### Missing Indexes

Not indexing frequently queried columns:

```csharp
// ❌ AVOID: Slow queries
var orders = await _context.Orders
    .Where(o => o.CustomerId == customerId)  // No index on CustomerId
    .Where(o => o.Status == OrderStatus.Pending)  // No index on Status
    .ToListAsync();

// ✅ PREFER: Add indexes in configuration
builder.HasIndex(o => o.CustomerId);
builder.HasIndex(o => o.Status);
builder.HasIndex(o => new { o.CustomerId, o.Status, o.CreatedAt });
```

### Raw SQL Injection

Concatenating user input into SQL:

```csharp
// ❌ DANGEROUS: SQL injection
var query = $"SELECT * FROM Users WHERE Email = '{email}'";
var users = await _context.Users.FromSqlRaw(query).ToListAsync();

// ✅ PREFER: Parameterized queries
var users = await _context.Users
    .FromSqlInterpolated($"SELECT * FROM Users WHERE Email = {email}")
    .ToListAsync();

// ✅ PREFER: LINQ
var users = await _context.Users
    .Where(u => u.Email == email)
    .ToListAsync();
```

## API Anti-patterns

### Not Using Cancellation Tokens

Ignoring cancellation requests:

```csharp
// ❌ AVOID: No cancellation support
public async Task<Order> GetOrderAsync(int id)
{
    return await _context.Orders.FindAsync(id);
}

// ✅ PREFER: Support cancellation
public async Task<Order?> GetOrderAsync(int id, CancellationToken ct = default)
{
    return await _context.Orders.FindAsync([id], ct);
}
```

### Returning IQueryable

Exposing queries outside the data layer:

```csharp
// ❌ AVOID: Returning IQueryable
public IQueryable<Order> GetOrders()
{
    return _context.Orders;  // Query not executed, can be modified outside
}

// ✅ PREFER: Return materialized results
public async Task<IReadOnlyList<Order>> GetOrdersAsync(CancellationToken ct)
{
    return await _context.Orders.ToListAsync(ct);
}
```

### Swallowing Exceptions

Catching exceptions without handling:

```csharp
// ❌ AVOID: Swallowing exceptions
try
{
    await ProcessOrderAsync(order);
}
catch (Exception)
{
    // Silently ignored!
}

// ❌ AVOID: Generic catch
try
{
    await ProcessOrderAsync(order);
}
catch (Exception ex)
{
    _logger.LogError("Error");  // No context!
    throw;
}

// ✅ PREFER: Specific handling
try
{
    await ProcessOrderAsync(order);
}
catch (PaymentFailedException ex)
{
    _logger.LogWarning(ex, "Payment failed for order {OrderId}", order.Id);
    return Result.Failure(DomainErrors.Payment.Failed);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Unexpected error processing order {OrderId}", order.Id);
    throw;
}
```

### Exposing Internal Errors

Returning detailed errors in production:

```csharp
// ❌ AVOID: Exposing details
catch (Exception ex)
{
    return BadRequest(new { error = ex.ToString() });  // Stack trace exposed!
}

// ✅ PREFER: Generic error in production
catch (Exception ex)
{
    _logger.LogError(ex, "Error processing request");

    return Problem(
        title: "An error occurred",
        detail: _environment.IsDevelopment() ? ex.Message : null,
        statusCode: 500);
}
```

## Async Anti-patterns

### Async Void

Using async void (except for event handlers):

```csharp
// ❌ AVOID: async void
public async void ProcessOrder(Order order)  // Exceptions can't be caught!
{
    await _service.ProcessAsync(order);
}

// ✅ PREFER: async Task
public async Task ProcessOrderAsync(Order order)
{
    await _service.ProcessAsync(order);
}
```

### Blocking on Async

Using .Result or .Wait():

```csharp
// ❌ AVOID: Blocking
var order = _service.GetOrderAsync(id).Result;  // Deadlock risk!
_service.ProcessAsync(order).Wait();

// ✅ PREFER: async/await
var order = await _service.GetOrderAsync(id);
await _service.ProcessAsync(order);
```

### Fire and Forget

Not awaiting tasks:

```csharp
// ❌ AVOID: Fire and forget
public void ProcessOrder(Order order)
{
    _emailService.SendAsync(order.CustomerEmail);  // Not awaited!
}

// ✅ PREFER: Await or use background service
public async Task ProcessOrderAsync(Order order, CancellationToken ct)
{
    await _emailService.SendAsync(order.CustomerEmail, ct);
}

// Or queue for background processing
_backgroundJobQueue.Enqueue(order.Id);
```

## Memory Anti-patterns

### String Concatenation in Loops

Building strings inefficiently:

```csharp
// ❌ AVOID: String concatenation
string result = "";
foreach (var item in items)
{
    result += item.Name + ", ";  // Creates new string each iteration
}

// ✅ PREFER: StringBuilder
var sb = new StringBuilder();
foreach (var item in items)
{
    sb.Append(item.Name).Append(", ");
}
var result = sb.ToString();

// ✅ PREFER: String.Join
var result = string.Join(", ", items.Select(i => i.Name));
```

### Large Object Allocations

Creating large objects unnecessarily:

```csharp
// ❌ AVOID: Loading entire file into memory
var content = File.ReadAllBytes(largeFilePath);  // Loads entire file

// ✅ PREFER: Streaming
await using var stream = File.OpenRead(largeFilePath);
await ProcessStreamAsync(stream);
```

### Not Disposing Resources

Forgetting to dispose IDisposable:

```csharp
// ❌ AVOID: Not disposing
public void ProcessFile(string path)
{
    var stream = File.OpenRead(path);  // Never disposed!
    // process...
}

// ✅ PREFER: using statement
public void ProcessFile(string path)
{
    using var stream = File.OpenRead(path);
    // process...
}  // Automatically disposed

// ✅ PREFER: await using for async
public async Task ProcessFileAsync(string path)
{
    await using var stream = File.OpenRead(path);
    await ProcessAsync(stream);
}
```

## Security Anti-patterns

### Hardcoded Secrets

Embedding secrets in code:

```csharp
// ❌ NEVER DO THIS
public class ApiClient
{
    private const string ApiKey = "sk-live-abc123xyz";  // Committed to git!
}

// ✅ PREFER: Configuration
public class ApiClient(IOptions<ApiOptions> options)
{
    private readonly string _apiKey = options.Value.ApiKey;
}
```

### Trusting User Input

Not validating input:

```csharp
// ❌ AVOID: Trusting input
[HttpGet("files/{path}")]
public IActionResult GetFile(string path)
{
    return PhysicalFile(path, "application/octet-stream");  // Path traversal!
}

// ✅ PREFER: Validate and sanitize
[HttpGet("files/{fileName}")]
public IActionResult GetFile(string fileName)
{
    var safeName = Path.GetFileName(fileName);  // Remove path components
    var fullPath = Path.Combine(_uploadDir, safeName);

    if (!fullPath.StartsWith(_uploadDir))
        return BadRequest();

    return PhysicalFile(fullPath, "application/octet-stream");
}
```

### Logging Sensitive Data

Including PII in logs:

```csharp
// ❌ AVOID: Logging sensitive data
_logger.LogInformation("User {Email} with password {Password} logged in",
    user.Email, password);  // Password in logs!

// ✅ PREFER: Mask or omit sensitive data
_logger.LogInformation("User {UserId} logged in from {IpAddress}",
    user.Id, Request.RemoteIpAddress);
```

## DI Anti-patterns

### Service Locator

Resolving services manually:

```csharp
// ❌ AVOID: Service locator
public class OrderService
{
    public void Process()
    {
        var repo = ServiceLocator.Get<IOrderRepository>();  // Hidden dependency
    }
}

// ✅ PREFER: Constructor injection
public class OrderService(IOrderRepository repository)
{
    public void Process()
    {
        // Use repository directly
    }
}
```

### Captive Dependencies

Scoped service in singleton:

```csharp
// ❌ AVOID: Captive dependency
public class SingletonCache(ApplicationDbContext context)  // DbContext is scoped!
{
    // Context will be disposed but cached in singleton
}

// ✅ PREFER: Use factory
public class SingletonCache(IServiceScopeFactory scopeFactory)
{
    public async Task RefreshAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        // Use context
    }
}
```

## Code Quality Anti-patterns

### Magic Numbers/Strings

Using unexplained literals:

```csharp
// ❌ AVOID: Magic values
if (user.Status == 3)  // What is 3?
if (order.Total > 1000)  // Why 1000?

// ✅ PREFER: Named constants
if (user.Status == UserStatus.Active)
if (order.Total > FreeShippingThreshold)
```

### Deep Nesting

Excessive indentation:

```csharp
// ❌ AVOID: Deep nesting
public void Process(Order order)
{
    if (order != null)
    {
        if (order.Items.Any())
        {
            if (order.Customer != null)
            {
                if (order.Customer.IsActive)
                {
                    // Finally do something
                }
            }
        }
    }
}

// ✅ PREFER: Early returns
public void Process(Order order)
{
    if (order is null) return;
    if (!order.Items.Any()) return;
    if (order.Customer?.IsActive != true) return;

    // Do something
}
```

### Comments Instead of Clear Code

Over-commenting obvious code:

```csharp
// ❌ AVOID: Obvious comments
// Get the customer by ID
var customer = await _repo.GetByIdAsync(id);

// Check if customer is null
if (customer == null)
{
    // Return not found
    return NotFound();
}

// ✅ PREFER: Self-documenting code
var customer = await _repo.GetByIdAsync(id);
if (customer is null)
    return NotFound();
```
