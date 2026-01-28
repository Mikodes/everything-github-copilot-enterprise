---
applyTo: "**/*.java"
excludeAgent: ""
---

# Hexagonal Architecture Instructions

These instructions apply when implementing Hexagonal Architecture (Ports & Adapters) in Spring Boot applications.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                          │
│  ┌─────────────────┐                    ┌─────────────────────┐  │
│  │  Web Adapter    │                    │  Persistence Adapter│  │
│  │  (REST API)     │                    │  (JPA Repository)   │  │
│  └────────┬────────┘                    └──────────┬──────────┘  │
│           │                                        │              │
│           │ implements                  implements │              │
│           │                                        │              │
│  ┌────────▼────────┐                    ┌─────────▼──────────┐  │
│  │   Input Port    │                    │   Output Port      │  │
│  │   (Interface)   │                    │   (Interface)      │  │
│  └────────┬────────┘                    └──────────┬─────────┘  │
│           │                                        │              │
│    ┌──────┴────────────────────────────────────────┴──────┐      │
│    │                    APPLICATION LAYER                  │      │
│    │                    (Use Cases/Services)               │      │
│    └──────────────────────────┬───────────────────────────┘      │
│                               │                                   │
│                    ┌──────────▼──────────┐                       │
│                    │     DOMAIN LAYER    │                       │
│                    │  (Entities, Value   │                       │
│                    │   Objects, Domain   │                       │
│                    │   Services)         │                       │
│                    └─────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

## Package Structure

```
com.example.orders/
├── domain/                          # Domain Layer (no Spring dependencies)
│   ├── model/
│   │   ├── Order.java              # Aggregate root
│   │   ├── OrderItem.java          # Entity
│   │   ├── OrderId.java            # Value Object
│   │   ├── Money.java              # Value Object
│   │   └── OrderStatus.java        # Enum
│   ├── event/
│   │   └── OrderCreatedEvent.java  # Domain Event
│   ├── service/
│   │   └── OrderDomainService.java # Domain Service
│   └── exception/
│       └── OrderDomainException.java
│
├── application/                     # Application Layer
│   ├── port/
│   │   ├── in/                     # Input Ports (use cases)
│   │   │   ├── CreateOrderUseCase.java
│   │   │   ├── GetOrderUseCase.java
│   │   │   └── CancelOrderUseCase.java
│   │   └── out/                    # Output Ports (driven)
│   │       ├── OrderRepository.java
│   │       ├── PaymentGateway.java
│   │       └── NotificationSender.java
│   └── service/                    # Use Case implementations
│       ├── CreateOrderService.java
│       ├── GetOrderService.java
│       └── CancelOrderService.java
│
└── infrastructure/                  # Infrastructure Layer
    └── adapter/
        ├── in/                     # Driving Adapters
        │   ├── web/
        │   │   ├── OrderController.java
        │   │   ├── dto/
        │   │   │   ├── CreateOrderRequest.java
        │   │   │   └── OrderResponse.java
        │   │   └── mapper/
        │   │       └── OrderWebMapper.java
        │   └── messaging/
        │       └── OrderMessageListener.java
        └── out/                    # Driven Adapters
            ├── persistence/
            │   ├── OrderJpaRepository.java
            │   ├── OrderPersistenceAdapter.java
            │   ├── entity/
            │   │   └── OrderJpaEntity.java
            │   └── mapper/
            │       └── OrderPersistenceMapper.java
            ├── payment/
            │   └── StripePaymentAdapter.java
            └── notification/
                └── EmailNotificationAdapter.java
```

## Domain Layer

