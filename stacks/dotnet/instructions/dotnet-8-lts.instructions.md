---
applyTo: "**/*.cs,**/*.csproj"
excludeAgent: ""
---

# .NET 8 LTS Best Practices

These instructions cover .NET 8 Long Term Support (LTS) best practices. .NET 8 is the recommended version for production enterprise applications requiring long-term stability.

## Why .NET 8 LTS

- **Support until November 2026** (3 years)
- **Production-ready** for enterprise workloads
- **Stable APIs** with security patches
- **Ecosystem maturity** - all major libraries support .NET 8

## Performance Features

### Native AOT

```csharp
// Enable in .csproj for console apps and minimal APIs
<PublishAot>true</PublishAot>

// Benefits:
// - Faster startup (no JIT)
// - Smaller memory footprint
// - Single file deployment

// Limitations:
// - No reflection-based features
// - No dynamic code generation
// - Must use source generators for serialization
```

```csharp
// ✅ AOT-compatible JSON serialization
[JsonSerializable(typeof(Customer))]
[JsonSerializable(typeof(List<Order>))]
public partial class AppJsonContext : JsonSerializerContext { }

// Usage
var json = JsonSerializer.Serialize(customer, AppJsonContext.Default.Customer);
```

### Frozen Collections

```csharp
// ✅ .NET 8 - FrozenDictionary and FrozenSet
using System.Collections.Frozen;

// Create once, read many times (optimized for reads)
private static readonly FrozenDictionary<string, Country> _countries =
    LoadCountries().ToFrozenDictionary(c => c.Code);

private static readonly FrozenSet<string> _validCurrencies =
    new[] { "USD", "EUR", "GBP", "JPY" }.ToFrozenSet();

public Country? GetCountry(string code)
{
    return _countries.GetValueOrDefault(code);
}

public bool IsValidCurrency(string currency)
{
    return _validCurrencies.Contains(currency); // Very fast lookup
}
```

### Time Abstraction

```csharp
// ✅ .NET 8 - TimeProvider for testable time
public class SubscriptionService(TimeProvider timeProvider)
{
    public bool IsExpired(Subscription subscription)
    {
        return subscription.ExpiresAt < timeProvider.GetUtcNow();
    }

    public Subscription CreateTrial(int days)
    {
        return new Subscription
        {
            StartsAt = timeProvider.GetUtcNow(),
            ExpiresAt = timeProvider.GetUtcNow().AddDays(days)
        };
    }
}

// Registration
builder.Services.AddSingleton(TimeProvider.System);

// Testing
var fakeTime = new FakeTimeProvider(new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero));
var service = new SubscriptionService(fakeTime);
fakeTime.Advance(TimeSpan.FromDays(30));
```

### Keyed Services

```csharp
// ✅ .NET 8 - Keyed dependency injection
builder.Services.AddKeyedSingleton<ICache, MemoryCache>("memory");
builder.Services.AddKeyedSingleton<ICache, RedisCache>("distributed");

public class ProductService(
    [FromKeyedServices("memory")] ICache localCache,
    [FromKeyedServices("distributed")] ICache distributedCache)
{
    public async Task<Product?> GetByIdAsync(int id)
    {
        // Try local cache first
        if (localCache.TryGet<Product>($"product:{id}", out var cached))
            return cached;

        // Then distributed cache
        var product = await distributedCache.GetAsync<Product>($"product:{id}");
        if (product is not null)
        {
            localCache.Set($"product:{id}", product, TimeSpan.FromMinutes(1));
        }

        return product;
    }
}
```

## ASP.NET Core 8

### Minimal APIs Enhancements

```csharp
// ✅ .NET 8 - Form binding
app.MapPost("/upload", async (IFormFile file, [FromForm] string description) =>
{
    // Process file
    return TypedResults.Ok(new { file.FileName, description });
});

// ✅ .NET 8 - Antiforgery support
app.MapPost("/submit", [ValidateAntiForgeryToken] (SubmitRequest request) =>
{
    return TypedResults.Ok();
});

// ✅ .NET 8 - Short-circuit routes
app.MapShortCircuit(404, "robots.txt", "favicon.ico");
```

### Output Caching

```csharp
// ✅ .NET 8 - Output caching
builder.Services.AddOutputCache(options =>
{
    options.AddBasePolicy(builder => builder
        .Expire(TimeSpan.FromMinutes(10)));

    options.AddPolicy("Aggressive", builder => builder
        .Expire(TimeSpan.FromHours(1))
        .Tag("static"));
});

app.UseOutputCache();

app.MapGet("/products", async (IProductService service) =>
{
    return await service.GetAllAsync();
})
.CacheOutput("Aggressive");

// Invalidate by tag
app.MapPost("/products", async (
    Product product,
    IProductService service,
    IOutputCacheStore cache) =>
{
    await service.CreateAsync(product);
    await cache.EvictByTagAsync("static", default);
    return TypedResults.Created($"/products/{product.Id}", product);
});
```

