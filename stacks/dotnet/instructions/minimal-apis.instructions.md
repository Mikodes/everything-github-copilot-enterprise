---
applyTo: "**/*.cs"
excludeAgent: ""
---

# Minimal APIs Instructions

These instructions define best practices for building HTTP APIs using ASP.NET Core Minimal APIs. Use these patterns for lightweight, high-performance APIs.

## Basic Setup

### Program.cs Structure

```csharp
// ✅ Well-organized Program.cs
var builder = WebApplication.CreateBuilder(args);

// Configuration
builder.Services.AddOptions<DatabaseOptions>()
    .BindConfiguration("Database")
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Services
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// API essentials
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "Enterprise API"
    });
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

var app = builder.Build();

// Middleware pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

// Map endpoints
app.MapGroup("/api/v1")
    .MapCustomerEndpoints()
    .MapOrderEndpoints()
    .MapProductEndpoints()
    .RequireAuthorization();

app.Run();
```

## Endpoint Organization

### Route Groups

```csharp
// ✅ Organize endpoints by feature
public static class CustomerEndpoints
{
    public static RouteGroupBuilder MapCustomerEndpoints(this RouteGroupBuilder group)
    {
        var customers = group.MapGroup("/customers")
            .WithTags("Customers")
            .WithOpenApi();

        customers.MapGet("/", GetAllCustomers)
            .WithName(nameof(GetAllCustomers))
            .WithSummary("Get all customers")
            .WithDescription("Returns a paginated list of customers");

        customers.MapGet("/{id:int}", GetCustomerById)
            .WithName(nameof(GetCustomerById))
            .WithSummary("Get customer by ID");

        customers.MapPost("/", CreateCustomer)
            .WithName(nameof(CreateCustomer))
            .WithSummary("Create a new customer");

        customers.MapPut("/{id:int}", UpdateCustomer)
            .WithName(nameof(UpdateCustomer))
            .WithSummary("Update a customer");

        customers.MapDelete("/{id:int}", DeleteCustomer)
            .WithName(nameof(DeleteCustomer))
            .WithSummary("Delete a customer")
            .RequireAuthorization("RequireAdmin");

        return group;
    }

    private static async Task<IResult> GetAllCustomers(
        [AsParameters] GetCustomersQuery query,
        ICustomerService service,
        CancellationToken ct)
    {
        var result = await service.GetAllAsync(query, ct);
        return TypedResults.Ok(result);
    }

    private static async Task<IResult> GetCustomerById(
        int id,
        ICustomerService service,
        CancellationToken ct)
    {
        var customer = await service.GetByIdAsync(id, ct);
        return customer is not null
            ? TypedResults.Ok(customer)
            : TypedResults.NotFound();
    }

    private static async Task<IResult> CreateCustomer(
        CreateCustomerRequest request,
        ICustomerService service,
        LinkGenerator links,
        HttpContext context,
        CancellationToken ct)
    {
        var customer = await service.CreateAsync(request, ct);

        var location = links.GetPathByName(
            context,
            nameof(GetCustomerById),
            new { id = customer.Id });

        return TypedResults.Created(location, customer);
    }

    private static async Task<IResult> UpdateCustomer(
        int id,
        UpdateCustomerRequest request,
        ICustomerService service,
        CancellationToken ct)
    {
        var customer = await service.UpdateAsync(id, request, ct);
        return customer is not null
            ? TypedResults.Ok(customer)
            : TypedResults.NotFound();
    }

    private static async Task<IResult> DeleteCustomer(
        int id,
        ICustomerService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteAsync(id, ct);
        return deleted
            ? TypedResults.NoContent()
            : TypedResults.NotFound();
    }
}
```

## Parameter Binding

### Request Models

