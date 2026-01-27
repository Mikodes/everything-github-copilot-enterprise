---
applyTo: "**/*.{java,cs,ts,js,spec.*,test.*}"
excludeAgent: ""
---

# Testing Standards

These standards define how we write and maintain tests. Good tests give us confidence to refactor, catch regressions early, and serve as living documentation.

## Testing Philosophy

1. **Test Behavior, Not Implementation**: Tests should verify what code does, not how it does it
2. **Tests Are Documentation**: A well-named test explains the expected behavior
3. **Fast Feedback**: Tests should run quickly to encourage frequent execution
4. **Reliable Results**: Tests must be deterministic - no flaky tests
5. **Maintainable**: Tests should be easy to understand and modify

## Test Pyramid

```
         /\
        /  \         E2E Tests (Few)
       /----\        UI, full system
      /      \
     /--------\      Integration Tests (Some)
    /          \     API, database, services
   /------------\
  /              \   Unit Tests (Many)
 /----------------\  Business logic, utilities
```

### Coverage Targets

| Test Type | Coverage Target | Purpose |
|-----------|----------------|---------|
| Unit Tests | 80%+ | Business logic, utilities |
| Integration Tests | Critical paths | API endpoints, database |
| E2E Tests | Happy paths | User journeys |

## Test Structure

### AAA Pattern (Arrange-Act-Assert)

```java
@Test
void shouldCalculateDiscountedPrice() {
    // Arrange
    Product product = new Product("Widget", new BigDecimal("100.00"));
    DiscountService discountService = new DiscountService();

    // Act
    BigDecimal discountedPrice = discountService.applyDiscount(product, 10);

    // Assert
    assertThat(discountedPrice).isEqualTo(new BigDecimal("90.00"));
}
```

### Given-When-Then (BDD Style)

```java
@Test
void givenValidOrder_whenProcessing_thenStatusIsCompleted() {
    // Given
    Order order = OrderBuilder.validOrder().build();

    // When
    orderService.process(order);

    // Then
    assertThat(order.getStatus()).isEqualTo(OrderStatus.COMPLETED);
}
```

## Naming Conventions

### Test Class Names

```
{ClassUnderTest}Test
{ClassUnderTest}IntegrationTest
{Feature}E2ETest

Examples:
OrderServiceTest
OrderApiIntegrationTest
CheckoutE2ETest
```

### Test Method Names

```
should{ExpectedBehavior}[When{Condition}]

Examples:
shouldCalculateTotal()
shouldThrowExceptionWhenQuantityIsNegative()
shouldReturnEmptyListWhenNoOrdersFound()
```

### Alternative Format (BDD)

```
given{Precondition}_when{Action}_then{ExpectedResult}

Examples:
givenValidUser_whenLogin_thenReturnsToken()
givenExpiredToken_whenAccessResource_thenReturns401()
```

## Unit Tests

### What to Test

✅ Business logic and calculations
✅ Validation rules
✅ State transitions
✅ Edge cases and boundary conditions
✅ Error handling paths
✅ Different code branches

### What NOT to Test

❌ Getters and setters (unless they have logic)
❌ Framework code
❌ Third-party libraries
❌ Private methods directly
❌ Configuration classes

### Mocking Guidelines

```java
// ✅ Mock external dependencies
@Mock
private PaymentGateway paymentGateway;

@Mock
private EmailService emailService;

// ❌ Don't mock the class under test
// ❌ Don't mock value objects
// ❌ Don't mock everything - only external dependencies
```

### Test Isolation

```java
@BeforeEach
void setUp() {
    // Reset state before each test
    orderService = new OrderService(orderRepository, paymentGateway);
}
```

## Integration Tests

### Database Tests

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@Testcontainers
class OrderRepositoryIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");

    @Test
    void shouldFindOrdersByCustomerId() {
        // Test actual database queries
    }
}
```

### API Tests

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class OrderApiIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void shouldCreateOrder() {
        // Given
        OrderRequest request = new OrderRequest(/*...*/);

        // When
        ResponseEntity<OrderResponse> response = restTemplate.postForEntity(
            "/api/orders", request, OrderResponse.class);

        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }
}
```

### Test Containers

