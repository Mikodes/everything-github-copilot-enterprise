---
name: create-api-controller
description: Generate an ASP.NET Core API controller with CRUD operations following team patterns
---

# Create API Controller

Generate an ASP.NET Core API controller following the project's established patterns.

## Context Required

Before generating, check:
1. `.memory-bank/project/context.md` for API style (Controllers vs Minimal APIs)
2. `.memory-bank/knowledge/dotnet-patterns.md` for approved patterns
3. Existing controllers in the codebase for consistency

## Input

```
Resource Name: {name of the resource, e.g., "Order", "Product"}
Route: {API route, e.g., "/api/orders"}
Operations: {CRUD operations needed: Create, Read, ReadAll, Update, Delete}
Authentication: {required | optional | none}
Use MediatR: {yes | no}
```

## Generation Process

### 1. Analyze Existing Patterns

Examine the codebase for:
- Base controller classes
- Response wrapper patterns
- Error handling approach
- Validation patterns
- Authorization policies

### 2. Generate Controller

#### With MediatR Pattern

```csharp
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace {Namespace}.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class {Resource}sController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<{Resource}sController> _logger;

    public {Resource}sController(ISender sender, ILogger<{Resource}sController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>
    /// Get all {resources} with optional filtering and pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<{Resource}Response>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<{Resource}Response>>> GetAll(
        [FromQuery] Get{Resource}sQuery query,
        CancellationToken ct)
    {
        var result = await _sender.Send(query, ct);
        return Ok(result);
    }

    /// <summary>
    /// Get a specific {resource} by ID
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof({Resource}Response), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<{Resource}Response>> GetById(int id, CancellationToken ct)
    {
        var result = await _sender.Send(new Get{Resource}ByIdQuery(id), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : NotFound(new ProblemDetails
            {
                Title = "Not Found",
                Detail = result.Error.Message,
                Status = StatusCodes.Status404NotFound
            });
    }

    /// <summary>
    /// Create a new {resource}
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof({Resource}Response), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<{Resource}Response>> Create(
        Create{Resource}Command command,
        CancellationToken ct)
    {
        var result = await _sender.Send(command, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value)
            : BadRequest(new ProblemDetails
            {
                Title = "Bad Request",
                Detail = result.Error.Message,
                Status = StatusCodes.Status400BadRequest
            });
    }

    /// <summary>
    /// Update an existing {resource}
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof({Resource}Response), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<{Resource}Response>> Update(
        int id,
        Update{Resource}Command command,
        CancellationToken ct)
    {
        if (id != command.Id)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Bad Request",
                Detail = "Route ID does not match command ID",
                Status = StatusCodes.Status400BadRequest
            });
        }

        var result = await _sender.Send(command, ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : result.Error.Code == "NotFound"
                ? NotFound()
                : BadRequest(new ProblemDetails
                {
                    Title = "Bad Request",
                    Detail = result.Error.Message
                });
    }

    /// <summary>
    /// Delete a {resource}
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var result = await _sender.Send(new Delete{Resource}Command(id), ct);

        return result.IsSuccess
            ? NoContent()
            : NotFound();
    }
}
```

#### Without MediatR (Direct Service Injection)

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace {Namespace}.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class {Resource}sController : ControllerBase
{
    private readonly I{Resource}Service _{resource}Service;
    private readonly ILogger<{Resource}sController> _logger;

    public {Resource}sController(
        I{Resource}Service {resource}Service,
        ILogger<{Resource}sController> logger)
    {
        _{resource}Service = {resource}Service;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<{Resource}Response>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<{Resource}Response>>> GetAll(CancellationToken ct)
    {
        var {resources} = await _{resource}Service.GetAllAsync(ct);
        return Ok({resources});
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof({Resource}Response), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<{Resource}Response>> GetById(int id, CancellationToken ct)
    {
        var {resource} = await _{resource}Service.GetByIdAsync(id, ct);
        return {resource} is not null ? Ok({resource}) : NotFound();
    }

    [HttpPost]
    [ProducesResponseType(typeof({Resource}Response), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<{Resource}Response>> Create(
        Create{Resource}Request request,
        CancellationToken ct)
    {
        var {resource} = await _{resource}Service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = {resource}.Id }, {resource});
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof({Resource}Response), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<{Resource}Response>> Update(
        int id,
        Update{Resource}Request request,
        CancellationToken ct)
    {
        var {resource} = await _{resource}Service.UpdateAsync(id, request, ct);
        return {resource} is not null ? Ok({resource}) : NotFound();
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await _{resource}Service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
```

### 3. Generate Supporting Files

Also generate:
- Request/Response DTOs
- Validators (FluentValidation)
- Commands/Queries (if using MediatR)

## Output Checklist

- [ ] Controller follows existing patterns
- [ ] Proper HTTP verbs and status codes
- [ ] Authorization attributes applied
- [ ] OpenAPI documentation (ProducesResponseType)
- [ ] Cancellation token support
- [ ] Consistent error responses
- [ ] Logging for important operations

## Memory Bank Updates

After generation, suggest updating:
- `.memory-bank/modules/{resource}/context.md` - API endpoints
- `.memory-bank/knowledge/dotnet-patterns.md` - If new patterns introduced
