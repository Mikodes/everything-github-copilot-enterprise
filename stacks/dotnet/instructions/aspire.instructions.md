---
applyTo: "**/*.cs,**/*.csproj"
excludeAgent: ""
---

# .NET Aspire Instructions

These instructions define patterns for using .NET Aspire to build cloud-native, observable, and production-ready distributed applications.

## What is .NET Aspire?

.NET Aspire is an opinionated stack for building observable, production-ready, distributed applications. It provides:

- **Orchestration**: Coordinate multiple services and resources
- **Components**: Pre-configured integrations for common services
- **Tooling**: Dashboard for monitoring and debugging
- **Deployment**: Simplified deployment to Azure and other clouds

## Project Structure

```
MyApp/
├── MyApp.AppHost/              # Orchestration project
│   ├── Program.cs
│   └── MyApp.AppHost.csproj
├── MyApp.ServiceDefaults/      # Shared service configuration
│   ├── Extensions.cs
│   └── MyApp.ServiceDefaults.csproj
├── MyApp.Api/                  # Web API project
│   ├── Program.cs
│   └── MyApp.Api.csproj
├── MyApp.Worker/               # Background worker
│   ├── Program.cs
│   └── MyApp.Worker.csproj
└── MyApp.Web/                  # Blazor frontend
    ├── Program.cs
    └── MyApp.Web.csproj
```

## AppHost Configuration

### Basic Orchestration

```csharp
// MyApp.AppHost/Program.cs
var builder = DistributedApplication.CreateBuilder(args);

// Add infrastructure resources
var postgres = builder.AddPostgres("postgres")
    .WithPgAdmin()
    .AddDatabase("appdb");

var redis = builder.AddRedis("cache")
    .WithRedisCommander();

var rabbitmq = builder.AddRabbitMQ("messaging")
    .WithManagementPlugin();

// Add application projects
var api = builder.AddProject<Projects.MyApp_Api>("api")
    .WithReference(postgres)
    .WithReference(redis)
    .WithReference(rabbitmq)
    .WithExternalHttpEndpoints();

var worker = builder.AddProject<Projects.MyApp_Worker>("worker")
    .WithReference(postgres)
    .WithReference(rabbitmq);

var web = builder.AddProject<Projects.MyApp_Web>("web")
    .WithReference(api)
    .WithExternalHttpEndpoints();

builder.Build().Run();
```

### Advanced Resource Configuration

```csharp
// Configure with specific settings
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()  // Persist data
    .WithPgAdmin()
    .AddDatabase("orders");

// SQL Server with volume
var sqlServer = builder.AddSqlServer("sql")
    .WithDataVolume()
    .AddDatabase("inventory");

// Redis with persistence
var redis = builder.AddRedis("cache")
    .WithDataVolume()
    .WithPersistence(TimeSpan.FromMinutes(5), 100);

// Azure Service Bus (connection string from configuration)
var serviceBus = builder.AddAzureServiceBus("messaging")
    .AddQueue("orders")
    .AddTopic("notifications");

// Azure Storage
var storage = builder.AddAzureStorage("storage")
    .AddBlobs("blobs")
    .AddQueues("queues");

// MongoDB
var mongo = builder.AddMongoDB("mongodb")
    .WithDataVolume()
    .AddDatabase("catalog");
```

### Configuring Projects

```csharp
var api = builder.AddProject<Projects.MyApp_Api>("api")
    // Reference resources
    .WithReference(postgres)
    .WithReference(redis)

    // Environment variables
    .WithEnvironment("FEATURE_FLAG", "enabled")

    // Replicas for load testing
    .WithReplicas(3)

    // Health checks endpoint
    .WithHttpHealthCheck("/health")

    // External access
    .WithExternalHttpEndpoints();

// Reference other projects
var web = builder.AddProject<Projects.MyApp_Web>("web")
    .WithReference(api)  // Get API endpoint automatically
    .WaitFor(api);       // Wait for API to be healthy
```

## Service Defaults

### Standard Configuration

```csharp
// MyApp.ServiceDefaults/Extensions.cs
public static class Extensions
{
    public static IHostApplicationBuilder AddServiceDefaults(
        this IHostApplicationBuilder builder)
    {
        // OpenTelemetry
        builder.ConfigureOpenTelemetry();

        // Health checks
        builder.AddDefaultHealthChecks();

        // Service discovery
        builder.Services.AddServiceDiscovery();

        // Resilience
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
            builder.Services.AddOpenTelemetry()
                .UseOtlpExporter();
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

## Using Aspire Components

### Entity Framework Core with PostgreSQL

```csharp
// MyApp.Api/Program.cs
var builder = WebApplication.CreateBuilder(args);

// Add service defaults (telemetry, health checks, etc.)
builder.AddServiceDefaults();

// Add Aspire PostgreSQL with EF Core
builder.AddNpgsqlDbContext<ApplicationDbContext>("appdb");

// Or with specific options
builder.AddNpgsqlDbContext<ApplicationDbContext>("appdb", settings =>
{
    settings.DisableRetry = false;
    settings.CommandTimeout = 30;
});
```

### Redis Caching

```csharp
// Add Aspire Redis distributed cache
builder.AddRedisDistributedCache("cache");

// Or output caching
builder.AddRedisOutputCache("cache");

