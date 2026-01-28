# Troubleshooting Guide

Common issues and solutions for the ECommerceApi project.

## Database Issues

### Problem: Cannot connect to database

**Error:**
```
Npgsql.NpgsqlException: Failed to connect to host=localhost
```

**Solution:**
1. Ensure Docker is running
2. Start the database container:
   ```bash
   docker-compose up -d postgres
   ```
3. Verify connection string in `appsettings.Development.json`
4. Check PostgreSQL port (default: 5432)

### Problem: Migration fails

**Error:**
```
The migration has already been applied to the database
```

**Solution:**
```bash
# Check migration status
dotnet ef migrations list --project src/ECommerceApi.Infrastructure

# If needed, reset (DEVELOPMENT ONLY)
dotnet ef database drop --project src/ECommerceApi.Infrastructure
dotnet ef database update --project src/ECommerceApi.Infrastructure
```

### Problem: N+1 queries

**Symptom:** Slow performance, many SQL queries in logs

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
```

## API Issues

### Problem: 401 Unauthorized

**Possible causes:**

1. **Missing Authorization header**
   ```
   Authorization: Bearer {token}
   ```

2. **Expired token** - Check token expiration

3. **Wrong audience/issuer** - Verify JWT configuration

**Debug:**
```csharp
// Add JWT debugging events
.AddJwtBearer(options =>
{
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            Console.WriteLine($"Auth failed: {context.Exception}");
            return Task.CompletedTask;
        }
    };
});
```

### Problem: 400 Bad Request with validation errors

**Check:**
1. Review validation rules in validator class
2. Ensure request matches expected format
3. Check required fields

**Example response:**
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "One or more validation errors occurred.",
  "errors": {
    "CustomerId": ["Customer ID must be greater than 0"],
    "Items": ["Order must have at least one item"]
  }
}
```

### Problem: CORS errors

**Solution in Program.cs:**
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Development", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Before UseAuthorization
app.UseCors("Development");
```

## MediatR Issues

### Problem: Handler not found

**Error:**
```
Handler was not found for request of type CreateOrderCommand
```

**Solution:**
1. Ensure handler is in scanned assembly:
   ```csharp
   services.AddMediatR(cfg =>
       cfg.RegisterServicesFromAssembly(typeof(CreateOrderCommandHandler).Assembly));
   ```

2. Verify handler implements correct interface:
   ```csharp
   public class CreateOrderCommandHandler
       : IRequestHandler<CreateOrderCommand, Result<int>>  // Correct interface
   ```

### Problem: Validation not running

**Check:**
1. Validator is registered:
   ```csharp
   services.AddValidatorsFromAssembly(typeof(CreateOrderCommandValidator).Assembly);
   ```

2. ValidationBehavior is added:
   ```csharp
   cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
   ```

## Domain Issues

### Problem: Domain exception not caught

**Solution:**
Ensure global exception handler catches domain exceptions:
```csharp
catch (DomainException ex)
{
    return TypedResults.BadRequest(new ProblemDetails
    {
        Title = "Domain Error",
        Detail = ex.Message,
        Status = 400
    });
}
```

### Problem: Domain events not dispatched

**Check:**
1. Entity raises events:
   ```csharp
   AddDomainEvent(new OrderCreatedEvent(this));
   ```

2. DbContext dispatches events:
   ```csharp
   public override async Task<int> SaveChangesAsync(CancellationToken ct)
   {
       var events = ChangeTracker.Entries<Entity>()
           .SelectMany(e => e.Entity.DomainEvents)
           .ToList();

       var result = await base.SaveChangesAsync(ct);

       foreach (var domainEvent in events)
       {
           await _publisher.Publish(domainEvent, ct);
       }

       return result;
   }
   ```

## Testing Issues

### Problem: Tests failing with DbContext disposed

**Solution:**
Use fresh scope for each test:
```csharp
public class OrdersTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    [Fact]
    public async Task GetOrder_ReturnsOrder()
    {
        // Create new client per test
        var client = _factory.CreateClient();
        // ...
    }
}
```

### Problem: Integration tests slow

**Solutions:**
1. Use Testcontainers for real database
2. Use in-memory database for simple tests
3. Parallelize test collections

```csharp
[CollectionDefinition("Database")]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }

[Collection("Database")]
public class OrderTests { }
```

## Performance Issues

### Problem: Slow endpoint response

**Debug:**
1. Enable SQL logging:
   ```csharp
   options.LogTo(Console.WriteLine, LogLevel.Information);
   ```

2. Check for N+1 queries
3. Add indexes for frequently queried columns
4. Use output caching:
   ```csharp
   .CacheOutput(policy => policy.Expire(TimeSpan.FromMinutes(5)))
   ```

### Problem: High memory usage

**Solutions:**
1. Use projection instead of full entities
2. Implement pagination
3. Use `AsNoTracking()` for read queries
4. Dispose resources properly

## Common Commands

```bash
# Clean rebuild
dotnet clean && dotnet restore && dotnet build

# Update database
dotnet ef database update --project src/ECommerceApi.Infrastructure

# Run specific test
dotnet test --filter "FullyQualifiedName~CreateOrder"

# Check package versions
dotnet list package --outdated

# Generate migration
dotnet ef migrations add MigrationName --project src/ECommerceApi.Infrastructure
```
