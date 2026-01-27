---
applyTo: "**/*.cs,**/*.csproj"
excludeAgent: ""
---

# .NET 9 Features

These instructions cover .NET 9 features and improvements. Use these features to build modern, high-performance applications.

## .NET 9 Overview

.NET 9 (November 2024) is a Standard Term Support (STS) release focusing on:
- Performance improvements across the board
- Cloud-native enhancements
- AI integration support
- Developer productivity

## LINQ Enhancements

### CountBy and AggregateBy

```csharp
// ✅ .NET 9 - CountBy
var orders = GetOrders();
var ordersByStatus = orders.CountBy(o => o.Status);
// Returns IEnumerable<KeyValuePair<OrderStatus, int>>

foreach (var (status, count) in ordersByStatus)
{
    Console.WriteLine($"{status}: {count}");
}

// ✅ .NET 9 - AggregateBy
var salesByRegion = orders.AggregateBy(
    keySelector: o => o.Region,
    seed: 0m,
    func: (total, order) => total + order.Total);

// ❌ Old style - GroupBy + Select
var ordersByStatus = orders
    .GroupBy(o => o.Status)
    .Select(g => new { Status = g.Key, Count = g.Count() });
```

### Index Method

```csharp
// ✅ .NET 9 - Index with position
var items = new[] { "a", "b", "c", "d" };

foreach (var (index, item) in items.Index())
{
    Console.WriteLine($"{index}: {item}");
}

// ❌ Old style
for (int i = 0; i < items.Length; i++)
{
    Console.WriteLine($"{i}: {items[i]}");
}

// Or with Select
foreach (var (item, index) in items.Select((item, index) => (item, index)))
{
    // ...
}
```

## Collection Improvements

### PriorityQueue Enhancements

```csharp
// ✅ .NET 9 - Remove method
var queue = new PriorityQueue<string, int>();
queue.Enqueue("Task A", 3);
queue.Enqueue("Task B", 1);
queue.Enqueue("Task C", 2);

// Remove specific item
bool removed = queue.Remove("Task B", out int priority, out string? element);

// Update priority (via remove + enqueue pattern)
if (queue.Remove("Task A", out var oldPriority, out var task))
{
    queue.Enqueue(task!, oldPriority - 1); // Increase priority
}
```

### ReadOnlySet<T>

```csharp
// ✅ .NET 9 - ReadOnlySet<T>
public class ConfigurationService
{
    private readonly HashSet<string> _allowedOrigins = ["https://app.example.com", "https://api.example.com"];

    public ReadOnlySet<string> AllowedOrigins => _allowedOrigins.AsReadOnly();
}
```

## JSON Improvements

### JsonSerializerOptions.Web

```csharp
// ✅ .NET 9 - Pre-configured web options
var json = JsonSerializer.Serialize(data, JsonSerializerOptions.Web);

// Equivalent to:
var options = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
    NumberHandling = JsonNumberHandling.AllowReadingFromString
};
```

### Indentation Options

```csharp
// ✅ .NET 9 - Custom indentation
var options = new JsonSerializerOptions
{
    WriteIndented = true,
    IndentCharacter = '\t',
    IndentSize = 1
};

// Or use spaces with custom size
var options2 = new JsonSerializerOptions
{
    WriteIndented = true,
    IndentCharacter = ' ',
    IndentSize = 4
};
```

### JsonObject Deep Clone

```csharp
// ✅ .NET 9 - Deep clone
var original = JsonNode.Parse("""{"name": "test", "nested": {"value": 1}}""")!;
var clone = original.DeepClone();

// Modify clone without affecting original
clone["nested"]!["value"] = 2;
```

## Cryptography

### CryptographicOperations.HashData

```csharp
// ✅ .NET 9 - Simplified hashing
byte[] data = Encoding.UTF8.GetBytes("Hello, World!");
byte[] hash = CryptographicOperations.HashData(HashAlgorithmName.SHA256, data);

// One-liner with span
ReadOnlySpan<byte> hashSpan = CryptographicOperations.HashData(
    HashAlgorithmName.SHA512,
    "sensitive data"u8);
```

### KMAC (Keccak Message Authentication Code)

```csharp
// ✅ .NET 9 - KMAC support
using var kmac = new Kmac128(key);
byte[] mac = kmac.ComputeHash(data);

// KMAC256 for higher security
using var kmac256 = new Kmac256(key, customizationString: "MyApp"u8);
```

## Performance Improvements

### Span Improvements

```csharp
// ✅ .NET 9 - params Span<T>
public static void LogMultiple(params ReadOnlySpan<string> messages)
{
    foreach (var message in messages)
    {
        Console.WriteLine(message);
    }
}

// No allocation for small argument lists
LogMultiple("Start", "Processing", "End");
```

