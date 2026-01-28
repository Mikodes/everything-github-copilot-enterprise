---
name: create-minimal-api
description: Generate a Minimal API endpoint group with proper organization and documentation
---

# Create Minimal API

Generate organized Minimal API endpoints following best practices for structure, validation, and documentation.

## Context Required

Before generating, check:
1. `.memory-bank/project/context.md` for API conventions
2. Existing endpoint organization in the codebase
3. Validation and error handling patterns

## Input

```
Resource Name: {name, e.g., "Order", "Product"}
Route Prefix: {route, e.g., "/api/orders"}
Operations: {list | get | create | update | delete | custom}
Use MediatR: {yes | no}
Output Caching: {yes | no}
Rate Limiting: {policy name | none}
Authentication: {required | optional | none}
```

## Generation Process

### 1. Create Endpoint Extension

```csharp
// Endpoints/{Resource}Endpoints.cs
using Microsoft.AspNetCore.Http.HttpResults;

namespace {Namespace}.Endpoints;

public static class {Resource}Endpoints
{
    public static RouteGroupBuilder Map{Resource}Endpoints(this RouteGroupBuilder group)
    {
        var {resources} = group.MapGroup("/{resources}")
            .WithTags("{Resources}")
            .WithOpenApi();

        // GET all
        {resources}.MapGet("/", GetAll{Resources})
            .WithName(nameof(GetAll{Resources}))
            .WithSummary("Get all {resources}")
            .WithDescription("Returns a paginated list of {resources} with optional filtering")
            .Produces<PagedResult<{Resource}Response>>(StatusCodes.Status200OK)
            .CacheOutput(policy => policy.Expire(TimeSpan.FromMinutes(5)).Tag("{resources}"));

        // GET by ID
        {resources}.MapGet("/{id:int}", Get{Resource}ById)
            .WithName(nameof(Get{Resource}ById))
            .WithSummary("Get {resource} by ID")
            .Produces<{Resource}Response>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .CacheOutput(policy => policy.SetVaryByRouteValue("id").Expire(TimeSpan.FromMinutes(5)));

        // POST create
        {resources}.MapPost("/", Create{Resource})
            .WithName(nameof(Create{Resource}))
            .WithSummary("Create a new {resource}")
            .AddEndpointFilter<ValidationFilter<Create{Resource}Request>>()
            .Produces<{Resource}Response>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        // PUT update
        {resources}.MapPut("/{id:int}", Update{Resource})
            .WithName(nameof(Update{Resource}))
            .WithSummary("Update an existing {resource}")
            .AddEndpointFilter<ValidationFilter<Update{Resource}Request>>()
            .Produces<{Resource}Response>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesValidationProblem();

        // DELETE
        {resources}.MapDelete("/{id:int}", Delete{Resource})
            .WithName(nameof(Delete{Resource}))
            .WithSummary("Delete a {resource}")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .RequireAuthorization("RequireAdmin");

        return group;
    }

    // Endpoint handlers
    private static async Task<Ok<PagedResult<{Resource}Response>>> GetAll{Resources}(
        [AsParameters] Get{Resources}Query query,
        I{Resource}Service service,
        CancellationToken ct)
    {
        var result = await service.GetPagedAsync(
            query.Page,
            query.PageSize,
            query.Search,
            query.SortBy,
            query.Descending,
            ct);

        return TypedResults.Ok(result);
    }

    private static async Task<Results<Ok<{Resource}Response>, NotFound>> Get{Resource}ById(
        int id,
        I{Resource}Service service,
        CancellationToken ct)
    {
        var {resource} = await service.GetByIdAsync(id, ct);

        return {resource} is not null
            ? TypedResults.Ok({resource})
            : TypedResults.NotFound();
    }

    private static async Task<Results<Created<{Resource}Response>, ValidationProblem>> Create{Resource}(
        Create{Resource}Request request,
        I{Resource}Service service,
        LinkGenerator links,
        HttpContext context,
        CancellationToken ct)
    {
        var {resource} = await service.CreateAsync(request, ct);

        var location = links.GetPathByName(
            context,
            nameof(Get{Resource}ById),
            new { id = {resource}.Id });

        return TypedResults.Created(location, {resource});
    }

    private static async Task<Results<Ok<{Resource}Response>, NotFound, ValidationProblem>> Update{Resource}(
        int id,
        Update{Resource}Request request,
        I{Resource}Service service,
        IOutputCacheStore cache,
        CancellationToken ct)
    {
        var {resource} = await service.UpdateAsync(id, request, ct);

        if ({resource} is null)
            return TypedResults.NotFound();

        // Invalidate cache
        await cache.EvictByTagAsync("{resources}", ct);

        return TypedResults.Ok({resource});
    }

    private static async Task<Results<NoContent, NotFound>> Delete{Resource}(
        int id,
        I{Resource}Service service,
        IOutputCacheStore cache,
        CancellationToken ct)
    {
        var deleted = await service.DeleteAsync(id, ct);

        if (!deleted)
            return TypedResults.NotFound();

        await cache.EvictByTagAsync("{resources}", ct);

        return TypedResults.NoContent();
    }
}
```