### Aggregate Root
```java
// domain/model/Order.java
public class Order {

    private final OrderId id;
    private final CustomerId customerId;
    private OrderStatus status;
    private final List<OrderItem> items;
    private Money total;
    private final Instant createdAt;
    private Instant updatedAt;

    // Private constructor - use factory methods
    private Order(OrderId id, CustomerId customerId, List<OrderItem> items) {
        this.id = Objects.requireNonNull(id);
        this.customerId = Objects.requireNonNull(customerId);
        this.items = new ArrayList<>(items);
        this.status = OrderStatus.CREATED;
        this.total = calculateTotal();
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    // Factory method
    public static Order create(CustomerId customerId, List<OrderItem> items) {
        if (items == null || items.isEmpty()) {
            throw new OrderDomainException("Order must have at least one item");
        }
        return new Order(OrderId.generate(), customerId, items);
    }

    // Reconstitution from persistence
    public static Order reconstitute(
            OrderId id,
            CustomerId customerId,
            OrderStatus status,
            List<OrderItem> items,
            Money total,
            Instant createdAt,
            Instant updatedAt) {
        var order = new Order(id, customerId, items);
        order.status = status;
        order.total = total;
        order.updatedAt = updatedAt;
        return order;
    }

    // Business methods
    public void addItem(OrderItem item) {
        validateModifiable();
        items.add(item);
        recalculateTotal();
        markUpdated();
    }

    public void submit() {
        if (status != OrderStatus.CREATED) {
            throw new OrderDomainException("Can only submit orders in CREATED status");
        }
        if (items.isEmpty()) {
            throw new OrderDomainException("Cannot submit empty order");
        }
        this.status = OrderStatus.SUBMITTED;
        markUpdated();
    }

    public void cancel(String reason) {
        if (!canCancel()) {
            throw new OrderDomainException("Order cannot be cancelled in status: " + status);
        }
        this.status = OrderStatus.CANCELLED;
        markUpdated();
    }

    public boolean canCancel() {
        return status == OrderStatus.CREATED || status == OrderStatus.SUBMITTED;
    }

    private void validateModifiable() {
        if (status != OrderStatus.CREATED) {
            throw new OrderDomainException("Order cannot be modified in status: " + status);
        }
    }

    private void recalculateTotal() {
        this.total = items.stream()
            .map(OrderItem::getSubtotal)
            .reduce(Money.ZERO, Money::add);
    }

    private Money calculateTotal() {
        return items.stream()
            .map(OrderItem::getSubtotal)
            .reduce(Money.ZERO, Money::add);
    }

    private void markUpdated() {
        this.updatedAt = Instant.now();
    }

    // Getters only - no setters
    public OrderId getId() { return id; }
    public CustomerId getCustomerId() { return customerId; }
    public OrderStatus getStatus() { return status; }
    public List<OrderItem> getItems() { return Collections.unmodifiableList(items); }
    public Money getTotal() { return total; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
```

### Value Object
```java
// domain/model/OrderId.java
public record OrderId(UUID value) {

    public OrderId {
        Objects.requireNonNull(value, "OrderId value cannot be null");
    }

    public static OrderId generate() {
        return new OrderId(UUID.randomUUID());
    }

    public static OrderId of(String value) {
        return new OrderId(UUID.fromString(value));
    }

    @Override
    public String toString() {
        return value.toString();
    }
}

// domain/model/Money.java
public record Money(BigDecimal amount, Currency currency) {

    public static final Money ZERO = new Money(BigDecimal.ZERO, Currency.getInstance("USD"));

    public Money {
        Objects.requireNonNull(amount);
        Objects.requireNonNull(currency);
        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Amount cannot be negative");
        }
    }

    public static Money of(double amount) {
        return new Money(BigDecimal.valueOf(amount), Currency.getInstance("USD"));
    }

    public Money add(Money other) {
        validateSameCurrency(other);
        return new Money(amount.add(other.amount), currency);
    }

    public Money multiply(int quantity) {
        return new Money(amount.multiply(BigDecimal.valueOf(quantity)), currency);
    }

    private void validateSameCurrency(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException("Cannot operate on different currencies");
        }
    }
}
```

## Application Layer

### Input Port (Use Case Interface)
```java
// application/port/in/CreateOrderUseCase.java
public interface CreateOrderUseCase {

    OrderResult execute(CreateOrderCommand command);

    record CreateOrderCommand(
        String customerId,
        List<OrderItemCommand> items
    ) {
        public CreateOrderCommand {
            Objects.requireNonNull(customerId);
            Objects.requireNonNull(items);
            if (items.isEmpty()) {
                throw new IllegalArgumentException("Order must have items");
            }
        }
    }

    record OrderItemCommand(
        String productId,
        int quantity,
        BigDecimal unitPrice
    ) {}

    record OrderResult(
        String orderId,
        String status,
        BigDecimal total
    ) {}
}
```

### Output Port (Repository Interface)
```java
// application/port/out/OrderRepository.java
public interface OrderRepository {

    Order save(Order order);

    Optional<Order> findById(OrderId id);

    List<Order> findByCustomerId(CustomerId customerId);

    void delete(OrderId id);
}
```