### SearchValues Enhancements

```csharp
// ✅ .NET 9 - SearchValues for strings
private static readonly SearchValues<string> _keywords =
    SearchValues.Create(["async", "await", "var"], StringComparison.OrdinalIgnoreCase);

public bool ContainsKeyword(string text)
{
    return text.AsSpan().ContainsAny(_keywords);
}
```

### TimeProvider Improvements

```csharp
// ✅ .NET 9 - TimeProvider in more places
public class SchedulerService(TimeProvider timeProvider)
{
    public DateTimeOffset GetNextRun(TimeSpan interval)
    {
        return timeProvider.GetUtcNow().Add(interval);
    }

    public async Task DelayAsync(TimeSpan delay, CancellationToken ct)
    {
        await timeProvider.Delay(delay, ct);
    }
}

// Testing with fake time
var fakeTime = new FakeTimeProvider();
var service = new SchedulerService(fakeTime);
fakeTime.Advance(TimeSpan.FromHours(1));
```

## ASP.NET Core 9

### HybridCache

```csharp
// ✅ .NET 9 - HybridCache (replaces IMemoryCache + IDistributedCache)
builder.Services.AddHybridCache(options =>
{
    options.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(5),
        LocalCacheExpiration = TimeSpan.FromMinutes(1)
    };
});

public class ProductService(HybridCache cache, IProductRepository repository)
{
    public async Task<Product?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await cache.GetOrCreateAsync(
            $"product:{id}",
            async token => await repository.GetByIdAsync(id, token),
            cancellationToken: ct);
    }

    public async Task InvalidateAsync(int id, CancellationToken ct)
    {
        await cache.RemoveAsync($"product:{id}", ct);
    }
}
```

### OpenAPI Improvements

```csharp
// ✅ .NET 9 - Built-in OpenAPI without Swashbuckle
builder.Services.AddOpenApi();

app.MapOpenApi(); // Serves OpenAPI document

// Customization
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, ct) =>
    {
        document.Info.Title = "My API";
        document.Info.Version = "v1";
        return Task.CompletedTask;
    });
});
```

### Static Asset Delivery

```csharp
// ✅ .NET 9 - Optimized static file delivery
app.MapStaticAssets(); // Replaces UseStaticFiles()

// Benefits:
// - Automatic compression
// - Content-based ETags
// - Build-time optimization
// - Fingerprinted URLs
```

### Keyed Services Improvements

```csharp
// ✅ .NET 9 - Keyed services in minimal APIs
builder.Services.AddKeyedSingleton<INotificationService, EmailService>("email");
builder.Services.AddKeyedSingleton<INotificationService, SmsService>("sms");

app.MapPost("/notify", (
    [FromKeyedServices("email")] INotificationService emailService,
    [FromKeyedServices("sms")] INotificationService smsService,
    NotifyRequest request) =>
{
    // Use appropriate service based on request
});
```

## Entity Framework Core 9

### LINQ Improvements

```csharp
// ✅ EF Core 9 - Complex type ordering
var customers = await context.Customers
    .OrderBy(c => c.Address) // Order by complex type
    .ToListAsync();

// ✅ EF Core 9 - Improved Contains translation
var customerIds = new HashSet<int> { 1, 2, 3, 4, 5 };
var customers = await context.Customers
    .Where(c => customerIds.Contains(c.Id))
    .ToListAsync();
// Now uses optimized SQL with VALUES clause
```

### Model Building

```csharp
// ✅ EF Core 9 - Sequence as default
modelBuilder.Entity<Order>()
    .Property(o => o.OrderNumber)
    .UseSequence("OrderNumbers");

// ✅ EF Core 9 - Auto-compiled model
// Enable in .csproj:
// <EFCoreCompileModel>true</EFCoreCompileModel>
```

## Migration from .NET 8

### Breaking Changes to Watch

```csharp
// 1. Obsolete APIs removed - check warnings
// 2. Default serialization behavior changes
// 3. Some nullable annotations changed

// Update .csproj
<TargetFramework>net9.0</TargetFramework>

// Update global.json
{
  "sdk": {
    "version": "9.0.100"
  }
}
```

### Recommended Migration Steps

1. Update SDK and runtime
2. Update NuGet packages to .NET 9 compatible versions
3. Address any obsolete warnings
4. Test thoroughly, especially serialization
5. Adopt new features gradually

## When to Use .NET 9

| Scenario | Recommendation |
|----------|----------------|
| New projects | Use .NET 9 if STS acceptable |
| Production critical | Consider .NET 8 LTS |
| Need latest features | Use .NET 9 |
| Long maintenance window | Use .NET 8 LTS |
| AI/ML workloads | Use .NET 9 |
