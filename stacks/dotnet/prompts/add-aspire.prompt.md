---
name: add-aspire
description: Add .NET Aspire orchestration to an existing solution
---

# Add .NET Aspire

Add .NET Aspire orchestration and service defaults to an existing .NET solution for improved observability, service discovery, and local development.

## Context Required

Before adding Aspire, check:
1. `.memory-bank/project/context.md` for current architecture
2. Existing services and their dependencies
3. Database and messaging infrastructure in use

## Prerequisites

```
.NET Version: {8.0 or 9.0}
Existing Projects: {list of projects in solution}
Infrastructure: {databases, caches, message queues}
Container Runtime: {Docker Desktop | Podman}
```

## Implementation Steps

### Phase 1: Create Aspire Projects

#### 1.1 Add AppHost Project

```bash
# Add AppHost project
dotnet new aspire-apphost -n {SolutionName}.AppHost
dotnet sln add {SolutionName}.AppHost

# Add ServiceDefaults project
dotnet new aspire-servicedefaults -n {SolutionName}.ServiceDefaults
dotnet sln add {SolutionName}.ServiceDefaults
```

#### 1.2 Configure AppHost

```csharp
// {SolutionName}.AppHost/Program.cs
var builder = DistributedApplication.CreateBuilder(args);

// Add infrastructure
var postgres = builder.AddPostgres("postgres")
    .WithPgAdmin()
    .WithDataVolume()
    .AddDatabase("appdb");

var redis = builder.AddRedis("cache")
    .WithRedisCommander()
    .WithDataVolume();

var rabbitmq = builder.AddRabbitMQ("messaging")
    .WithManagementPlugin();

// Add application projects
var api = builder.AddProject<Projects.{SolutionName}_Api>("api")
    .WithReference(postgres)
    .WithReference(redis)
    .WithReference(rabbitmq)
    .WithExternalHttpEndpoints()
    .WaitFor(postgres)
    .WaitFor(redis);

var worker = builder.AddProject<Projects.{SolutionName}_Worker>("worker")
    .WithReference(postgres)
    .WithReference(rabbitmq)
    .WaitFor(postgres)
    .WaitFor(rabbitmq);

var web = builder.AddProject<Projects.{SolutionName}_Web>("web")
    .WithReference(api)
    .WithExternalHttpEndpoints()
    .WaitFor(api);

builder.Build().Run();
```

#### 1.3 Configure ServiceDefaults

```csharp
// {SolutionName}.ServiceDefaults/Extensions.cs
namespace {SolutionName}.ServiceDefaults;

public static class Extensions
{
    public static IHostApplicationBuilder AddServiceDefaults(
        this IHostApplicationBuilder builder)
    {
        builder.ConfigureOpenTelemetry();
        builder.AddDefaultHealthChecks();

        builder.Services.AddServiceDiscovery();

        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            http.AddStandardResilienceHandler();
            http.AddServiceDiscovery();
        });

        return builder;
    }

    public static IHostApplicationBuilder ConfigureOpenTelemetry(
        this IHostApplicationBuilder builder)
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics =>
            {
                metrics.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
            })
            .WithTracing(tracing =>
            {
                tracing.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddEntityFrameworkCoreInstrumentation();
            });

        builder.AddOpenTelemetryExporters();

        return builder;
    }

    private static IHostApplicationBuilder AddOpenTelemetryExporters(
        this IHostApplicationBuilder builder)
    {
        var useOtlpExporter = !string.IsNullOrWhiteSpace(
            builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);

        if (useOtlpExporter)
        {
            builder.Services.AddOpenTelemetry().UseOtlpExporter();
        }

        return builder;
    }

    public static IHostApplicationBuilder AddDefaultHealthChecks(
        this IHostApplicationBuilder builder)
    {
        builder.Services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"]);

        return builder;
    }

    public static WebApplication MapDefaultEndpoints(this WebApplication app)
    {
        app.MapHealthChecks("/health");

        app.MapHealthChecks("/alive", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("live")
        });

        app.MapHealthChecks("/ready", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("ready")
        });

        return app;
    }
}
```

### Phase 2: Update Existing Projects

#### 2.1 Add References

```xml
<!-- In each application project -->
<ItemGroup>
  <ProjectReference Include="..\{SolutionName}.ServiceDefaults\{SolutionName}.ServiceDefaults.csproj" />
</ItemGroup>
```

#### 2.2 Update Program.cs for API Project

```csharp
// {SolutionName}.Api/Program.cs
var builder = WebApplication.CreateBuilder(args);

// Add service defaults (telemetry, health checks, resilience)
builder.AddServiceDefaults();

// Add Aspire components
builder.AddNpgsqlDbContext<ApplicationDbContext>("appdb");
builder.AddRedisDistributedCache("cache");
builder.AddRabbitMQClient("messaging");

// Existing services...
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var app = builder.Build();

// Map default endpoints (health checks)
app.MapDefaultEndpoints();

// Existing middleware...
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.MapOpenApi();

app.Run();
```

