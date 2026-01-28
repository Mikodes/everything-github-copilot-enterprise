# Orders Module Context

## Overview

The Orders module handles all order-related functionality including order creation, management, and fulfillment.

## Domain Model

### Order (Aggregate Root)

```csharp
public class Order : Entity<int>, IAggregateRoot
{
    public string OrderNumber { get; private set; }
    public int CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }
    public Money Total { get; private set; }
    public Address ShippingAddress { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ShippedAt { get; private set; }
    public IReadOnlyCollection<OrderItem> Items { get; }
}
```

### OrderItem (Entity)

```csharp
public class OrderItem : Entity<int>
{
    public int OrderId { get; private set; }
    public int ProductId { get; private set; }
    public int Quantity { get; private set; }
    public Money UnitPrice { get; private set; }
    public Money LineTotal { get; }
}
```

### OrderStatus (Enum)

```csharp
public enum OrderStatus
{
    Draft,
    Pending,
    Confirmed,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}
```

## State Transitions

```
Draft → Pending → Confirmed → Processing → Shipped → Delivered
  │        │          │           │
  └────────┴──────────┴───────────┴──→ Cancelled
```

**Business Rules:**
- Only Draft orders can have items added/removed
- Only Pending orders can be confirmed
- Only Confirmed orders can be processed
- Only Processing orders can be shipped
- Cancelled orders cannot be modified

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/orders | List orders (paginated) |
| GET | /api/v1/orders/{id} | Get order by ID |
| POST | /api/v1/orders | Create new order |
| PUT | /api/v1/orders/{id} | Update order |
| DELETE | /api/v1/orders/{id} | Delete order (soft) |
| POST | /api/v1/orders/{id}/confirm | Confirm order |
| POST | /api/v1/orders/{id}/ship | Mark as shipped |
| POST | /api/v1/orders/{id}/cancel | Cancel order |
| GET | /api/v1/orders/{id}/items | Get order items |
| POST | /api/v1/orders/{id}/items | Add item to order |

## Commands & Queries

### Commands

```csharp
// Create Order
public record CreateOrderCommand(
    int CustomerId,
    List<OrderItemDto> Items,
    AddressDto ShippingAddress) : IRequest<Result<int>>;

// Update Order
public record UpdateOrderCommand(
    int OrderId,
    AddressDto ShippingAddress) : IRequest<Result>;

// Add Item
public record AddOrderItemCommand(
    int OrderId,
    int ProductId,
    int Quantity) : IRequest<Result>;

// Confirm Order
public record ConfirmOrderCommand(int OrderId) : IRequest<Result>;

// Ship Order
public record ShipOrderCommand(int OrderId) : IRequest<Result>;

// Cancel Order
public record CancelOrderCommand(int OrderId, string Reason) : IRequest<Result>;
```

### Queries

```csharp
// Get Order
public record GetOrderByIdQuery(int Id) : IRequest<Result<OrderResponse>>;

// List Orders
public record GetOrdersQuery(
    int? CustomerId,
    OrderStatus? Status,
    DateTime? FromDate,
    DateTime? ToDate,
    int Page = 1,
    int PageSize = 20) : IRequest<Result<PagedResult<OrderListItem>>>;

// Get Order Items
public record GetOrderItemsQuery(int OrderId) : IRequest<Result<List<OrderItemResponse>>>;
```

## Domain Events

```csharp
public record OrderCreatedEvent(Order Order) : DomainEvent;
public record OrderConfirmedEvent(Order Order) : DomainEvent;
public record OrderShippedEvent(Order Order) : DomainEvent;
public record OrderDeliveredEvent(Order Order) : DomainEvent;
public record OrderCancelledEvent(Order Order, string Reason) : DomainEvent;
```

## Event Handlers

| Event | Handler | Action |
|-------|---------|--------|
| OrderCreated | SendOrderConfirmationEmail | Send email to customer |
| OrderCreated | ReserveInventory | Reserve products in inventory |
| OrderConfirmed | ProcessPayment | Initiate payment processing |
| OrderShipped | SendShippingNotification | Send shipping email |
| OrderCancelled | ReleaseInventory | Release reserved inventory |

## Validation Rules

### CreateOrderCommand

- CustomerId must be valid (exists, active)
- Items cannot be empty
- Each item quantity must be > 0
- Each item product must exist and be available
- ShippingAddress must be complete

### ConfirmOrderCommand

- Order must exist
- Order must be in Pending status
- Order must have items
- Customer must have valid payment method

## Performance Considerations

- Orders list is heavily queried - use projection
- Order details include items - eager load
- Order history can be large - paginate
- Consider read replica for reports

## Related Modules

- **Customers**: Customer information, payment methods
- **Products**: Product availability, pricing
- **Inventory**: Stock reservation
- **Payments**: Payment processing
- **Notifications**: Email/SMS notifications
