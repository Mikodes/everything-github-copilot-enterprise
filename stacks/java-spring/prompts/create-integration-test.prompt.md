---
name: create-integration-test
description: Generate integration tests using Testcontainers, MockMvc, and Spring Boot Test
---

# Create Integration Test

Generate comprehensive integration tests for Spring Boot applications using Testcontainers and Spring Boot Test.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Check existing test patterns in the codebase
3. Identify dependencies (database, Kafka, Redis, etc.)

## Input

```
Test Target: {Controller | Service | Repository | Full Stack}
Class Under Test: {the class to test}
Dependencies: {database type, message broker, cache, external services}
Scenarios: {list of scenarios to test}
Security: {true/false - include authenticated tests}
```

## Generation Process

### 1. Controller Integration Test

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("OrderController Integration Tests")
class OrderControllerIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager entityManager;

    @BeforeEach
    void setUp() {
        orderRepository.deleteAll();
    }

    @Nested
    @DisplayName("POST /api/orders")
    class CreateOrder {

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("should create order with valid request")
        void shouldCreateOrderWithValidRequest() throws Exception {
            // Arrange
            var customer = createAndSaveCustomer();
            var request = new CreateOrderRequest(
                customer.getId(),
                List.of(new OrderItemRequest(1L, 2, BigDecimal.TEN))
            );

            // Act & Assert
            mockMvc.perform(post("/api/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.customerId").value(customer.getId()));

            // Verify database state
            var orders = orderRepository.findAll();
            assertThat(orders).hasSize(1);
            assertThat(orders.get(0).getStatus()).isEqualTo(OrderStatus.CREATED);
        }

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("should return 400 for invalid request")
        void shouldReturn400ForInvalidRequest() throws Exception {
            var request = new CreateOrderRequest(null, List.of());

            mockMvc.perform(post("/api/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isNotEmpty());
        }

        @Test
        @WithAnonymousUser
        @DisplayName("should return 401 when not authenticated")
        void shouldReturn401WhenNotAuthenticated() throws Exception {
            var request = new CreateOrderRequest(1L, List.of(item()));

            mockMvc.perform(post("/api/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("GET /api/orders/{id}")
    class GetOrder {

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("should return order when exists")
        void shouldReturnOrderWhenExists() throws Exception {
            var order = createAndSaveOrder();

            mockMvc.perform(get("/api/orders/{id}", order.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(order.getId()))
                .andExpect(jsonPath("$.orderNumber").value(order.getOrderNumber()));
        }

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("should return 404 when not found")
        void shouldReturn404WhenNotFound() throws Exception {
            mockMvc.perform(get("/api/orders/{id}", 999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Not Found"));
        }
    }

    @Nested
    @DisplayName("GET /api/orders")
    class GetAllOrders {

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("should return paginated orders")
        void shouldReturnPaginatedOrders() throws Exception {
            // Create test data
            for (int i = 0; i < 25; i++) {
                createAndSaveOrder();
            }

            mockMvc.perform(get("/api/orders")
                    .param("page", "0")
                    .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.totalElements").value(25))
                .andExpect(jsonPath("$.totalPages").value(3));
        }
    }

    // Helper methods
    private Customer createAndSaveCustomer() {
        var customer = Customer.builder()
            .name("Test Customer")
            .email("test@example.com")
            .build();
        return entityManager.persist(customer);
    }

    private Order createAndSaveOrder() {
        var customer = createAndSaveCustomer();
        var order = Order.builder()
            .orderNumber("ORD-" + System.currentTimeMillis())
            .customer(customer)
            .status(OrderStatus.CREATED)
            .total(BigDecimal.valueOf(100))
            .build();
        return entityManager.persist(order);
    }
}
```

### 2. Service Integration Test with Event Publishing

```java
@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
@DisplayName("OrderService Integration Tests")
class OrderServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    @ServiceConnection
    static KafkaContainer kafka = new KafkaContainer(
        DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @SpyBean
    private ApplicationEventPublisher eventPublisher;

    @Captor
    private ArgumentCaptor<OrderCreatedEvent> eventCaptor;

    @BeforeEach
    void setUp() {
        orderRepository.deleteAll();
    }

    @Test
    @DisplayName("should create order and publish event")
    void shouldCreateOrderAndPublishEvent() {
        // Arrange
        var request = TestDataFactory.createOrderRequest();

        // Act
        var result = orderService.create(request);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.id()).isNotNull();
        assertThat(result.status()).isEqualTo(OrderStatus.CREATED);

        // Verify event published
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().orderId()).isEqualTo(result.id());

        // Verify database
        var savedOrder = orderRepository.findById(result.id());
        assertThat(savedOrder).isPresent();
    }

    @Test
    @DisplayName("should rollback on failure")
    void shouldRollbackOnFailure() {
        // Arrange
        var request = TestDataFactory.invalidOrderRequest();
        long countBefore = orderRepository.count();

        // Act & Assert
        assertThatThrownBy(() -> orderService.create(request))
            .isInstanceOf(ValidationException.class);

        // Verify rollback
        assertThat(orderRepository.count()).isEqualTo(countBefore);
    }
}
```

### 3. Repository Integration Test

```java
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@DisplayName("OrderRepository Integration Tests")
class OrderRepositoryIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("should find orders by customer with fetch join")
    void shouldFindOrdersByCustomerWithFetchJoin() {
        // Arrange
        var customer = createCustomer();
        var order1 = createOrder(customer, 3);
        var order2 = createOrder(customer, 2);
        entityManager.flush();
        entityManager.clear();

        // Act
        var orders = orderRepository.findByCustomerIdWithItems(customer.getId());

        // Assert
        assertThat(orders).hasSize(2);
        assertThat(orders.get(0).getItems()).hasSize(3);
        assertThat(orders.get(1).getItems()).hasSize(2);

        // Verify no N+1 (items already loaded)
        orders.forEach(order ->
            assertThat(Hibernate.isInitialized(order.getItems())).isTrue());
    }

    @Test
    @DisplayName("should use projection for summary")
    void shouldUseProjectionForSummary() {
        // Arrange
        var customer = createCustomer();
        createOrder(customer, 1);
        createOrder(customer, 2);
        entityManager.flush();

        // Act
        var summaries = orderRepository.findSummariesByCustomerId(customer.getId());

        // Assert
        assertThat(summaries).hasSize(2);
        assertThat(summaries.get(0).getId()).isNotNull();
        assertThat(summaries.get(0).getOrderNumber()).isNotNull();
    }

    // Helper methods
    private Customer createCustomer() {
        return entityManager.persist(Customer.builder()
            .name("Test")
            .email("test@example.com")
            .build());
    }

    private Order createOrder(Customer customer, int itemCount) {
        var order = Order.builder()
            .orderNumber("ORD-" + System.nanoTime())
            .customer(customer)
            .status(OrderStatus.CREATED)
            .build();

        for (int i = 0; i < itemCount; i++) {
            order.addItem(OrderItem.builder()
                .productId((long) i)
                .quantity(1)
                .price(BigDecimal.TEN)
                .build());
        }

        return entityManager.persist(order);
    }
}
```

### 4. Full Stack Test with REST Assured

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
@DisplayName("Order API Full Stack Tests")
class OrderApiFullStackTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @LocalServerPort
    private int port;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
        RestAssured.basePath = "/api";
        orderRepository.deleteAll();
    }

    @Test
    @DisplayName("should complete order lifecycle")
    void shouldCompleteOrderLifecycle() {
        // Create order
        var createResponse = given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + getTestToken())
            .body("""
                {
                    "customerId": 1,
                    "items": [
                        {"productId": 1, "quantity": 2, "price": 10.00}
                    ]
                }
                """)
        .when()
            .post("/orders")
        .then()
            .statusCode(201)
            .extract()
            .as(OrderResponse.class);

        Long orderId = createResponse.id();
        assertThat(orderId).isNotNull();

        // Get order
        given()
            .header("Authorization", "Bearer " + getTestToken())
        .when()
            .get("/orders/{id}", orderId)
        .then()
            .statusCode(200)
            .body("id", equalTo(orderId.intValue()))
            .body("status", equalTo("CREATED"));

        // Update order
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + getTestToken())
            .body("""
                {"status": "SUBMITTED"}
                """)
        .when()
            .put("/orders/{id}", orderId)
        .then()
            .statusCode(200)
            .body("status", equalTo("SUBMITTED"));

        // Delete order
        given()
            .header("Authorization", "Bearer " + getTestToken())
        .when()
            .delete("/orders/{id}", orderId)
        .then()
            .statusCode(204);

        // Verify deleted
        given()
            .header("Authorization", "Bearer " + getTestToken())
        .when()
            .get("/orders/{id}", orderId)
        .then()
            .statusCode(404);
    }

    private String getTestToken() {
        // Return test JWT token
        return "test-token";
    }
}
```

### 5. Test Configuration

```yaml
# application-test.yml
spring:
  jpa:
    hibernate:
      ddl-auto: create-drop
    show-sql: true
    properties:
      hibernate:
        format_sql: true

  flyway:
    enabled: false

logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql.BasicBinder: TRACE
```

## Output Checklist

Ensure the tests have:

- [ ] Proper test organization with `@Nested`
- [ ] Descriptive names with `@DisplayName`
- [ ] Testcontainers for external dependencies
- [ ] `@ServiceConnection` for auto-configuration
- [ ] Security testing with `@WithMockUser`
- [ ] Database state verification
- [ ] Event publishing verification
- [ ] Rollback behavior verification
- [ ] Helper methods for test data

## Memory Bank Updates

After generating tests:

- [ ] Add test patterns to knowledge base
- [ ] Document testing strategy in project context
- [ ] Update test coverage requirements

## Example Usage

**User**: Create integration tests for the OrderController with PostgreSQL and Kafka

**Response**:
[Generates complete integration tests with Testcontainers, MockMvc, and event verification]