```csharp
// ✅ Query parameters
public record GetCustomersQuery(
    [FromQuery] string? Search,
    [FromQuery] int Page = 1,
    [FromQuery] int PageSize = 20,
    [FromQuery] string? SortBy = null,
    [FromQuery] bool Descending = false);

// ✅ Route and query combined
public record GetOrdersByCustomerQuery(
    [FromRoute] int CustomerId,
    [FromQuery] DateTime? From,
    [FromQuery] DateTime? To,
    [FromQuery] OrderStatus? Status);

// ✅ Body with validation
public record CreateCustomerRequest(
    string Name,
    string Email,
    Address? Address);

// ✅ Header binding
public record ApiRequest(
    [FromHeader(Name = "X-Correlation-Id")] string? CorrelationId,
    [FromHeader(Name = "X-Request-Source")] string? Source);
```

### Parameter Validation

```csharp
// ✅ Endpoint filter for validation
public class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var validator = context.HttpContext.RequestServices
            .GetService<IValidator<T>>();

        if (validator is null)
            return await next(context);

        var argument = context.Arguments.OfType<T>().FirstOrDefault();

        if (argument is null)
            return await next(context);

        var result = await validator.ValidateAsync(argument);

        if (!result.IsValid)
        {
            return TypedResults.ValidationProblem(result.ToDictionary());
        }

        return await next(context);
    }
}

// Usage
customers.MapPost("/", CreateCustomer)
    .AddEndpointFilter<ValidationFilter<CreateCustomerRequest>>();
```

## Response Types

### TypedResults

```csharp
// ✅ Always use TypedResults for better OpenAPI support
private static async Task<Results<Ok<CustomerResponse>, NotFound, ValidationProblem>> GetCustomer(
    int id,
    ICustomerService service,
    CancellationToken ct)
{
    if (id <= 0)
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["id"] = ["ID must be greater than 0"]
        });
    }

    var customer = await service.GetByIdAsync(id, ct);

    return customer is not null
        ? TypedResults.Ok(customer)
        : TypedResults.NotFound();
}

// ✅ Produces attributes for documentation
customers.MapGet("/{id:int}", GetCustomerById)
    .Produces<CustomerResponse>(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status404NotFound)
    .ProducesValidationProblem();
```

### Paginated Results

```csharp
// ✅ Standard paged response
public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
}

// Usage
private static async Task<Ok<PagedResult<CustomerResponse>>> GetAllCustomers(
    [AsParameters] GetCustomersQuery query,
    ICustomerService service,
    CancellationToken ct)
{
    var result = await service.GetPagedAsync(query.Page, query.PageSize, query.Search, ct);
    return TypedResults.Ok(result);
}
```

## Error Handling

### Problem Details

```csharp
// ✅ Configure problem details
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["traceId"] =
            Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;
        context.ProblemDetails.Extensions["instance"] =
            context.HttpContext.Request.Path;
    };
});

// ✅ Custom exception handler
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "Unhandled exception occurred");

        var problemDetails = exception switch
        {
            ValidationException ve => new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Validation Error",
                Detail = "One or more validation errors occurred",
                Extensions = { ["errors"] = ve.Errors }
            },
            NotFoundException => new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Not Found",
                Detail = exception.Message
            },
            _ => new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Internal Server Error",
                Detail = "An unexpected error occurred"
            }
        };

        httpContext.Response.StatusCode = problemDetails.Status ?? 500;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }
}
```

## Caching

### Output Caching

```csharp
// ✅ Configure output caching
builder.Services.AddOutputCache(options =>
{
    options.AddBasePolicy(policy => policy.Expire(TimeSpan.FromMinutes(1)));

    options.AddPolicy("Products", policy =>
        policy.Expire(TimeSpan.FromMinutes(10))
              .Tag("products"));

    options.AddPolicy("ById", policy =>
        policy.SetVaryByRouteValue("id")
              .Expire(TimeSpan.FromMinutes(5)));
});

app.UseOutputCache();

// Usage
products.MapGet("/", GetAllProducts)
    .CacheOutput("Products");

products.MapGet("/{id:int}", GetProductById)
    .CacheOutput("ById");

// Cache invalidation
products.MapPut("/{id:int}", async (
    int id,
    UpdateProductRequest request,
    IProductService service,
    IOutputCacheStore cache,
    CancellationToken ct) =>
{
    var product = await service.UpdateAsync(id, request, ct);
    await cache.EvictByTagAsync("products", ct);
    return TypedResults.Ok(product);
});
```

