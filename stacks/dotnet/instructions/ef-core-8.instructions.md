---
applyTo: "**/*.cs"
excludeAgent: ""
---

# Entity Framework Core 8 Instructions

These instructions define best practices for Entity Framework Core 8 in enterprise applications. Follow these patterns for efficient, maintainable data access.

## DbContext Configuration

### Standard Setup

```csharp
// ✅ Production-ready DbContext
public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Apply all configurations from assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Global conventions
        configurationBuilder.Properties<string>()
            .HaveMaxLength(250);

        configurationBuilder.Properties<decimal>()
            .HavePrecision(18, 2);

        // Custom type conversions
        configurationBuilder.Properties<DateOnly>()
            .HaveConversion<DateOnlyConverter>();
    }
}

// Registration in Program.cs
builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null);

            sqlOptions.CommandTimeout(30);
            sqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
        });

    if (builder.Environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();
        options.EnableDetailedErrors();
    }
});
```

### Entity Configuration

```csharp
// ✅ Separate configuration files
public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");

        // Primary key
        builder.HasKey(c => c.Id);

        // Properties
        builder.Property(c => c.Email)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(100);

        // Complex type (EF Core 8)
        builder.ComplexProperty(c => c.Address, address =>
        {
            address.Property(a => a.Street).HasMaxLength(200);
            address.Property(a => a.City).HasMaxLength(100);
            address.Property(a => a.PostalCode).HasMaxLength(20);
            address.Property(a => a.Country).HasMaxLength(2);
        });

        // Indexes
        builder.HasIndex(c => c.Email).IsUnique();
        builder.HasIndex(c => c.Name);

        // Relationships
        builder.HasMany(c => c.Orders)
            .WithOne(o => o.Customer)
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.OrderNumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(o => o.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(o => o.Total)
            .HasPrecision(18, 2);

        // JSON column (EF Core 8)
        builder.OwnsOne(o => o.Metadata, m =>
        {
            m.ToJson();
        });

        // Indexes
        builder.HasIndex(o => o.OrderNumber).IsUnique();
        builder.HasIndex(o => o.CustomerId);
        builder.HasIndex(o => o.CreatedAt);
        builder.HasIndex(o => o.Status);

        // Composite index
        builder.HasIndex(o => new { o.CustomerId, o.Status, o.CreatedAt });
    }
}
```

## Query Patterns

### No-Tracking Queries

```csharp
// ✅ Use no-tracking for read-only queries
public async Task<IReadOnlyList<CustomerDto>> GetCustomersAsync(CancellationToken ct)
{
    return await _context.Customers
        .AsNoTracking()
        .Select(c => new CustomerDto
        {
            Id = c.Id,
            Name = c.Name,
            Email = c.Email
        })
        .ToListAsync(ct);
}

// ✅ Configure no-tracking globally for read-only contexts
builder.Services.AddDbContext<ReadOnlyDbContext>(options =>
{
    options.UseSqlServer(connectionString);
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
});
```

### Projection

```csharp
// ✅ Project to DTOs instead of loading entire entities
public async Task<OrderDetailsDto?> GetOrderDetailsAsync(int orderId, CancellationToken ct)
{
    return await _context.Orders
        .AsNoTracking()
        .Where(o => o.Id == orderId)
        .Select(o => new OrderDetailsDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            Status = o.Status,
            Total = o.Total,
            CustomerName = o.Customer.Name,
            CustomerEmail = o.Customer.Email,
            Items = o.Items.Select(i => new OrderItemDto
            {
                ProductName = i.Product.Name,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                Total = i.Quantity * i.UnitPrice
            }).ToList(),
            CreatedAt = o.CreatedAt
        })
        .FirstOrDefaultAsync(ct);
}
```

### Eager Loading

```csharp
// ✅ Explicit eager loading
public async Task<Order?> GetOrderWithItemsAsync(int orderId, CancellationToken ct)
{
    return await _context.Orders
        .Include(o => o.Items)
            .ThenInclude(i => i.Product)
        .Include(o => o.Customer)
        .FirstOrDefaultAsync(o => o.Id == orderId, ct);
}

// ✅ Split queries for multiple collections
public async Task<Customer?> GetCustomerWithOrdersAsync(int customerId, CancellationToken ct)
{
    return await _context.Customers
        .Include(c => c.Orders)
            .ThenInclude(o => o.Items)
        .AsSplitQuery() // Generates separate SQL queries
        .FirstOrDefaultAsync(c => c.Id == customerId, ct);
}
```

### Compiled Queries

```csharp
// ✅ Compiled queries for hot paths
public class OrderRepository : IOrderRepository
{
    private readonly ApplicationDbContext _context;

    // Compiled query - parsed once at startup
    private static readonly Func<ApplicationDbContext, int, Task<Order?>> GetOrderByIdCompiled =
        EF.CompileAsyncQuery((ApplicationDbContext ctx, int id) =>
            ctx.Orders
                .Include(o => o.Items)
                .FirstOrDefault(o => o.Id == id));

    private static readonly Func<ApplicationDbContext, int, IAsyncEnumerable<Order>> GetOrdersByCustomerCompiled =
        EF.CompileAsyncQuery((ApplicationDbContext ctx, int customerId) =>
            ctx.Orders
                .Where(o => o.CustomerId == customerId)
                .OrderByDescending(o => o.CreatedAt));

    public async Task<Order?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await GetOrderByIdCompiled(_context, id);
    }

    public async Task<IReadOnlyList<Order>> GetByCustomerAsync(int customerId, CancellationToken ct)
    {
        var orders = new List<Order>();
        await foreach (var order in GetOrdersByCustomerCompiled(_context, customerId))
        {
            orders.Add(order);
        }
        return orders;
    }
}
```

