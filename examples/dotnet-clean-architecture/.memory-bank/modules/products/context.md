# Products Module Context

## Overview

The Products module manages the product catalog including product information, categories, pricing, and availability.

## Domain Model

### Product (Aggregate Root)

```csharp
public class Product : Entity<int>, IAggregateRoot
{
    public string Sku { get; private set; }
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public int CategoryId { get; private set; }
    public Money Price { get; private set; }
    public Money? CompareAtPrice { get; private set; }
    public int StockQuantity { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
}
```

### Category (Entity)

```csharp
public class Category : Entity<int>
{
    public string Name { get; private set; }
    public string Slug { get; private set; }
    public int? ParentCategoryId { get; private set; }
    public bool IsActive { get; private set; }
    public IReadOnlyCollection<Product> Products { get; }
}
```

### Money (Value Object)

```csharp
public sealed class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/products | List products (paginated) |
| GET | /api/v1/products/{id} | Get product by ID |
| GET | /api/v1/products/sku/{sku} | Get product by SKU |
| POST | /api/v1/products | Create product |
| PUT | /api/v1/products/{id} | Update product |
| DELETE | /api/v1/products/{id} | Delete product (soft) |
| PATCH | /api/v1/products/{id}/price | Update price |
| PATCH | /api/v1/products/{id}/stock | Update stock |
| GET | /api/v1/categories | List categories |
| GET | /api/v1/categories/{id}/products | Products in category |

## Commands & Queries

### Commands

```csharp
// Create Product
public record CreateProductCommand(
    string Sku,
    string Name,
    string? Description,
    int CategoryId,
    decimal Price,
    string Currency,
    int InitialStock) : IRequest<Result<int>>;

// Update Product
public record UpdateProductCommand(
    int ProductId,
    string Name,
    string? Description,
    int CategoryId) : IRequest<Result>;

// Update Price
public record UpdateProductPriceCommand(
    int ProductId,
    decimal NewPrice,
    decimal? CompareAtPrice) : IRequest<Result>;

// Adjust Stock
public record AdjustStockCommand(
    int ProductId,
    int Adjustment,
    string Reason) : IRequest<Result>;

// Activate/Deactivate
public record SetProductActiveCommand(
    int ProductId,
    bool IsActive) : IRequest<Result>;
```

### Queries

```csharp
// Get Product
public record GetProductByIdQuery(int Id) : IRequest<Result<ProductResponse>>;

// Get by SKU
public record GetProductBySkuQuery(string Sku) : IRequest<Result<ProductResponse>>;

// Search Products
public record SearchProductsQuery(
    string? SearchTerm,
    int? CategoryId,
    decimal? MinPrice,
    decimal? MaxPrice,
    bool? InStockOnly,
    string? SortBy,
    bool Descending,
    int Page = 1,
    int PageSize = 20) : IRequest<Result<PagedResult<ProductListItem>>>;

// Get Categories
public record GetCategoriesQuery() : IRequest<Result<List<CategoryResponse>>>;
```

## Domain Events

```csharp
public record ProductCreatedEvent(Product Product) : DomainEvent;
public record ProductPriceChangedEvent(Product Product, Money OldPrice) : DomainEvent;
public record ProductStockChangedEvent(Product Product, int OldQuantity, string Reason) : DomainEvent;
public record ProductDeactivatedEvent(Product Product) : DomainEvent;
public record LowStockAlertEvent(Product Product) : DomainEvent;
```

## Business Rules

### Product Creation
- SKU must be unique
- Name is required (max 200 chars)
- Price must be positive
- Category must exist and be active
- Initial stock cannot be negative

### Price Updates
- Price must be positive
- CompareAtPrice (if set) must be > Price
- Price changes logged for audit

### Stock Management
- Stock cannot go negative
- Low stock alert when stock < 10
- Stock adjustments require reason

## Validation Rules

### CreateProductCommand

```csharp
public class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.Sku)
            .NotEmpty()
            .MaximumLength(50)
            .Matches("^[A-Z0-9-]+$");

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Price)
            .GreaterThan(0);

        RuleFor(x => x.CategoryId)
            .GreaterThan(0);

        RuleFor(x => x.InitialStock)
            .GreaterThanOrEqualTo(0);
    }
}
```

## Caching Strategy

| Data | Cache Duration | Invalidation |
|------|---------------|--------------|
| Product list | 5 minutes | On any product change |
| Product detail | 10 minutes | On specific product change |
| Categories | 1 hour | On category change |
| Search results | 1 minute | Time-based only |

## Search Considerations

- Full-text search on Name, Description
- Filter by category (include subcategories)
- Filter by price range
- Filter by availability
- Sort by: name, price, created date, popularity

## Related Modules

- **Orders**: Products referenced in order items
- **Inventory**: Stock levels, reservations
- **Pricing**: Price rules, discounts (future)
- **Reviews**: Customer reviews (future)