### Use Case Implementation
```java
// application/service/CreateOrderService.java
@Service
@RequiredArgsConstructor
@Transactional
public class CreateOrderService implements CreateOrderUseCase {

    private final OrderRepository orderRepository;
    private final ProductPort productPort;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public OrderResult execute(CreateOrderCommand command) {
        // Validate products exist and get current prices
        var items = command.items().stream()
            .map(this::toOrderItem)
            .toList();

        // Create domain object
        var order = Order.create(
            CustomerId.of(command.customerId()),
            items
        );

        // Persist
        var savedOrder = orderRepository.save(order);

        // Publish domain event
        eventPublisher.publishEvent(new OrderCreatedEvent(savedOrder.getId()));

        return new OrderResult(
            savedOrder.getId().toString(),
            savedOrder.getStatus().name(),
            savedOrder.getTotal().amount()
        );
    }

    private OrderItem toOrderItem(OrderItemCommand cmd) {
        var product = productPort.getProduct(ProductId.of(cmd.productId()))
            .orElseThrow(() -> new ProductNotFoundException(cmd.productId()));

        return OrderItem.create(
            product.id(),
            product.name(),
            cmd.quantity(),
            Money.of(cmd.unitPrice().doubleValue())
        );
    }
}
```

## Infrastructure Layer

### Web Adapter (Driving)
```java
// infrastructure/adapter/in/web/OrderController.java
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final CreateOrderUseCase createOrderUseCase;
    private final GetOrderUseCase getOrderUseCase;
    private final OrderWebMapper mapper;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse createOrder(@Valid @RequestBody CreateOrderRequest request) {
        var command = mapper.toCommand(request);
        var result = createOrderUseCase.execute(command);
        return mapper.toResponse(result);
    }

    @GetMapping("/{id}")
    public OrderResponse getOrder(@PathVariable String id) {
        var result = getOrderUseCase.execute(new GetOrderQuery(id));
        return mapper.toResponse(result);
    }
}

// infrastructure/adapter/in/web/dto/CreateOrderRequest.java
public record CreateOrderRequest(
    @NotBlank String customerId,
    @NotEmpty List<OrderItemRequest> items
) {}

// infrastructure/adapter/in/web/mapper/OrderWebMapper.java
@Mapper(componentModel = "spring")
public interface OrderWebMapper {

    CreateOrderCommand toCommand(CreateOrderRequest request);

    OrderResponse toResponse(OrderResult result);
}
```

### Persistence Adapter (Driven)
```java
// infrastructure/adapter/out/persistence/OrderPersistenceAdapter.java
@Repository
@RequiredArgsConstructor
public class OrderPersistenceAdapter implements OrderRepository {

    private final OrderJpaRepository jpaRepository;
    private final OrderPersistenceMapper mapper;

    @Override
    public Order save(Order order) {
        var entity = mapper.toEntity(order);
        var saved = jpaRepository.save(entity);
        return mapper.toDomain(saved);
    }

    @Override
    public Optional<Order> findById(OrderId id) {
        return jpaRepository.findById(id.value())
            .map(mapper::toDomain);
    }

    @Override
    public List<Order> findByCustomerId(CustomerId customerId) {
        return jpaRepository.findByCustomerId(customerId.value()).stream()
            .map(mapper::toDomain)
            .toList();
    }

    @Override
    public void delete(OrderId id) {
        jpaRepository.deleteById(id.value());
    }
}

// infrastructure/adapter/out/persistence/OrderJpaRepository.java
public interface OrderJpaRepository extends JpaRepository<OrderJpaEntity, UUID> {

    List<OrderJpaEntity> findByCustomerId(UUID customerId);
}

// infrastructure/adapter/out/persistence/entity/OrderJpaEntity.java
@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
public class OrderJpaEntity {

    @Id
    private UUID id;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Column(precision = 19, scale = 4)
    private BigDecimal total;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItemJpaEntity> items = new ArrayList<>();

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
```

## Dependency Rules

### Domain Layer Rules
- NO Spring annotations
- NO framework dependencies
- NO infrastructure dependencies
- Only pure Java (or Kotlin)

### Application Layer Rules
- Can depend on Domain
- Defines ports (interfaces)
- Contains business use cases
- Spring annotations only for transactions/events

### Infrastructure Layer Rules
- Implements ports
- Contains framework-specific code
- All external integrations
- Spring annotations, JPA, etc.

## Memory Bank Integration

When using Hexagonal Architecture:

1. **Document boundaries**: Add layer responsibilities to project context
2. **Port catalog**: Maintain list of ports in knowledge base
3. **Adapter patterns**: Document adapter implementations

## What You MUST Do

- Keep domain layer free of framework dependencies
- Define clear input and output ports
- Use dependency injection through ports
- Map between domain and infrastructure models
- Test domain logic in isolation

## What You MUST NOT Do

- Add Spring annotations to domain entities
- Call infrastructure directly from domain
- Skip port interfaces
- Mix layers in same package
- Use JPA entities as domain models
