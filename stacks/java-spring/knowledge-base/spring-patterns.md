# Spring Best Practices & Patterns

This document contains proven patterns and best practices for Spring Boot enterprise applications.

## Table of Contents

1. [Application Architecture](#application-architecture)
2. [Service Layer Patterns](#service-layer-patterns)
3. [Data Access Patterns](#data-access-patterns)
4. [REST API Patterns](#rest-api-patterns)
5. [Configuration Patterns](#configuration-patterns)
6. [Testing Patterns](#testing-patterns)
7. [Security Patterns](#security-patterns)
8. [Resilience Patterns](#resilience-patterns)

---

## Application Architecture

### Layered Architecture (Standard)

```
┌──────────────────────────────────────┐
│           Controller Layer            │  @RestController
├──────────────────────────────────────┤
│            Service Layer              │  @Service, @Transactional
├──────────────────────────────────────┤
│          Repository Layer             │  @Repository, JpaRepository
├──────────────────────────────────────┤
│              Domain                   │  @Entity
└──────────────────────────────────────┘
```

**When to use**: Simple CRUD applications, rapid development, small teams.

### Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────┐
│                  Infrastructure                      │
│  ┌─────────────┐              ┌─────────────────┐  │
│  │ Web Adapter │              │ Persistence     │  │
│  │ (Controller)│              │ Adapter (JPA)   │  │
│  └──────┬──────┘              └────────┬────────┘  │
│         │                              │           │
│         │ implements        implements │           │
│         │                              │           │
│  ┌──────▼──────┐              ┌───────▼─────────┐  │
│  │  Input Port │              │  Output Port    │  │
│  │ (UseCase IF)│              │ (Repository IF) │  │
│  └──────┬──────┘              └────────┬────────┘  │
│         │                              │           │
│    ┌────┴──────────────────────────────┴────┐     │
│    │          Application Service            │     │
│    │           (Use Cases)                   │     │
│    └────────────────┬───────────────────────┘     │
│                     │                              │
│              ┌──────▼──────┐                      │
│              │   Domain    │                      │
│              │  (Entities) │                      │
│              └─────────────┘                      │
└─────────────────────────────────────────────────────┘
```

**When to use**: Complex domains, long-lived applications, multiple adapters needed.

---

## Service Layer Patterns

### Transaction Management Pattern

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)  // Default for all methods
public class OrderService {

    private final OrderRepository orderRepository;

    // Read operations use class-level readOnly
    public Optional<Order> findById(Long id) {
        return orderRepository.findById(id);
    }

    // Write operations override with write transaction
    @Transactional
    public Order create(CreateOrderRequest request) {
        // Business logic
        return orderRepository.save(order);
    }

    // Specific isolation level when needed
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void processPayment(Long orderId) {
        // Critical financial operation
    }
}
```

### Domain Event Publishing Pattern

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Order create(CreateOrderRequest request) {
        var order = // create order
        var saved = orderRepository.save(order);

        // Publish event after successful save
        eventPublisher.publishEvent(new OrderCreatedEvent(saved.getId()));

        return saved;
    }
}

// Event listener (runs in same transaction by default)
@Component
public class OrderEventListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleOrderCreated(OrderCreatedEvent event) {
        // Async processing after commit
    }
}
```

### Service Composition Pattern

```java
@Service
@RequiredArgsConstructor
public class OrderFacadeService {

    private final OrderService orderService;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;
    private final NotificationService notificationService;

    @Transactional
    public OrderResult processOrder(OrderRequest request) {
        // Orchestrate multiple services
        var order = orderService.create(request);
        inventoryService.reserve(order.getItems());

        try {
            paymentService.process(order);
        } catch (PaymentException e) {
            inventoryService.release(order.getItems());
            throw e;
        }

        notificationService.sendConfirmation(order);
        return new OrderResult(order);
    }
}
```

---

## Data Access Patterns

### Repository with Specifications

```java
// Specification builder
public class OrderSpecifications {

    public static Specification<Order> hasStatus(OrderStatus status) {
        return (root, query, cb) ->
            status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<Order> createdAfter(Instant date) {
        return (root, query, cb) ->
            date == null ? null : cb.greaterThan(root.get("createdAt"), date);
    }

    public static Specification<Order> withCustomerFetch() {
        return (root, query, cb) -> {
            if (Long.class != query.getResultType()) {
                root.fetch("customer", JoinType.LEFT);
            }
            return null;
        };
    }
}

// Usage
Specification<Order> spec = Specification
    .where(OrderSpecifications.hasStatus(status))
    .and(OrderSpecifications.createdAfter(date))
    .and(OrderSpecifications.withCustomerFetch());

return orderRepository.findAll(spec, pageable);
```

### Projection Pattern

```java
// Interface projection (lightweight, best performance)
public interface OrderSummary {
    Long getId();
    String getOrderNumber();
    OrderStatus getStatus();
    BigDecimal getTotal();
}

// DTO projection (more control)
public record OrderDto(Long id, String orderNumber, String customerName) {}

@Query("""
    SELECT new com.example.dto.OrderDto(o.id, o.orderNumber, c.name)
    FROM Order o JOIN o.customer c
    WHERE o.status = :status
    """)
List<OrderDto> findDtosByStatus(OrderStatus status);
```

### N+1 Prevention Pattern

```java
// Always use fetch joins for associations you'll access
@Query("SELECT o FROM Order o JOIN FETCH o.customer WHERE o.id = :id")
Optional<Order> findByIdWithCustomer(Long id);

// For collections, use EntityGraph
@EntityGraph(attributePaths = {"items", "items.product"})
List<Order> findByStatus(OrderStatus status);

// For batch loading
@BatchSize(size = 25)
@OneToMany(mappedBy = "order")
private List<OrderItem> items;
```

---

## REST API Patterns

### Consistent Response Pattern

```java
// Use Problem Details (RFC 7807) for errors
@ExceptionHandler(OrderNotFoundException.class)
public ProblemDetail handleNotFound(OrderNotFoundException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.NOT_FOUND,
        ex.getMessage()
    );
    problem.setTitle("Order Not Found");
    problem.setType(URI.create("/errors/order-not-found"));
    problem.setProperty("orderId", ex.getOrderId());
    return problem;
}

// Consistent success responses
@GetMapping("/{id}")
public ResponseEntity<OrderDto> getOrder(@PathVariable Long id) {
    return orderService.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}
```

### Pagination Pattern

```java
@GetMapping
public Page<OrderDto> getOrders(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "createdAt,desc") String sort) {

    var pageable = PageRequest.of(page, size, parseSort(sort));
    return orderService.findAll(pageable);
}

// Link headers for HATEOAS
@GetMapping
public ResponseEntity<List<OrderDto>> getOrdersWithLinks(Pageable pageable) {
    var page = orderService.findAll(pageable);

    HttpHeaders headers = new HttpHeaders();
    headers.add("X-Total-Count", String.valueOf(page.getTotalElements()));
    headers.add("X-Total-Pages", String.valueOf(page.getTotalPages()));

    return ResponseEntity.ok()
        .headers(headers)
        .body(page.getContent());
}
```

### Versioning Pattern

```java
// URI versioning (recommended)
@RestController
@RequestMapping("/api/v1/orders")
public class OrderControllerV1 { }

@RestController
@RequestMapping("/api/v2/orders")
public class OrderControllerV2 { }

// Header versioning (alternative)
@GetMapping(headers = "X-API-Version=1")
public OrderV1Response getOrderV1(@PathVariable Long id) { }

@GetMapping(headers = "X-API-Version=2")
public OrderV2Response getOrderV2(@PathVariable Long id) { }
```

---

## Configuration Patterns

### Configuration Properties Pattern

```java
@ConfigurationProperties(prefix = "app.orders")
@Validated
public record OrderProperties(
    @NotNull Duration timeout,
    @Min(1) int maxRetries,
    @Valid RetryConfig retry
) {
    public record RetryConfig(
        Duration initialDelay,
        Duration maxDelay,
        double multiplier
    ) {
        public RetryConfig {
            if (initialDelay == null) initialDelay = Duration.ofMillis(100);
            if (maxDelay == null) maxDelay = Duration.ofSeconds(5);
            if (multiplier <= 0) multiplier = 2.0;
        }
    }
}
```

### Profile-based Configuration

```yaml
# application.yml (common)
spring:
  application:
    name: order-service

---
# application-local.yml
spring:
  config:
    activate:
      on-profile: local
  datasource:
    url: jdbc:h2:mem:testdb

---
# application-prod.yml
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: jdbc:postgresql://${DB_HOST}:5432/orders
```

---

## Testing Patterns

### Test Slices Pattern

```java
// Web layer only
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean OrderService orderService;
}

// JPA layer only
@DataJpaTest
class OrderRepositoryTest {
    @Autowired TestEntityManager entityManager;
    @Autowired OrderRepository repository;
}

// Full integration
@SpringBootTest
@Testcontainers
class OrderServiceIntegrationTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");
}
```

### Test Data Factory Pattern

```java
public final class TestDataFactory {

    public static Order.OrderBuilder order() {
        return Order.builder()
            .orderNumber("ORD-" + System.nanoTime())
            .status(OrderStatus.CREATED)
            .total(BigDecimal.valueOf(100));
    }

    public static CreateOrderRequest createOrderRequest() {
        return new CreateOrderRequest(1L, List.of(orderItem()));
    }

    public static OrderItemRequest orderItem() {
        return new OrderItemRequest(1L, 2, BigDecimal.TEN);
    }
}
```

---

## Security Patterns

### Method Security Pattern

```java
@PreAuthorize("hasRole('ADMIN')")
public void adminOperation() { }

@PreAuthorize("@orderSecurity.canAccess(#orderId, authentication)")
public Order getOrder(Long orderId) { }

@PostAuthorize("returnObject.ownerId == authentication.principal.id")
public Resource getResource(Long id) { }

@PostFilter("filterObject.ownerId == authentication.principal.id")
public List<Resource> getAllResources() { }
```

### Security Service Pattern

```java
@Component
public class OrderSecurityService {

    public boolean canAccess(Long orderId, Authentication auth) {
        if (hasRole(auth, "ADMIN")) return true;
        return orderRepository.existsByIdAndOwnerId(orderId, getUserId(auth));
    }

    public boolean canModify(Order order, Authentication auth) {
        if (hasRole(auth, "ADMIN")) return true;
        return order.getOwnerId().equals(getUserId(auth)) && order.canBeModified();
    }
}
```

---

## Resilience Patterns

### Circuit Breaker Pattern

```java
@Service
public class ExternalServiceClient {

    @CircuitBreaker(name = "externalService", fallbackMethod = "fallback")
    @Retry(name = "externalService")
    @TimeLimiter(name = "externalService")
    public CompletableFuture<Response> call(Request request) {
        return CompletableFuture.supplyAsync(() -> restClient.post()...);
    }

    private CompletableFuture<Response> fallback(Request request, Throwable t) {
        return CompletableFuture.completedFuture(Response.degraded());
    }
}
```

### Retry Pattern

```yaml
resilience4j:
  retry:
    instances:
      externalService:
        maxAttempts: 3
        waitDuration: 500ms
        exponentialBackoffMultiplier: 2
        retryExceptions:
          - java.io.IOException
          - java.net.SocketTimeoutException
```

---

## Summary Checklist

- [ ] Use constructor injection with `@RequiredArgsConstructor`
- [ ] Set class-level `@Transactional(readOnly = true)`
- [ ] Override with `@Transactional` for writes
- [ ] Use LAZY fetch for all associations
- [ ] Use projections for read-only queries
- [ ] Implement proper pagination
- [ ] Use Problem Details for errors
- [ ] Apply method-level security
- [ ] Use circuit breakers for external calls
- [ ] Test with appropriate slices
