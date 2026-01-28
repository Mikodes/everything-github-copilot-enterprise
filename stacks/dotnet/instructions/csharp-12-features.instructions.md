---
applyTo: "**/*.cs"
excludeAgent: ""
---

# C# 12 Features

These instructions guide the use of C# 12 language features in .NET 8+ projects. Use modern C# features to write cleaner, more maintainable code.

## Primary Constructors

Use primary constructors for classes and structs to reduce boilerplate.

```csharp
// ✅ C# 12 - Primary constructor
public class CustomerService(
    ICustomerRepository repository,
    ILogger<CustomerService> logger,
    IMapper mapper)
{
    public async Task<CustomerDto> GetByIdAsync(int id, CancellationToken ct)
    {
        logger.LogInformation("Getting customer {Id}", id);
        var customer = await repository.GetByIdAsync(id, ct);
        return mapper.Map<CustomerDto>(customer);
    }
}

// ❌ Old style - verbose
public class CustomerService
{
    private readonly ICustomerRepository _repository;
    private readonly ILogger<CustomerService> _logger;
    private readonly IMapper _mapper;

    public CustomerService(
        ICustomerRepository repository,
        ILogger<CustomerService> logger,
        IMapper mapper)
    {
        _repository = repository;
        _logger = logger;
        _mapper = mapper;
    }
}
```

### Primary Constructor Guidelines

- Use for dependency injection scenarios
- Capture parameters directly; avoid creating backing fields unless mutated
- Use when the class has a single natural way to be constructed
- Avoid when parameters need validation in constructor

```csharp
// ✅ Direct usage of primary constructor parameters
public class OrderProcessor(IOrderRepository orders, IPaymentService payments)
{
    public async Task ProcessAsync(Order order, CancellationToken ct)
    {
        await payments.ChargeAsync(order.Total, ct);
        await orders.UpdateStatusAsync(order.Id, OrderStatus.Paid, ct);
    }
}

// ✅ Creating backing field when mutation needed
public class Counter(int initialValue)
{
    private int _count = initialValue;

    public int Increment() => ++_count;
}
```

## Collection Expressions

Use collection expressions for cleaner collection initialization.

```csharp
// ✅ C# 12 - Collection expressions
int[] numbers = [1, 2, 3, 4, 5];
List<string> names = ["Alice", "Bob", "Charlie"];
HashSet<int> uniqueIds = [1, 2, 3];
Dictionary<string, int> scores = new() { ["Alice"] = 100, ["Bob"] = 95 };

// Spread operator
int[] first = [1, 2, 3];
int[] second = [4, 5, 6];
int[] combined = [..first, ..second]; // [1, 2, 3, 4, 5, 6]

// Empty collections
List<Customer> customers = [];

// ❌ Old style
int[] numbers = new int[] { 1, 2, 3, 4, 5 };
List<string> names = new List<string> { "Alice", "Bob" };
```

### Use Collection Expressions For

```csharp
// ✅ Method returns
public IReadOnlyList<string> GetDefaultRoles() => ["User", "Reader"];

// ✅ Inline collections
var validStatuses = (OrderStatus[])[OrderStatus.Pending, OrderStatus.Processing];

// ✅ Combining collections
var allItems = (List<Item>)[..existingItems, ..newItems];

// ✅ Test data
var testCustomers = (Customer[])
[
    new("Alice", "alice@example.com"),
    new("Bob", "bob@example.com")
];
```

## Alias Any Type

Use `using` aliases for any type, including tuples and pointers.

```csharp
// ✅ C# 12 - Type aliases
using Point = (int X, int Y);
using CustomerList = System.Collections.Generic.List<Customer>;
using JsonOptions = System.Text.Json.JsonSerializerOptions;

public class GeometryService
{
    public double CalculateDistance(Point a, Point b)
    {
        var dx = b.X - a.X;
        var dy = b.Y - a.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }
}

// Alias for complex generic types
using ResultPair = (bool Success, string? ErrorMessage);
using CustomerCache = System.Collections.Concurrent.ConcurrentDictionary<int, Customer>;
```

## Default Lambda Parameters

Use default parameter values in lambda expressions.

```csharp
// ✅ C# 12 - Default lambda parameters
var greet = (string name, string greeting = "Hello") => $"{greeting}, {name}!";
Console.WriteLine(greet("World")); // "Hello, World!"
Console.WriteLine(greet("World", "Hi")); // "Hi, World!"

// Useful for configuration lambdas
builder.Services.AddSingleton<IValidator>(sp =>
    (object? value, bool strict = false) =>
        strict ? StrictValidate(value) : BasicValidate(value));

// Event handlers with defaults
button.OnClick = (sender, args, handled = false) =>
{
    if (!handled)
        ProcessClick(sender, args);
};
```

## Inline Arrays

Use inline arrays for high-performance, fixed-size buffers.

```csharp
// ✅ C# 12 - Inline arrays (for performance-critical code)
[InlineArray(10)]
public struct TenIntegers
{
    private int _element0;
}

public class BufferExample
{
    public void ProcessWithInlineBuffer()
    {
        TenIntegers buffer = default;
        buffer[0] = 1;
        buffer[1] = 2;

        // Use as span
        Span<int> span = buffer;
        foreach (ref var item in span)
        {
            item *= 2;
        }
    }
}
```

## Interceptors (Experimental)

Interceptors allow compile-time method replacement. Use with caution.

```csharp
// Note: Interceptors are experimental in C# 12
// Primarily used by source generators
// Requires: <InterceptorsPreviewNamespaces>...</InterceptorsPreviewNamespaces>

// Used by frameworks like ASP.NET Core for AOT compilation
// Generally not used in application code directly
```

## ref readonly Parameters

Use `ref readonly` to pass large structs by reference without allowing modification.

```csharp
// ✅ C# 12 - ref readonly for large structs
public readonly struct LargeStruct
{
    public readonly double X, Y, Z, W;
    public readonly Matrix4x4 Transform;
}

public class PhysicsEngine
{
    // Pass by reference (no copy) but can't modify
    public double CalculateMagnitude(ref readonly LargeStruct data)
    {
        return Math.Sqrt(data.X * data.X + data.Y * data.Y + data.Z * data.Z);
    }

    // Can be called with 'in' keyword or directly
    public void Process()
    {
        var data = new LargeStruct();
        var magnitude = CalculateMagnitude(in data);
        // or: CalculateMagnitude(data); // implicit conversion
    }
}
```

## Recommended Practices

### DO Use

1. **Primary constructors** for DI and simple classes
2. **Collection expressions** for all collection initialization
3. **Type aliases** for complex generic types
4. **Default lambda parameters** where appropriate

### DON'T Use

1. **Inline arrays** unless you have measured performance need
2. **Interceptors** in application code (framework use only)
3. **Primary constructors** when you need constructor validation logic

### Migration Guide

When upgrading to C# 12:

```csharp
// Step 1: Enable in .csproj
<LangVersion>12.0</LangVersion>

// Step 2: Refactor constructors to primary constructors
// Before
public class Service
{
    private readonly IDependency _dep;
    public Service(IDependency dep) => _dep = dep;
}

// After
public class Service(IDependency dep)
{
    // Use dep directly
}

// Step 3: Update collection initializations
// Before
var list = new List<int> { 1, 2, 3 };

// After
List<int> list = [1, 2, 3];
```

## IDE Support

Enable C# 12 suggestions in your IDE:

```json
// .editorconfig
[*.cs]
csharp_style_prefer_primary_constructors = true:suggestion
csharp_style_prefer_collection_expression = true:suggestion
```
