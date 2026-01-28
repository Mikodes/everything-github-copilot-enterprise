# Spring Anti-Patterns to Avoid

This document catalogs common mistakes and anti-patterns in Spring Boot applications with corrected examples.

## Table of Contents

1. [Dependency Injection Anti-Patterns](#dependency-injection-anti-patterns)
2. [Transaction Anti-Patterns](#transaction-anti-patterns)
3. [JPA/Hibernate Anti-Patterns](#jpahibernate-anti-patterns)
4. [REST API Anti-Patterns](#rest-api-anti-patterns)
5. [Security Anti-Patterns](#security-anti-patterns)
6. [Configuration Anti-Patterns](#configuration-anti-patterns)
7. [Testing Anti-Patterns](#testing-anti-patterns)
8. [Performance Anti-Patterns](#performance-anti-patterns)

---

## Dependency Injection Anti-Patterns

### ❌ Field Injection

```java
// BAD: Field injection - difficult to test, hides dependencies
@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private CustomerService customerService;
}
```

### ✅ Constructor Injection

```java
// GOOD: Constructor injection - explicit dependencies, testable
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final CustomerService customerService;
}
```

### ❌ Circular Dependencies

```java
// BAD: ServiceA depends on ServiceB, and ServiceB depends on ServiceA
@Service
public class ServiceA {
    private final ServiceB serviceB;  // ServiceB needs ServiceA
}
```

### ✅ Break Circular Dependencies

```java
// GOOD: Use events, introduce a third service, or redesign
@Service
public class OrderService {
    private final ApplicationEventPublisher events;

    public void createOrder() {
        // Instead of calling InventoryService directly
        events.publishEvent(new OrderCreatedEvent(order.getId()));
    }
}

@Component
public class InventoryEventHandler {
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        // Handle inventory reservation
    }
}
```

---

## Transaction Anti-Patterns

### ❌ Missing @Transactional on Write Operations

```java
// BAD: No transaction - data inconsistency risk
@Service
public class OrderService {

    public Order create(CreateOrderRequest request) {
        var order = mapper.toEntity(request);
        orderRepository.save(order);  // No transaction!
        inventoryService.reserve(order.getItems());  // If this fails, order still saved
        return order;
    }
}
```

### ✅ Proper Transaction Management

```java
// GOOD: Explicit transaction with proper scope
@Service
@Transactional(readOnly = true)
public class OrderService {

    @Transactional  // Overrides to read-write
    public Order create(CreateOrderRequest request) {
        var order = mapper.toEntity(request);
        orderRepository.save(order);
        inventoryService.reserve(order.getItems());  // Same transaction
        return order;
    }
}
```

### ❌ Transaction on Private Methods

```java
// BAD: @Transactional on private method - doesn't work!
@Service
public class OrderService {

    public void processOrder(Long orderId) {
        updateStatus(orderId);  // Transaction not applied!
    }

    @Transactional  // IGNORED - private method, no proxy
    private void updateStatus(Long orderId) {
        // ...
    }
}
```

### ✅ Transaction on Public Methods or Self-Injection

```java
// GOOD: Keep transactions on public methods
@Service
@RequiredArgsConstructor
public class OrderService {

    @Transactional
    public void processOrder(Long orderId) {
        updateStatus(orderId);  // Part of the same transaction
    }

    private void updateStatus(Long orderId) {
        // Called within transaction context
    }
}
```

### ❌ Long Transactions

```java
// BAD: Transaction holds for entire slow operation
@Transactional
public void processAllOrders() {
    var orders = orderRepository.findAll();
    for (Order order : orders) {
        externalService.process(order);  // Slow HTTP call!
        order.setStatus(PROCESSED);
    }
}
```

### ✅ Minimal Transaction Scope

```java
// GOOD: Keep transactions short
public void processAllOrders() {
    var orders = orderRepository.findAll();

    for (Order order : orders) {
        externalService.process(order);  // Outside transaction
        updateOrderStatus(order.getId(), PROCESSED);  // Short transaction
    }
}

@Transactional
public void updateOrderStatus(Long orderId, OrderStatus status) {
    orderRepository.updateStatus(orderId, status);
}
```

---

## JPA/Hibernate Anti-Patterns

### ❌ EAGER Fetching

```java
// BAD: EAGER loading causes unnecessary queries
@Entity
public class Order {

    @OneToMany(fetch = FetchType.EAGER)  // BAD!
    private List<OrderItem> items;

    @ManyToOne(fetch = FetchType.EAGER)  // BAD!
    private Customer customer;
}
```

### ✅ LAZY Fetching with Explicit Fetch Joins

```java
// GOOD: LAZY by default, fetch when needed
@Entity
public class Order {

    @OneToMany(fetch = FetchType.LAZY, mappedBy = "order")
    private List<OrderItem> items;

    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;
}

// Fetch only when needed
@Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
Optional<Order> findByIdWithItems(Long id);
```

### ❌ N+1 Query Problem

```java
// BAD: N+1 queries - 1 for orders + N for customers
public List<OrderDto> getOrdersWithCustomers() {
    var orders = orderRepository.findAll();
    return orders.stream()
        .map(o -> new OrderDto(o.getId(), o.getCustomer().getName()))  // N queries!
        .toList();
}
```

### ✅ Fetch Join or Projection

```java
// GOOD: Single query with fetch join
@Query("SELECT o FROM Order o JOIN FETCH o.customer")
List<Order> findAllWithCustomers();

// BETTER: DTO projection - only fetch needed columns
@Query("""
    SELECT new com.example.OrderDto(o.id, c.name)
    FROM Order o JOIN o.customer c
    """)
List<OrderDto> findAllAsDto();
```

### ❌ Open Session in View (OSIV) in Production

```yaml
# BAD: Enables lazy loading in view layer - hides N+1 problems
spring:
  jpa:
    open-in-view: true  # DEFAULT! Silently causes issues
```

### ✅ Disable OSIV

```yaml
# GOOD: Force proper data fetching in service layer
spring:
  jpa:
    open-in-view: false
```

### ❌ Returning Entities from Controllers

```java
// BAD: Exposes internal model, potential lazy loading issues
@GetMapping("/{id}")
public Order getOrder(@PathVariable Long id) {
    return orderRepository.findById(id).orElseThrow();
}
```

### ✅ Return DTOs

```java
// GOOD: Controlled response, no lazy loading surprises
@GetMapping("/{id}")
public OrderDto getOrder(@PathVariable Long id) {
    return orderService.findById(id)
        .map(orderMapper::toDto)
        .orElseThrow(() -> new OrderNotFoundException(id));
}
```

---

## REST API Anti-Patterns

### ❌ Ignoring HTTP Methods Semantics

```java
// BAD: Using POST for read operations
@PostMapping("/search")
public List<Order> searchOrders(@RequestBody SearchCriteria criteria) {
    return orderService.search(criteria);
}
```

### ✅ Proper HTTP Methods

```java
// GOOD: GET for reads with query parameters
@GetMapping("/search")
public Page<Order> searchOrders(
        @RequestParam String status,
        @RequestParam LocalDate from,
        Pageable pageable) {
    return orderService.search(status, from, pageable);
}
```

### ❌ Inconsistent Error Responses

```java
// BAD: Different error formats for different exceptions
@ExceptionHandler(OrderNotFoundException.class)
public String handleNotFound(OrderNotFoundException e) {
    return e.getMessage();  // Plain text!
}

@ExceptionHandler(ValidationException.class)
public Map<String, String> handleValidation(ValidationException e) {
    return Map.of("error", e.getMessage());  // Different format!
}
```

### ✅ Consistent Error Format (Problem Details)

```java
// GOOD: Consistent RFC 7807 Problem Details format
@ExceptionHandler(OrderNotFoundException.class)
public ProblemDetail handleNotFound(OrderNotFoundException e) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.NOT_FOUND, e.getMessage());
    problem.setTitle("Order Not Found");
    return problem;
}

@ExceptionHandler(ValidationException.class)
public ProblemDetail handleValidation(ValidationException e) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.BAD_REQUEST, "Validation failed");
    problem.setProperty("errors", e.getErrors());
    return problem;
}
```

### ❌ Exposing Stack Traces

```java
// BAD: Stack trace exposed to client
@ExceptionHandler(Exception.class)
public ResponseEntity<String> handleAll(Exception e) {
    e.printStackTrace();
    return ResponseEntity.status(500).body(e.toString());  // Security risk!
}
```

### ✅ Safe Error Handling

```java
// GOOD: Log internally, return safe message
@ExceptionHandler(Exception.class)
public ProblemDetail handleAll(Exception e) {
    log.error("Unexpected error", e);  // Log full details
    return ProblemDetail.forStatusAndDetail(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "An unexpected error occurred"  // Generic message
    );
}
```

---

## Security Anti-Patterns

### ❌ Secrets in Code or Config Files

```java
// BAD: Hardcoded secrets
public class PaymentService {
    private static final String API_KEY = "sk_live_abc123";  // NEVER!
}
```

```yaml
# BAD: Secrets in version control
spring:
  datasource:
    password: MySecretPassword123  # NEVER!
```

### ✅ Environment Variables or Secret Management

```yaml
# GOOD: Environment variables
spring:
  datasource:
    password: ${DB_PASSWORD}
```

```java
// GOOD: Configuration properties
@ConfigurationProperties(prefix = "payment")
public record PaymentProperties(@NotBlank String apiKey) {}
```

### ❌ Wildcard CORS

```java
// BAD: Allows any origin - security risk!
@Bean
public CorsConfigurationSource corsConfig() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("*"));  // DANGEROUS!
    config.setAllowCredentials(true);  // Makes it worse!
    // ...
}
```

### ✅ Explicit CORS Origins

```java
// GOOD: Specific allowed origins
@Bean
public CorsConfigurationSource corsConfig() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(
        "https://app.example.com",
        "https://admin.example.com"
    ));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    // ...
}
```

---

## Configuration Anti-Patterns

### ❌ Magic Strings Throughout Code

```java
// BAD: Hardcoded configuration values
public class OrderService {
    private static final int MAX_RETRIES = 3;
    private static final Duration TIMEOUT = Duration.ofSeconds(30);
}
```

### ✅ Externalized Configuration

```java
// GOOD: Configurable properties
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderProperties properties;

    public void process() {
        // Use properties.timeout(), properties.maxRetries()
    }
}
```

---

## Testing Anti-Patterns

### ❌ Testing Implementation Instead of Behavior

```java
// BAD: Tests internal implementation
@Test
void testCreateOrder() {
    orderService.create(request);

    verify(orderRepository, times(1)).save(any());
    verify(mapper, times(1)).toEntity(any());
    verify(mapper, times(1)).toDto(any());
    // Brittle - breaks if implementation changes
}
```

### ✅ Testing Behavior and Outcomes

```java
// GOOD: Tests expected behavior
@Test
void shouldCreateOrderWithCorrectStatus() {
    var request = new CreateOrderRequest(...);

    var result = orderService.create(request);

    assertThat(result.getStatus()).isEqualTo(OrderStatus.CREATED);
    assertThat(orderRepository.findById(result.getId())).isPresent();
}
```

### ❌ Using @SpringBootTest for Unit Tests

```java
// BAD: Full context for simple service test - slow!
@SpringBootTest
class OrderServiceTest {
    @Autowired OrderService orderService;
    // Starts entire Spring context
}
```

### ✅ Use Appropriate Test Slices

```java
// GOOD: Mock dependencies for unit test
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repository;
    @InjectMocks OrderService service;
}

// GOOD: Use slice for integration
@DataJpaTest
class OrderRepositoryTest { }

@WebMvcTest(OrderController.class)
class OrderControllerTest { }
```

---

## Performance Anti-Patterns

### ❌ Missing Database Indexes

```java
// BAD: Querying without index
@Query("SELECT o FROM Order o WHERE o.status = :status")
List<Order> findByStatus(OrderStatus status);  // Full table scan!
```

### ✅ Proper Indexing

```java
// GOOD: Add index on frequently queried columns
@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_order_status", columnList = "status"),
    @Index(name = "idx_order_customer", columnList = "customer_id"),
    @Index(name = "idx_order_created", columnList = "created_at")
})
public class Order { }
```

### ❌ Loading All Data Without Pagination

```java
// BAD: Loads entire table into memory
@GetMapping
public List<Order> getAllOrders() {
    return orderRepository.findAll();  // Memory explosion!
}
```

### ✅ Always Paginate Large Result Sets

```java
// GOOD: Paginated response
@GetMapping
public Page<OrderDto> getOrders(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    return orderService.findAll(PageRequest.of(page, size));
}
```

---

## Summary: Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| Field injection | Constructor injection |
| EAGER fetching | LAZY + fetch joins |
| N+1 queries | Fetch joins or projections |
| OSIV enabled | Disable, fetch in service |
| Returning entities | Return DTOs |
| Long transactions | Minimize scope |
| Secrets in code | Environment variables |
| Wildcard CORS | Explicit origins |
| Full context tests | Test slices |
| No pagination | Always paginate |