## Bulk Operations

```csharp
// ✅ EF Core 8 - ExecuteUpdate (no entity loading)
public async Task<int> UpdateOrderStatusAsync(
    int customerId,
    OrderStatus oldStatus,
    OrderStatus newStatus,
    CancellationToken ct)
{
    return await _context.Orders
        .Where(o => o.CustomerId == customerId)
        .Where(o => o.Status == oldStatus)
        .ExecuteUpdateAsync(s => s
            .SetProperty(o => o.Status, newStatus)
            .SetProperty(o => o.UpdatedAt, DateTime.UtcNow),
            ct);
}

// ✅ EF Core 8 - ExecuteDelete (no entity loading)
public async Task<int> DeleteOldOrdersAsync(int daysOld, CancellationToken ct)
{
    var cutoffDate = DateTime.UtcNow.AddDays(-daysOld);

    return await _context.Orders
        .Where(o => o.Status == OrderStatus.Cancelled)
        .Where(o => o.CreatedAt < cutoffDate)
        .ExecuteDeleteAsync(ct);
}
```

## Query Filters

```csharp
// ✅ Global query filters for soft delete and multi-tenancy
public class ApplicationDbContext : DbContext
{
    private readonly ITenantService _tenantService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ITenantService tenantService)
        : base(options)
    {
        _tenantService = tenantService;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Soft delete filter
        modelBuilder.Entity<Customer>()
            .HasQueryFilter(c => !c.IsDeleted);

        // Multi-tenant filter
        modelBuilder.Entity<Order>()
            .HasQueryFilter(o => o.TenantId == _tenantService.TenantId);

        base.OnModelCreating(modelBuilder);
    }
}

// Bypass filter when needed
public async Task<Customer?> GetCustomerIncludingDeletedAsync(int id, CancellationToken ct)
{
    return await _context.Customers
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(c => c.Id == id, ct);
}
```

## Audit Trail with Interceptors

```csharp
// ✅ Automatic audit fields
public interface IAuditableEntity
{
    DateTime CreatedAt { get; set; }
    string? CreatedBy { get; set; }
    DateTime? UpdatedAt { get; set; }
    string? UpdatedBy { get; set; }
}

public class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentUserService _currentUser;
    private readonly TimeProvider _timeProvider;

    public AuditSaveChangesInterceptor(
        ICurrentUserService currentUser,
        TimeProvider timeProvider)
    {
        _currentUser = currentUser;
        _timeProvider = timeProvider;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is null) return ValueTask.FromResult(result);

        var now = _timeProvider.GetUtcNow().DateTime;
        var userId = _currentUser.UserId;

        foreach (var entry in eventData.Context.ChangeTracker.Entries<IAuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy = userId;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = userId;
                    break;
            }
        }

        return ValueTask.FromResult(result);
    }
}

// Registration
builder.Services.AddScoped<AuditSaveChangesInterceptor>();

builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
});
```

## Migrations Best Practices

```csharp
// ✅ Create migrations with meaningful names
// dotnet ef migrations add AddOrderMetadataJsonColumn

// ✅ Always review generated migrations
// Check for data loss warnings

// ✅ Idempotent migrations for CI/CD
// dotnet ef migrations script --idempotent

// ✅ Custom migration for complex changes
public partial class SplitNameColumn : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Add new columns
        migrationBuilder.AddColumn<string>(
            name: "FirstName",
            table: "Customers",
            type: "nvarchar(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "LastName",
            table: "Customers",
            type: "nvarchar(50)",
            maxLength: 50,
            nullable: true);

        // Migrate data
        migrationBuilder.Sql(@"
            UPDATE Customers
            SET FirstName = LTRIM(RTRIM(SUBSTRING(Name, 1, CHARINDEX(' ', Name + ' ') - 1))),
                LastName = LTRIM(RTRIM(SUBSTRING(Name, CHARINDEX(' ', Name + ' ') + 1, LEN(Name))))
        ");

        // Drop old column (after confirming data migration)
        // migrationBuilder.DropColumn(name: "Name", table: "Customers");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Reverse the migration
        migrationBuilder.DropColumn(name: "FirstName", table: "Customers");
        migrationBuilder.DropColumn(name: "LastName", table: "Customers");
    }
}
```

## Common Anti-patterns to Avoid

```csharp
// ❌ Loading entire entities for display
var customers = await _context.Customers.ToListAsync();

// ✅ Project to DTOs
var customers = await _context.Customers
    .Select(c => new CustomerListDto { Id = c.Id, Name = c.Name })
    .ToListAsync();

// ❌ N+1 queries (lazy loading)
foreach (var order in orders)
{
    var items = order.Items; // Lazy load - 1 query per order
}

// ✅ Eager load
var orders = await _context.Orders
    .Include(o => o.Items)
    .ToListAsync();

// ❌ Using raw SQL without parameters
var customer = await _context.Customers
    .FromSqlRaw($"SELECT * FROM Customers WHERE Email = '{email}'")
    .FirstOrDefaultAsync();

// ✅ Parameterized queries
var customer = await _context.Customers
    .FromSqlInterpolated($"SELECT * FROM Customers WHERE Email = {email}")
    .FirstOrDefaultAsync();

// ❌ Calling ToList() before filtering
var activeCustomers = _context.Customers.ToList().Where(c => c.IsActive);

// ✅ Filter in database
var activeCustomers = await _context.Customers.Where(c => c.IsActive).ToListAsync();
```
