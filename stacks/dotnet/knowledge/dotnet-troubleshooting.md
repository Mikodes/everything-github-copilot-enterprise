# .NET Troubleshooting Guide

This document contains solutions to common problems encountered in .NET development.

## Entity Framework Core Issues

### Problem: N+1 Queries

**Symptoms:**
- Slow page loads
- High database query count
- EF Core logging shows many SELECT statements

**Diagnosis:**
```csharp
// Enable detailed logging
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
    options.EnableSensitiveDataLogging();
    options.LogTo(Console.WriteLine, LogLevel.Information);
});
```

**Solution:**
```csharp
// Use Include for eager loading
var orders = await _context.Orders
    .Include(o => o.Items)
    .Include(o => o.Customer)
    .ToListAsync();

// Or use projection
var orders = await _context.Orders
    .Select(o => new OrderDto
    {
        Id = o.Id,
        CustomerName = o.Customer.Name,
        ItemCount = o.Items.Count
    })
    .ToListAsync();

// For multiple collections, use split queries
var orders = await _context.Orders
    .Include(o => o.Items)
    .Include(o => o.Shipments)
    .AsSplitQuery()
    .ToListAsync();
```

### Problem: DbContext Lifetime Issues

**Symptoms:**
- "Cannot access a disposed context instance"
- "A second operation was started on this context instance"

**Solution:**
```csharp
// Ensure DbContext is scoped
builder.Services.AddDbContext<AppDbContext>(options => { });

// Don't capture DbContext in singletons
// ❌ Wrong
public class SingletonService(AppDbContext context) { }

// ✅ Correct - use factory
public class SingletonService(IServiceScopeFactory scopeFactory)
{
    public async Task DoWorkAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // Use context
    }
}
```

### Problem: Migration Conflicts

**Symptoms:**
- "The migration has already been applied to the database"
- "An operation was scaffolded that may result in the loss of data"

**Solution:**
```bash
# Reset migrations (development only)
dotnet ef database drop
dotnet ef migrations remove
dotnet ef migrations add InitialCreate

# Or fix specific migration
dotnet ef migrations remove
# Edit the conflicting migration
dotnet ef migrations add FixedMigration

# For production, use idempotent scripts
dotnet ef migrations script --idempotent
```

## Authentication Issues

### Problem: JWT Token Not Validating

**Symptoms:**
- 401 Unauthorized on all requests
- "The signature is invalid"
- "The token is expired"

**Diagnosis:**
```csharp
// Add detailed JWT events
.AddJwtBearer(options =>
{
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            Console.WriteLine($"Auth failed: {context.Exception.Message}");
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            Console.WriteLine($"Token validated for: {context.Principal?.Identity?.Name}");
            return Task.CompletedTask;
        }
    };
});
```

**Common Causes & Solutions:**

```csharp
// 1. Clock skew - token appears expired
options.TokenValidationParameters = new TokenValidationParameters
{
    ClockSkew = TimeSpan.Zero  // Or TimeSpan.FromMinutes(5) for tolerance
};

// 2. Wrong signing key
IssuerSigningKey = new SymmetricSecurityKey(
    Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!))  // Must match generation

// 3. Issuer/Audience mismatch
ValidIssuer = configuration["Jwt:Issuer"],  // Must match token
ValidAudience = configuration["Jwt:Audience"],  // Must match token
```

### Problem: Authorization Policy Not Working

**Symptoms:**
- Users with correct roles still get 403
- Policy requirements not evaluated

**Solution:**
```csharp
// Check policy registration
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdmin", policy => policy.RequireRole("Admin"));

// Check middleware order
app.UseAuthentication();  // Must come first
app.UseAuthorization();   // Must come second

// Debug authorization
public class DiagnosticAuthHandler : AuthorizationHandler<IAuthorizationRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        IAuthorizationRequirement requirement)
    {
        var claims = context.User.Claims.Select(c => $"{c.Type}: {c.Value}");
        Console.WriteLine($"Claims: {string.Join(", ", claims)}");
        return Task.CompletedTask;
    }
}
```

## Dependency Injection Issues

### Problem: Unable to Resolve Service

**Symptoms:**
- "Unable to resolve service for type 'IMyService'"
- InvalidOperationException at startup or request time

**Solution:**
```csharp
// Check registration
builder.Services.AddScoped<IMyService, MyService>();

// Check dependencies are also registered
public class MyService(IOtherService other) { }  // IOtherService must be registered

// For generic services
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

// Debug with validation
builder.Host.UseDefaultServiceProvider(options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;  // Catches missing registrations early
});
```

### Problem: Service Disposed Too Early

**Symptoms:**
- "Cannot access a disposed object"
- Service works initially then fails

**Solution:**
```csharp
// Check lifetime compatibility
// ❌ Scoped service in singleton
builder.Services.AddSingleton<ISingleton, SingletonThatNeedsScoped>();

// ✅ Use factory or IServiceScopeFactory
builder.Services.AddSingleton<ISingleton>(sp =>
{
    var factory = sp.GetRequiredService<IServiceScopeFactory>();
    return new SingletonService(factory);
});
```

## Performance Issues

### Problem: High Memory Usage

**Symptoms:**
- OutOfMemoryException
- Slow garbage collection
- High memory in production metrics

**Diagnosis & Solutions:**

