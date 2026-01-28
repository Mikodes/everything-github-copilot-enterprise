---
name: create-ef-entity
description: Generate an Entity Framework Core entity with proper configuration following DDD and Clean Architecture principles
---

# Create EF Core Entity

Generate an Entity Framework Core entity with proper configuration, relationships, and Fluent API setup.

## Context Required

Before generating, check:
1. `.memory-bank/project/context.md` for data layer patterns
2. `.memory-bank/modules/{module}/context.md` for domain context
3. Existing entities for naming conventions and patterns
4. `.memory-bank/decisions/` for data-related ADRs

## Input

```
Entity Name: {name, e.g., "Order", "Customer"}
Module/Bounded Context: {domain area, e.g., "Sales", "Inventory"}
Properties: {list of properties with types}
Relationships: {related entities and cardinality}
Value Objects: {any embedded value objects}
Auditable: {yes | no}
Soft Delete: {yes | no}
Multi-tenant: {yes | no}
```

## Generation Process

### 1. Analyze Domain Requirements

Determine:
- Is this an Aggregate Root or child entity?
- What invariants must be protected?
- What domain events should be raised?

### 2. Generate Domain Entity

```csharp
using {Namespace}.Domain.Common;
using {Namespace}.Domain.Events;

namespace {Namespace}.Domain.Entities;

/// <summary>
/// {Description of the entity and its role in the domain}
/// </summary>
public class {Entity} : Entity<int>, IAggregateRoot, IAuditable
{
    private readonly List<{ChildEntity}> _{children} = [];
    private readonly List<DomainEvent> _domainEvents = [];

    // Properties - private setters for encapsulation
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public {Status}Status Status { get; private set; }
    public decimal Price { get; private set; }

    // Value Objects
    public Money Total { get; private set; } = Money.Zero;
    public Address? ShippingAddress { get; private set; }

    // Foreign Keys
    public int CustomerId { get; private set; }

    // Navigation Properties
    public Customer Customer { get; private set; } = default!;
    public IReadOnlyCollection<{ChildEntity}> {Children} => _{children}.AsReadOnly();

    // Audit Properties
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    // Soft Delete
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    // Multi-tenant
    public Guid TenantId { get; private set; }

    // Domain Events
    public IReadOnlyCollection<DomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    // Private constructor for EF Core
    private {Entity}() { }

    // Factory method for creation
    public static {Entity} Create(
        Customer customer,
        string name,
        Money price,
        Guid tenantId)
    {
        Guard.Against.Null(customer, nameof(customer));
        Guard.Against.NullOrWhiteSpace(name, nameof(name));
        Guard.Against.Null(price, nameof(price));
        Guard.Against.Default(tenantId, nameof(tenantId));

        var entity = new {Entity}
        {
            CustomerId = customer.Id,
            Customer = customer,
            Name = name,
            Total = price,
            Status = {Status}Status.Draft,
            TenantId = tenantId,
            CreatedAt = DateTime.UtcNow
        };

        entity.AddDomainEvent(new {Entity}CreatedEvent(entity));

        return entity;
    }

    // Domain methods with business logic
    public void UpdateName(string name)
    {
        Guard.Against.NullOrWhiteSpace(name, nameof(name));

        if (Status == {Status}Status.Completed)
            throw new DomainException("Cannot update a completed {entity}");

        Name = name;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Add{Child}({ChildEntity} {child})
    {
        Guard.Against.Null({child}, nameof({child}));

        if (Status != {Status}Status.Draft)
            throw new DomainException("Can only add items to draft {entity}s");

        _{children}.Add({child});
        RecalculateTotal();
    }

    public void Remove{Child}(int {child}Id)
    {
        var {child} = _{children}.FirstOrDefault(i => i.Id == {child}Id);

        if ({child} is null)
            throw new DomainException("{Child} not found");

        _{children}.Remove({child});
        RecalculateTotal();
    }

    public void Submit()
    {
        if (Status != {Status}Status.Draft)
            throw new DomainException("Only draft {entity}s can be submitted");

        if (!_{children}.Any())
            throw new DomainException("{Entity} must have at least one {child}");

        Status = {Status}Status.Submitted;
        AddDomainEvent(new {Entity}SubmittedEvent(this));
    }

    public void MarkAsDeleted()
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        AddDomainEvent(new {Entity}DeletedEvent(this));
    }

    private void RecalculateTotal()
    {
        Total = _{children}.Aggregate(
            Money.Zero,
            (sum, item) => sum + item.LineTotal);
    }

    private void AddDomainEvent(DomainEvent domainEvent)
    {
        _domainEvents.Add(domainEvent);
    }

    public void ClearDomainEvents() => _domainEvents.Clear();
}
```