// Usage in service
public class ProductService(IDistributedCache cache)
{
    public async Task<Product?> GetByIdAsync(int id)
    {
        var cacheKey = $"product:{id}";

        var cached = await cache.GetStringAsync(cacheKey);
        if (cached is not null)
            return JsonSerializer.Deserialize<Product>(cached);

        // ... fetch from database
    }
}
```

### RabbitMQ Messaging

```csharp
// Add Aspire RabbitMQ
builder.AddRabbitMQClient("messaging");

// Usage
public class OrderPublisher(IConnection connection)
{
    public async Task PublishOrderCreatedAsync(Order order)
    {
        using var channel = await connection.CreateChannelAsync();

        await channel.QueueDeclareAsync(
            queue: "orders",
            durable: true,
            exclusive: false,
            autoDelete: false);

        var body = JsonSerializer.SerializeToUtf8Bytes(order);

        await channel.BasicPublishAsync(
            exchange: "",
            routingKey: "orders",
            body: body);
    }
}
```

### Azure Service Bus

```csharp
// Add Aspire Azure Service Bus
builder.AddAzureServiceBusClient("messaging");

// Usage
public class NotificationPublisher(ServiceBusClient client)
{
    public async Task PublishAsync(Notification notification)
    {
        await using var sender = client.CreateSender("notifications");

        var message = new ServiceBusMessage(
            JsonSerializer.SerializeToUtf8Bytes(notification))
        {
            ContentType = "application/json",
            Subject = notification.Type
        };

        await sender.SendMessageAsync(message);
    }
}
```

### HTTP Client with Service Discovery

```csharp
// In Program.cs
builder.Services.AddHttpClient<IOrderApiClient, OrderApiClient>(client =>
{
    client.BaseAddress = new Uri("https+http://api");  // Service discovery
});

// Client implementation
public class OrderApiClient(HttpClient httpClient) : IOrderApiClient
{
    public async Task<Order?> GetOrderAsync(int id)
    {
        // Automatically uses service discovery and resilience
        return await httpClient.GetFromJsonAsync<Order>($"/api/orders/{id}");
    }
}
```

## Dashboard and Observability

### Accessing the Dashboard

```csharp
// Dashboard is automatically available at:
// https://localhost:17225 (or configured port)

// Configure dashboard in AppHost
var builder = DistributedApplication.CreateBuilder(args);

// Dashboard configuration is automatic, but can be customized:
// - Set DOTNET_DASHBOARD_OTLP_ENDPOINT_URL for OTLP endpoint
// - Set DOTNET_RESOURCE_SERVICE_ENDPOINT_URL for resource service
```

### Custom Metrics

```csharp
public class OrderMetrics
{
    private readonly Counter<int> _ordersCreated;
    private readonly Histogram<double> _orderProcessingDuration;

    public OrderMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("MyApp.Orders");

        _ordersCreated = meter.CreateCounter<int>(
            "orders.created",
            unit: "orders",
            description: "Number of orders created");

        _orderProcessingDuration = meter.CreateHistogram<double>(
            "orders.processing.duration",
            unit: "ms",
            description: "Order processing duration");
    }

    public void OrderCreated(string customerId)
    {
        _ordersCreated.Add(1, new KeyValuePair<string, object?>("customer_id", customerId));
    }

    public void RecordProcessingDuration(double durationMs)
    {
        _orderProcessingDuration.Record(durationMs);
    }
}

// Register
builder.Services.AddSingleton<OrderMetrics>();
```

## Deployment

### Generating Deployment Manifests

```bash
# Generate Kubernetes manifests
dotnet run --project MyApp.AppHost -- --publisher manifest --output-path ./manifests

# Generate Bicep for Azure
dotnet run --project MyApp.AppHost -- --publisher azure --output-path ./infra
```

### Azure Container Apps Deployment

```csharp
// AppHost configuration for Azure deployment
var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddAzurePostgresFlexibleServer("postgres")
    .AddDatabase("appdb");

var redis = builder.AddAzureRedis("cache");

var api = builder.AddProject<Projects.MyApp_Api>("api")
    .WithReference(postgres)
    .WithReference(redis)
    .PublishAsAzureContainerApp((module, app) =>
    {
        app.Configuration.Value!.Ingress.Value!.External = true;
    });

builder.Build().Run();
```

## Best Practices

### Resource Naming

```csharp
// ✅ Use consistent, descriptive names
var orderDb = builder.AddPostgres("orders-db").AddDatabase("orders");
var userDb = builder.AddPostgres("users-db").AddDatabase("users");

// ❌ Avoid generic names
var db1 = builder.AddPostgres("db1");
```

### Health Checks

```csharp
// ✅ Configure health checks for each resource type
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "postgres")
    .AddRedis(redisConnectionString, name: "redis")
    .AddRabbitMQ(rabbitConnectionString, name: "rabbitmq");
```

### Environment-Specific Configuration

```csharp
// ✅ Use environment to configure resources
if (builder.Environment.IsDevelopment())
{
    // Use containers in development
    var postgres = builder.AddPostgres("postgres").AddDatabase("app");
}
else
{
    // Use Azure in production
    var postgres = builder.AddAzurePostgresFlexibleServer("postgres").AddDatabase("app");
}
```

### Wait for Dependencies

```csharp
// ✅ Ensure services start in correct order
var db = builder.AddPostgres("postgres").AddDatabase("app");

var api = builder.AddProject<Projects.MyApp_Api>("api")
    .WithReference(db)
    .WaitFor(db);  // Wait for database to be ready

var web = builder.AddProject<Projects.MyApp_Web>("web")
    .WithReference(api)
    .WaitFor(api);  // Wait for API to be ready
```