```csharp
// 1. Use IAsyncEnumerable for large datasets
public async IAsyncEnumerable<Order> GetAllOrdersAsync(
    [EnumeratorCancellation] CancellationToken ct)
{
    await foreach (var order in _context.Orders.AsAsyncEnumerable())
    {
        ct.ThrowIfCancellationRequested();
        yield return order;
    }
}

// 2. Avoid loading unnecessary data
// ❌ Loading all columns
var orders = await _context.Orders.ToListAsync();

// ✅ Project only needed columns
var orders = await _context.Orders
    .Select(o => new { o.Id, o.Status })
    .ToListAsync();

// 3. Use StringBuild for string concatenation
var sb = new StringBuilder();
foreach (var item in items)
{
    sb.AppendLine(item.Name);
}

// 4. Pool objects for high-frequency allocations
private static readonly ObjectPool<StringBuilder> StringBuilderPool =
    ObjectPool.Create<StringBuilder>();
```

### Problem: Slow API Responses

**Symptoms:**
- High latency on specific endpoints
- Timeouts under load

**Diagnosis:**
```csharp
// Add timing middleware
app.Use(async (context, next) =>
{
    var sw = Stopwatch.StartNew();
    await next();
    sw.Stop();

    if (sw.ElapsedMilliseconds > 500)
    {
        Console.WriteLine($"Slow request: {context.Request.Path} took {sw.ElapsedMilliseconds}ms");
    }
});
```

**Solutions:**
```csharp
// 1. Use caching
builder.Services.AddOutputCache();

app.MapGet("/products", GetProducts)
    .CacheOutput(policy => policy.Expire(TimeSpan.FromMinutes(5)));

// 2. Optimize database queries
var products = await _context.Products
    .AsNoTracking()  // No change tracking overhead
    .Where(p => p.IsActive)
    .Take(100)  // Limit results
    .ToListAsync();

// 3. Add response compression
builder.Services.AddResponseCompression();
app.UseResponseCompression();

// 4. Use parallel operations
var customerTask = _customerService.GetByIdAsync(id);
var ordersTask = _orderService.GetByCustomerAsync(id);
await Task.WhenAll(customerTask, ordersTask);
```

## Serialization Issues

### Problem: Circular Reference in JSON

**Symptoms:**
- "A possible object cycle was detected"
- StackOverflowException

**Solution:**
```csharp
// Configure JSON options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        // Or use DTOs instead of entities
    });

// Better: Use DTOs
public record OrderResponse(int Id, string CustomerName);  // No circular refs
```

### Problem: DateTime Serialization Issues

**Symptoms:**
- Dates showing wrong timezone
- "Cannot convert" errors

**Solution:**
```csharp
// Use UTC consistently
public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

// Configure JSON
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// For specific formats
public class DateOnlyConverter : JsonConverter<DateOnly>
{
    public override DateOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return DateOnly.Parse(reader.GetString()!);
    }

    public override void Write(Utf8JsonWriter writer, DateOnly value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString("yyyy-MM-dd"));
    }
}
```

## CORS Issues

### Problem: CORS Errors in Browser

**Symptoms:**
- "Access-Control-Allow-Origin" errors in browser console
- Preflight (OPTIONS) requests failing

**Solution:**
```csharp
// Configure CORS properly
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("https://myapp.com", "http://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();  // If using cookies/auth
    });
});

// Use before auth middleware
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
```

## Logging Issues

### Problem: Logs Not Appearing

**Symptoms:**
- No log output
- Missing log entries for specific categories

**Solution:**
```json
// appsettings.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Information",  // EF Core queries
      "YourNamespace": "Debug"  // Your code at debug level
    }
  }
}
```

```csharp
// Ensure logging is configured
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Check you're using ILogger<T>
public class MyService(ILogger<MyService> logger)
{
    public void DoWork()
    {
        logger.LogInformation("Doing work");  // Check category matches config
    }
}
```

## Deployment Issues

### Problem: App Fails in Container

**Symptoms:**
- Works locally, fails in Docker
- "Unable to bind to address"

**Solution:**
```csharp
// Listen on all interfaces in container
builder.WebHost.UseUrls("http://0.0.0.0:80");

// Or via environment variable
ENV ASPNETCORE_URLS=http://+:80
```

```dockerfile
# Correct Dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MyApp.csproj", "."]
RUN dotnet restore
COPY . .
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### Problem: Missing Configuration in Production

**Symptoms:**
- "Configuration value is null"
- Features work locally but not in production

**Solution:**
```csharp
// Use environment-specific config
builder.Configuration
    .AddJsonFile("appsettings.json")
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables()
    .AddUserSecrets<Program>(optional: true);

// Validate required configuration
builder.Services.AddOptions<MyOptions>()
    .BindConfiguration("MySection")
    .ValidateDataAnnotations()
    .ValidateOnStart();  // Fail fast if missing
```

## Quick Diagnostic Commands

```bash
# Check .NET version
dotnet --version
dotnet --info

# List installed packages
dotnet list package

# Check for outdated packages
dotnet list package --outdated

# Clean and rebuild
dotnet clean
dotnet restore
dotnet build

# Run with verbose logging
dotnet run --verbosity detailed

# Check for EF migrations issues
dotnet ef migrations list
dotnet ef dbcontext info

# Generate deployment files
dotnet publish -c Release -o ./publish
```