#### 2.3 Update Program.cs for Worker Project

```csharp
// {SolutionName}.Worker/Program.cs
var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();

builder.AddNpgsqlDbContext<ApplicationDbContext>("appdb");
builder.AddRabbitMQClient("messaging");

builder.Services.AddHostedService<OrderProcessorService>();

var host = builder.Build();
host.Run();
```

#### 2.4 Update Program.cs for Web Project

```csharp
// {SolutionName}.Web/Program.cs (Blazor)
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Configure HTTP client for API with service discovery
builder.Services.AddHttpClient<IApiClient, ApiClient>(client =>
{
    client.BaseAddress = new Uri("https+http://api");
});

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

app.MapDefaultEndpoints();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
```

### Phase 3: Replace Connection Strings

#### 3.1 Remove Hardcoded Connection Strings

```csharp
// Before - hardcoded configuration
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// After - Aspire handles connection strings
builder.AddNpgsqlDbContext<ApplicationDbContext>("appdb");
```

#### 3.2 Aspire Components Handle Configuration

```csharp
// Aspire automatically provides connection strings
// based on resource names in AppHost

// PostgreSQL
builder.AddNpgsqlDbContext<AppDbContext>("appdb");

// Redis
builder.AddRedisDistributedCache("cache");

// RabbitMQ
builder.AddRabbitMQClient("messaging");

// SQL Server
builder.AddSqlServerDbContext<AppDbContext>("sqldb");

// MongoDB
builder.AddMongoDBClient("mongodb");
```

### Phase 4: Add Health Checks for Resources

```csharp
// In ServiceDefaults or individual projects
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"])
    .AddNpgSql(name: "postgres", tags: ["ready"])
    .AddRedis(name: "redis", tags: ["ready"])
    .AddRabbitMQ(name: "rabbitmq", tags: ["ready"]);
```

### Phase 5: Running the Application

```bash
# Run from AppHost directory
cd {SolutionName}.AppHost
dotnet run

# Or run with watch
dotnet watch

# Dashboard available at https://localhost:17225 (or configured port)
```

### Phase 6: Using the Dashboard

The Aspire Dashboard provides:

1. **Resources View**: All services and their status
2. **Console Logs**: Aggregated logs from all services
3. **Traces**: Distributed tracing across services
4. **Metrics**: Runtime and custom metrics

## Adding Custom Resources

### Azure Resources

```csharp
// For Azure deployment
var storage = builder.AddAzureStorage("storage")
    .AddBlobs("blobs")
    .AddQueues("queues");

var serviceBus = builder.AddAzureServiceBus("messaging")
    .AddQueue("orders")
    .AddTopic("notifications");
```

### External Services

```csharp
// Reference external services
var externalApi = builder.AddConnectionString("external-api");

var api = builder.AddProject<Projects.Api>("api")
    .WithReference(externalApi);
```

## Project Structure After Aspire

```
Solution/
├── {SolutionName}.AppHost/           # Orchestration
│   ├── Program.cs
│   └── {SolutionName}.AppHost.csproj
├── {SolutionName}.ServiceDefaults/   # Shared configuration
│   ├── Extensions.cs
│   └── {SolutionName}.ServiceDefaults.csproj
├── {SolutionName}.Api/               # API project
│   ├── Program.cs
│   └── {SolutionName}.Api.csproj
├── {SolutionName}.Worker/            # Background worker
│   ├── Program.cs
│   └── {SolutionName}.Worker.csproj
├── {SolutionName}.Web/               # Frontend
│   ├── Program.cs
│   └── {SolutionName}.Web.csproj
└── {SolutionName}.sln
```

## Output Checklist

- [ ] AppHost project created and configured
- [ ] ServiceDefaults project with telemetry
- [ ] All projects reference ServiceDefaults
- [ ] Connection strings replaced with Aspire components
- [ ] Health checks configured
- [ ] Service discovery working
- [ ] Dashboard accessible
- [ ] Distributed tracing functional

## Memory Bank Updates

Create ADR for Aspire adoption:

```markdown
# ADR: Adopt .NET Aspire for Orchestration

## Decision
Use .NET Aspire for local development orchestration and observability.

## Benefits
- Simplified local development setup
- Built-in observability (logs, traces, metrics)
- Service discovery for inter-service communication
- Consistent health checks
- Path to cloud deployment

## Consequences
- Requires Docker for infrastructure
- Team needs to learn Aspire concepts
- AppHost is development-only by default
```