### 3. Generate Entity Configuration

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace {Namespace}.Infrastructure.Persistence.Configurations;

public class {Entity}Configuration : IEntityTypeConfiguration<{Entity}>
{
    public void Configure(EntityTypeBuilder<{Entity}> builder)
    {
        builder.ToTable("{Entity}s");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(e => e.Description)
            .HasMaxLength(1000);

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        // Value Object Configuration
        builder.OwnsOne(e => e.Total, money =>
        {
            money.Property(m => m.Amount)
                .HasColumnName("TotalAmount")
                .HasPrecision(18, 2);
            money.Property(m => m.Currency)
                .HasColumnName("TotalCurrency")
                .HasMaxLength(3);
        });

        builder.OwnsOne(e => e.ShippingAddress, address =>
        {
            address.Property(a => a.Street).HasMaxLength(200);
            address.Property(a => a.City).HasMaxLength(100);
            address.Property(a => a.PostalCode).HasMaxLength(20);
            address.Property(a => a.Country).HasMaxLength(2);
        });

        // Relationships
        builder.HasOne(e => e.Customer)
            .WithMany(c => c.{Entity}s)
            .HasForeignKey(e => e.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.{Children})
            .WithOne(i => i.{Entity})
            .HasForeignKey(i => i.{Entity}Id)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(e => e.CustomerId);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.TenantId);

        // Composite Index
        builder.HasIndex(e => new { e.TenantId, e.Status, e.CreatedAt });

        // Query Filters
        builder.HasQueryFilter(e => !e.IsDeleted);

        // Ignore domain events (not persisted)
        builder.Ignore(e => e.DomainEvents);
    }
}
```

### 4. Generate Repository Interface

```csharp
namespace {Namespace}.Application.Common.Interfaces;

public interface I{Entity}Repository
{
    Task<{Entity}?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<{Entity}?> GetByIdWithItemsAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<{Entity}>> GetByCustomerIdAsync(int customerId, CancellationToken ct = default);
    Task<PagedResult<{Entity}>> GetPagedAsync(int page, int pageSize, CancellationToken ct = default);
    Task AddAsync({Entity} entity, CancellationToken ct = default);
    void Update({Entity} entity);
    void Remove({Entity} entity);
}
```

### 5. Generate Domain Events

```csharp
namespace {Namespace}.Domain.Events;

public sealed record {Entity}CreatedEvent({Entity} {Entity}) : DomainEvent;
public sealed record {Entity}SubmittedEvent({Entity} {Entity}) : DomainEvent;
public sealed record {Entity}DeletedEvent({Entity} {Entity}) : DomainEvent;
```

## Output Checklist

- [ ] Entity follows DDD principles (encapsulation, invariants)
- [ ] Factory method for creation
- [ ] Private setters with domain methods
- [ ] Value objects for complex types
- [ ] Domain events for state changes
- [ ] Fluent API configuration (no data annotations)
- [ ] Proper indexes defined
- [ ] Query filters for soft delete/multi-tenancy
- [ ] Audit fields if required
- [ ] Repository interface generated

## Memory Bank Updates

After generation, suggest updating:
- `.memory-bank/modules/{module}/context.md` - Entity documentation
- `.memory-bank/knowledge/dotnet-patterns.md` - If new patterns
- `.memory-bank/decisions/` - If significant design decisions
