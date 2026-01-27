# Module Context: Order Service

## Overview

| Field | Value |
|-------|-------|
| **Module Name** | order-service |
| **Type** | Microservice |
| **Owner** | Platform Team |
| **Port** | 8081 |
| **Database** | orders (PostgreSQL) |

## Purpose

The Order Service is responsible for managing the complete order lifecycle in the e-commerce platform. It handles order creation, status management, and coordinates with other services for inventory and notifications.

## Domain Model

### Entities

```
┌─────────────────────────────────────────────────────┐
│                      Order                           │
├─────────────────────────────────────────────────────┤
│ - id: Long                                          │
│ - orderNumber: String (unique)                      │
│ - customerId: Long                                  │
│ - status: OrderStatus                               │
│ - items: List<OrderItem>                            │
│ - total: BigDecimal                                 │
│ - shippingAddress: Address                          │
│ - createdAt: Instant                                │
│ - updatedAt: Instant                                │
├─────────────────────────────────────────────────────┤
│ + create(customerId, items): Order                  │
│ + submit(): void                                    │
│ + cancel(reason): void                              │
│ + markPaid(): void                                  │
│ + markShipped(trackingNumber): void                 │
│ + markDelivered(): void                             │
└─────────────────────────────────────────────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────────────────────────────────┐
│                    OrderItem                         │
├─────────────────────────────────────────────────────┤
│ - id: Long                                          │
│ - productId: Long                                   │
│ - productName: String                               │
│ - quantity: Integer                                 │
│ - unitPrice: BigDecimal                             │
│ - subtotal: BigDecimal                              │
└─────────────────────────────────────────────────────┘
```

### Order Status Flow

```
CREATED ──► SUBMITTED ──► PAID ──► SHIPPED ──► DELIVERED
    │           │          │
    └───────────┴──────────┴───► CANCELLED
```

## API Endpoints

### Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/orders` | Create a new order |
| GET | `/api/v1/orders/{id}` | Get order by ID |
| GET | `/api/v1/orders` | List orders (paginated) |
| PUT | `/api/v1/orders/{id}` | Update order |
| DELETE | `/api/v1/orders/{id}` | Cancel order |
| POST | `/api/v1/orders/{id}/submit` | Submit order for processing |
| POST | `/api/v1/orders/{id}/cancel` | Cancel order with reason |

### Request/Response Examples

**Create Order**
```json
POST /api/v1/orders
{
  "customerId": 123,
  "items": [
    {"productId": 1, "quantity": 2},
    {"productId": 2, "quantity": 1}
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Boston",
    "postalCode": "02101",
    "country": "US"
  }
}

Response: 201 Created
{
  "id": 456,
  "orderNumber": "ORD-2024-000456",
  "status": "CREATED",
  "total": 99.99,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Events

### Published Events

| Event | Topic | Trigger |
|-------|-------|---------|
| `OrderCreatedEvent` | `orders.created` | Order created |
| `OrderSubmittedEvent` | `orders.submitted` | Order submitted |
| `OrderCancelledEvent` | `orders.cancelled` | Order cancelled |
| `OrderPaidEvent` | `orders.paid` | Payment confirmed |
| `OrderShippedEvent` | `orders.shipped` | Order shipped |

### Consumed Events

| Event | Topic | Action |
|-------|-------|--------|
| `PaymentConfirmedEvent` | `payments.confirmed` | Mark order as paid |
| `InventoryReservedEvent` | `inventory.reserved` | Confirm stock reserved |
| `InventoryReleasedEvent` | `inventory.released` | Handle reservation failure |

## Dependencies

### Internal Services

| Service | Purpose | Communication |
|---------|---------|---------------|
| Inventory Service | Stock reservation | REST + Events |
| Notification Service | Order updates | Events |
| Payment Service | Payment processing | Events |

### External Services

| Service | Purpose |
|---------|---------|
| Shipping Provider API | Get shipping rates |

## Database Schema

```sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    total DECIMAL(19,4) NOT NULL,
    shipping_street VARCHAR(100),
    shipping_city VARCHAR(50),
    shipping_postal_code VARCHAR(10),
    shipping_country VARCHAR(2),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT DEFAULT 0
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_id BIGINT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(19,4) NOT NULL,
    subtotal DECIMAL(19,4) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```

## Configuration

```yaml
# application.yml
spring:
  application:
    name: order-service

  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:5432/orders
    username: ${DB_USER}
    password: ${DB_PASSWORD}

  kafka:
    bootstrap-servers: ${KAFKA_SERVERS:localhost:9092}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    consumer:
      group-id: order-service
      auto-offset-reset: earliest

server:
  port: 8081

app:
  orders:
    default-page-size: 20
    max-items-per-order: 50
```

## Key Classes

| Class | Purpose |
|-------|---------|
| `OrderController` | REST API endpoints |
| `OrderService` | Business logic |
| `OrderRepository` | Data access |
| `OrderMapper` | Entity ↔ DTO mapping |
| `OrderEventPublisher` | Event publishing |
| `InventoryClient` | Inventory service integration |

## Testing Strategy

- **Unit Tests**: Service layer with mocked dependencies
- **Integration Tests**: Full stack with Testcontainers
- **Contract Tests**: API contracts with Spring Cloud Contract
- **Coverage Target**: 85%

## Known Issues

1. **Order cancellation race condition**: When payment is being processed simultaneously. Mitigation: Using optimistic locking.

2. **Large order performance**: Orders with 50+ items are slow. TODO: Implement batch processing.

## Recent Changes

| Date | Change | Author |
|------|--------|--------|
| 2024-01-15 | Added order cancellation endpoint | @developer1 |
| 2024-01-10 | Improved inventory integration | @developer2 |
| 2024-01-05 | Added shipping address validation | @developer1 |

---

*Last updated: 2024-01-15*