### 2. Create Request/Response Models

```csharp
// Endpoints/{Resource}Models.cs
namespace {Namespace}.Endpoints;

// Query parameters
public record Get{Resources}Query(
    [FromQuery] string? Search = null,
    [FromQuery] int Page = 1,
    [FromQuery] int PageSize = 20,
    [FromQuery] string? SortBy = null,
    [FromQuery] bool Descending = false);

// Create request
public record Create{Resource}Request(
    string Name,
    string? Description,
    decimal Price,
    int CategoryId);

// Update request
public record Update{Resource}Request(
    string Name,
    string? Description,
    decimal Price,
    int CategoryId);

// Response
public record {Resource}Response(
    int Id,
    string Name,
    string? Description,
    decimal Price,
    string CategoryName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

// Paged result
public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}
```

### 3. Create Validators

```csharp
// Endpoints/{Resource}Validators.cs
using FluentValidation;

namespace {Namespace}.Endpoints;

public class Create{Resource}RequestValidator : AbstractValidator<Create{Resource}Request>
{
    public Create{Resource}RequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name must not exceed 200 characters");

        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Description must not exceed 1000 characters");

        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Price must be greater than 0")
            .LessThanOrEqualTo(1000000).WithMessage("Price must not exceed 1,000,000");

        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("Category is required");
    }
}

public class Update{Resource}RequestValidator : AbstractValidator<Update{Resource}Request>
{
    public Update{Resource}RequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name must not exceed 200 characters");

        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Description must not exceed 1000 characters");

        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Price must be greater than 0");

        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("Category is required");
    }
}
```

### 4. Create Validation Filter

```csharp
// Filters/ValidationFilter.cs
namespace {Namespace}.Filters;

public class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var validator = context.HttpContext.RequestServices.GetService<IValidator<T>>();

        if (validator is null)
            return await next(context);

        var argument = context.Arguments.OfType<T>().FirstOrDefault();

        if (argument is null)
            return await next(context);

        var validationResult = await validator.ValidateAsync(argument);

        if (!validationResult.IsValid)
        {
            return TypedResults.ValidationProblem(
                validationResult.ToDictionary());
        }

        return await next(context);
    }
}
```

### 5. Register in Program.cs

```csharp
// Program.cs
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddOutputCache();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseOutputCache();

// Map all endpoint groups
app.MapGroup("/api/v1")
    .RequireAuthorization()
    .Map{Resource}Endpoints()
    .MapOtherEndpoints();

app.Run();
```

## With MediatR Pattern

```csharp
private static async Task<Results<Ok<{Resource}Response>, NotFound>> Get{Resource}ById(
    int id,
    ISender sender,
    CancellationToken ct)
{
    var result = await sender.Send(new Get{Resource}ByIdQuery(id), ct);

    return result.IsSuccess
        ? TypedResults.Ok(result.Value)
        : TypedResults.NotFound();
}

private static async Task<Results<Created<{Resource}Response>, ValidationProblem>> Create{Resource}(
    Create{Resource}Command command,
    ISender sender,
    LinkGenerator links,
    HttpContext context,
    CancellationToken ct)
{
    var result = await sender.Send(command, ct);

    if (result.IsFailure)
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["Error"] = [result.Error.Message]
        });

    var location = links.GetPathByName(
        context,
        nameof(Get{Resource}ById),
        new { id = result.Value.Id });

    return TypedResults.Created(location, result.Value);
}
```

## Output Checklist

- [ ] Endpoints organized in extension method
- [ ] Route grouping with tags
- [ ] OpenAPI documentation (Produces, WithSummary)
- [ ] Typed results for compile-time safety
- [ ] Validation filter applied
- [ ] Output caching configured
- [ ] Cache invalidation on mutations
- [ ] Authorization requirements
- [ ] CancellationToken propagation

## Memory Bank Updates

Document in `.memory-bank/modules/{resource}/context.md`:
- API endpoints and operations
- Request/Response schemas
- Validation rules