## API Versioning

```csharp
// ✅ URL segment versioning
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = new UrlSegmentApiVersionReader();
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// Map versioned endpoints
var v1 = app.NewVersionedApi()
    .MapGroup("/api/v{version:apiVersion}")
    .HasApiVersion(1.0);

var v2 = app.NewVersionedApi()
    .MapGroup("/api/v{version:apiVersion}")
    .HasApiVersion(2.0);

v1.MapCustomerEndpointsV1();
v2.MapCustomerEndpointsV2();
```

## Authentication & Authorization

```csharp
// ✅ Secure endpoints
var authenticated = app.MapGroup("/api")
    .RequireAuthorization();

// Per-endpoint authorization
customers.MapDelete("/{id:int}", DeleteCustomer)
    .RequireAuthorization("RequireAdmin");

// Accessing user claims
private static async Task<IResult> GetMyOrders(
    ClaimsPrincipal user,
    IOrderService service,
    CancellationToken ct)
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
    if (userId is null)
        return TypedResults.Unauthorized();

    var orders = await service.GetByUserIdAsync(Guid.Parse(userId), ct);
    return TypedResults.Ok(orders);
}
```

## Rate Limiting

```csharp
// ✅ Configure rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("api", config =>
    {
        config.PermitLimit = 100;
        config.Window = TimeSpan.FromMinutes(1);
        config.QueueLimit = 10;
    });

    options.AddSlidingWindowLimiter("sensitive", config =>
    {
        config.PermitLimit = 10;
        config.Window = TimeSpan.FromMinutes(1);
        config.SegmentsPerWindow = 4;
    });

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Rate limit exceeded" }, ct);
    };
});

app.UseRateLimiter();

// Apply rate limiting
customers.MapGet("/", GetAllCustomers)
    .RequireRateLimiting("api");

auth.MapPost("/login", Login)
    .RequireRateLimiting("sensitive");
```

## File Uploads

```csharp
// ✅ Handle file uploads
app.MapPost("/api/files", async (
    IFormFile file,
    IFileStorageService storage,
    CancellationToken ct) =>
{
    if (file.Length == 0)
        return TypedResults.BadRequest("File is empty");

    if (file.Length > 10 * 1024 * 1024) // 10MB limit
        return TypedResults.BadRequest("File too large");

    var allowedTypes = new[] { "image/jpeg", "image/png", "application/pdf" };
    if (!allowedTypes.Contains(file.ContentType))
        return TypedResults.BadRequest("Invalid file type");

    await using var stream = file.OpenReadStream();
    var fileId = await storage.UploadAsync(stream, file.FileName, file.ContentType, ct);

    return TypedResults.Ok(new { fileId });
})
.DisableAntiforgery();
```

## Anti-patterns to Avoid

```csharp
// ❌ Don't put all endpoints in Program.cs
app.MapGet("/api/customers", async (ICustomerService s) => { });
app.MapGet("/api/customers/{id}", async (int id, ICustomerService s) => { });
// ... 50 more endpoints

// ✅ Organize into extension methods
app.MapGroup("/api").MapCustomerEndpoints().MapOrderEndpoints();

// ❌ Don't use IResult when you can use TypedResults
return Results.Ok(customer); // Less type info

// ✅ Use TypedResults
return TypedResults.Ok(customer);

// ❌ Don't forget cancellation tokens
app.MapGet("/", async (IService s) => await s.GetAsync());

// ✅ Always accept cancellation tokens
app.MapGet("/", async (IService s, CancellationToken ct) => await s.GetAsync(ct));
```