### Rate Limiting

```csharp
// ✅ .NET 8 - Built-in rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.Identity?.Name ?? context.Request.Headers.Host.ToString(),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1)
            }));

    options.AddFixedWindowLimiter("Api", options =>
    {
        options.PermitLimit = 10;
        options.Window = TimeSpan.FromSeconds(10);
        options.QueueLimit = 2;
    });

    options.OnRejected = (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        return ValueTask.CompletedTask;
    };
});

app.UseRateLimiter();

app.MapGet("/api/data", () => "Hello")
    .RequireRateLimiting("Api");
```

## Entity Framework Core 8

### Complex Types

```csharp
// ✅ EF Core 8 - Complex types (no identity)
public class Address
{
    public required string Street { get; set; }
    public required string City { get; set; }
    public required string PostalCode { get; set; }
    public required string Country { get; set; }
}

public class Customer
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required Address ShippingAddress { get; set; }
    public required Address BillingAddress { get; set; }
}

// Configuration
modelBuilder.Entity<Customer>()
    .ComplexProperty(c => c.ShippingAddress);
modelBuilder.Entity<Customer>()
    .ComplexProperty(c => c.BillingAddress);
```

### JSON Columns

```csharp
// ✅ EF Core 8 - JSON columns
public class Order
{
    public int Id { get; set; }
    public OrderMetadata Metadata { get; set; } = new();
}

public class OrderMetadata
{
    public string? Source { get; set; }
    public Dictionary<string, string> Tags { get; set; } = new();
    public List<string> Notes { get; set; } = new();
}

// Configuration
modelBuilder.Entity<Order>()
    .OwnsOne(o => o.Metadata, m => m.ToJson());

// Query into JSON
var orders = await context.Orders
    .Where(o => o.Metadata.Source == "web")
    .Where(o => o.Metadata.Tags["priority"] == "high")
    .ToListAsync();
```

### Raw SQL Improvements

```csharp
// ✅ EF Core 8 - Unmapped types in raw SQL
var results = await context.Database
    .SqlQuery<OrderSummary>($"""
        SELECT
            CustomerId,
            COUNT(*) as OrderCount,
            SUM(Total) as TotalAmount
        FROM Orders
        WHERE CreatedAt >= {startDate}
        GROUP BY CustomerId
        """)
    .ToListAsync();

// Composable
var highValue = context.Database
    .SqlQuery<OrderSummary>($"SELECT * FROM GetOrderSummaries()")
    .Where(s => s.TotalAmount > 10000)
    .OrderByDescending(s => s.TotalAmount);
```

### Bulk Operations

```csharp
// ✅ EF Core 8 - ExecuteUpdate and ExecuteDelete (efficient bulk operations)
// No entity loading required

// Bulk update
await context.Products
    .Where(p => p.Category == "Electronics")
    .Where(p => p.Price > 100)
    .ExecuteUpdateAsync(s => s
        .SetProperty(p => p.Price, p => p.Price * 0.9m)
        .SetProperty(p => p.UpdatedAt, DateTime.UtcNow));

// Bulk delete
await context.Orders
    .Where(o => o.Status == OrderStatus.Cancelled)
    .Where(o => o.CancelledAt < DateTime.UtcNow.AddYears(-1))
    .ExecuteDeleteAsync();

// Returns number of affected rows, not entities
```

## Blazor 8

### Unified Blazor Model

```csharp
// ✅ .NET 8 - Render modes
@rendermode InteractiveServer
@rendermode InteractiveWebAssembly
@rendermode InteractiveAuto

// Static SSR by default, add interactivity where needed
// App.razor
<Routes @rendermode="InteractiveAuto" />
```

### Stream Rendering

```csharp
// ✅ .NET 8 - Stream rendering
@page "/dashboard"
@attribute [StreamRendering]

@if (data is null)
{
    <LoadingSpinner />
}
else
{
    <Dashboard Data="@data" />
}

@code {
    private DashboardData? data;

    protected override async Task OnInitializedAsync()
    {
        // Page renders immediately, then updates when data loads
        data = await DashboardService.GetDataAsync();
    }
}
```

## Configuration Best Practices

### Project File

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>

    <!-- Performance -->
    <InvariantGlobalization>true</InvariantGlobalization>
    <TieredCompilation>true</TieredCompilation>

    <!-- For containers -->
    <ContainerRepository>myapp</ContainerRepository>
    <ContainerImageTag>latest</ContainerImageTag>
  </PropertyGroup>
</Project>
```

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "AllowedHosts": "*"
}
```

## Migration from .NET 6/7

```csharp
// 1. Update TargetFramework
<TargetFramework>net8.0</TargetFramework>

// 2. Update packages
dotnet outdated --upgrade

// 3. Address breaking changes
// - Check deprecated APIs
// - Update serialization if needed
// - Test thoroughly

// 4. Adopt new features gradually
// - TimeProvider for time abstraction
// - FrozenCollections for lookup tables
// - Keyed services for multiple implementations
```