```java
// Use Testcontainers for external dependencies
@Container
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");

@Container
static GenericContainer<?> redis = new GenericContainer<>("redis:7")
    .withExposedPorts(6379);
```

## Test Data

### Test Builders

```java
public class OrderBuilder {
    private String customerId = "default-customer";
    private List<OrderItem> items = new ArrayList<>();
    private OrderStatus status = OrderStatus.PENDING;

    public static OrderBuilder anOrder() {
        return new OrderBuilder();
    }

    public OrderBuilder withCustomerId(String customerId) {
        this.customerId = customerId;
        return this;
    }

    public OrderBuilder withItem(String productId, int quantity) {
        items.add(new OrderItem(productId, quantity));
        return this;
    }

    public Order build() {
        return new Order(customerId, items, status);
    }
}

// Usage
Order order = OrderBuilder.anOrder()
    .withCustomerId("customer-123")
    .withItem("product-1", 2)
    .build();
```

### Test Fixtures

```java
class TestFixtures {
    public static Order validOrder() {
        return OrderBuilder.anOrder()
            .withCustomerId("customer-123")
            .withItem("product-1", 1)
            .build();
    }

    public static Order orderWithMultipleItems() {
        return OrderBuilder.anOrder()
            .withItem("product-1", 2)
            .withItem("product-2", 3)
            .build();
    }
}
```

## Assertions

### Use Fluent Assertions

```java
// ✅ Prefer AssertJ
assertThat(result).isNotNull();
assertThat(result.getItems()).hasSize(3);
assertThat(result.getTotal()).isEqualTo(new BigDecimal("150.00"));

// ❌ Avoid basic assertions
assertNotNull(result);
assertEquals(3, result.getItems().size());
```

### Assert One Concept Per Test

```java
// ✅ Focused test
@Test
void shouldCalculateTotalCorrectly() {
    Order order = createOrderWithItems();
    assertThat(order.calculateTotal()).isEqualTo(expected);
}

// ❌ Testing too many things
@Test
void shouldProcessOrder() {
    Order order = createOrder();
    orderService.process(order);
    assertThat(order.getStatus()).isEqualTo(COMPLETED);
    assertThat(order.getProcessedAt()).isNotNull();
    assertThat(emailService.wasCalled()).isTrue();
    assertThat(inventory.wasUpdated()).isTrue();
    // Too many concerns in one test
}
```

## Test Categories

### Tagging Tests

```java
@Tag("unit")
class OrderServiceTest { }

@Tag("integration")
class OrderApiIntegrationTest { }

@Tag("slow")
class PerformanceTest { }
```

### Running Test Categories

```bash
# Run only unit tests
./mvnw test -Dgroups=unit

# Exclude slow tests
./mvnw test -DexcludedGroups=slow
```

## Common Pitfalls

### Flaky Tests

```java
// ❌ Time-dependent test
@Test
void shouldExpireAfterOneHour() {
    Token token = tokenService.create();
    Thread.sleep(3600000); // Don't do this!
    assertThat(token.isExpired()).isTrue();
}

// ✅ Use time abstraction
@Test
void shouldExpireAfterOneHour() {
    Clock fixedClock = Clock.fixed(Instant.now(), ZoneId.systemDefault());
    Token token = tokenService.create(fixedClock);

    Clock futureTime = Clock.fixed(
        Instant.now().plus(Duration.ofHours(2)),
        ZoneId.systemDefault());

    assertThat(token.isExpired(futureTime)).isTrue();
}
```

### Test Pollution

```java
// ❌ Shared mutable state
static List<Order> testOrders = new ArrayList<>();

// ✅ Fresh state per test
@BeforeEach
void setUp() {
    testOrders = new ArrayList<>();
}
```

## CI Integration

### Test Execution

```yaml
# Run tests in CI
- name: Run Tests
  run: |
    ./mvnw test
    ./mvnw verify -DskipUnitTests  # Integration tests
```

### Coverage Reports

```yaml
- name: Generate Coverage Report
  run: ./mvnw jacoco:report

- name: Check Coverage Threshold
  run: ./mvnw jacoco:check
```

## Memory Bank Integration

- Document testing strategies in module contexts
- Record testing decisions in ADRs
- Share testing patterns in knowledge base
- Update troubleshooting guides with test debugging tips
