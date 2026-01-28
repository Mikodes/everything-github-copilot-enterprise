---
applyTo: "**/src/test/**/*.java"
excludeAgent: ""
---

# JUnit 5 Testing Instructions

These instructions apply when writing tests for Spring Boot applications using JUnit 5 (Jupiter).

## Test Structure

### Standard Test Class
```java
@SpringBootTest
@Transactional
@ActiveProfiles("test")
@DisplayName("OrderService Integration Tests")
class OrderServiceIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager entityManager;

    @BeforeEach
    void setUp() {
        // Setup code
    }

    @AfterEach
    void tearDown() {
        // Cleanup code
    }

    @Nested
    @DisplayName("Create Order")
    class CreateOrder {

        @Test
        @DisplayName("should create order with valid request")
        void shouldCreateOrderWithValidRequest() {
            // Arrange
            var request = createValidOrderRequest();

            // Act
            var result = orderService.create(request);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.id()).isNotNull();
            assertThat(result.status()).isEqualTo(OrderStatus.CREATED);
        }

        @Test
        @DisplayName("should throw exception when customer not found")
        void shouldThrowExceptionWhenCustomerNotFound() {
            // Arrange
            var request = new CreateOrderRequest(999L, List.of());

            // Act & Assert
            assertThatThrownBy(() -> orderService.create(request))
                .isInstanceOf(CustomerNotFoundException.class)
                .hasMessageContaining("Customer not found");
        }
    }
}
```

### Unit Test Class
```java
@ExtendWith(MockitoExtension.class)
@DisplayName("OrderService Unit Tests")
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private OrderMapper orderMapper;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private OrderService orderService;

    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    @Test
    @DisplayName("should save order and publish event")
    void shouldSaveOrderAndPublishEvent() {
        // Arrange
        var customer = TestDataFactory.customer();
        var request = TestDataFactory.createOrderRequest();
        var order = TestDataFactory.order();
        var orderDto = TestDataFactory.orderDto();

        when(customerRepository.findById(request.customerId())).thenReturn(Optional.of(customer));
        when(orderMapper.toEntity(request)).thenReturn(order);
        when(orderRepository.save(any(Order.class))).thenReturn(order);
        when(orderMapper.toDto(order)).thenReturn(orderDto);

        // Act
        var result = orderService.create(request);

        // Assert
        assertThat(result).isEqualTo(orderDto);

        verify(orderRepository).save(orderCaptor.capture());
        assertThat(orderCaptor.getValue().getStatus()).isEqualTo(OrderStatus.CREATED);

        verify(eventPublisher).publishEvent(any(OrderCreatedEvent.class));
    }
}
```

## Assertions (AssertJ)

### Collection Assertions
```java
@Test
void shouldReturnFilteredOrders() {
    // Act
    List<Order> orders = orderService.findByStatus(OrderStatus.PENDING);

    // Assert
    assertThat(orders)
        .isNotEmpty()
        .hasSize(3)
        .extracting(Order::getStatus)
        .containsOnly(OrderStatus.PENDING);

    assertThat(orders)
        .filteredOn(order -> order.getTotal().compareTo(BigDecimal.valueOf(100)) > 0)
        .hasSize(2)
        .extracting(Order::getCustomerId)
        .containsExactlyInAnyOrder(1L, 2L);
}
```

### Exception Assertions
```java
@Test
void shouldThrowExceptionWithDetails() {
    assertThatThrownBy(() -> orderService.delete(999L))
        .isInstanceOf(OrderNotFoundException.class)
        .hasMessageContaining("Order not found")
        .hasFieldOrPropertyWithValue("orderId", 999L);

    assertThatCode(() -> orderService.findById(1L))
        .doesNotThrowAnyException();

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> orderService.create(invalidRequest))
        .withMessageMatching(".*validation.*failed.*");
}
```

### Soft Assertions
```java
@Test
void shouldCreateOrderWithAllFields() {
    var result = orderService.create(request);

    SoftAssertions.assertSoftly(softly -> {
        softly.assertThat(result.id()).isNotNull();
        softly.assertThat(result.orderNumber()).startsWith("ORD-");
        softly.assertThat(result.status()).isEqualTo(OrderStatus.CREATED);
        softly.assertThat(result.items()).hasSize(2);
        softly.assertThat(result.total()).isPositive();
    });
}
```

## Parameterized Tests

```java
@ParameterizedTest
@ValueSource(strings = {"PENDING", "PROCESSING", "SHIPPED"})
@DisplayName("should find orders by status")
void shouldFindOrdersByStatus(String statusName) {
    // Arrange
    var status = OrderStatus.valueOf(statusName);

    // Act
    var orders = orderService.findByStatus(status);

    // Assert
    assertThat(orders)
        .isNotEmpty()
        .allMatch(o -> o.getStatus() == status);
}

@ParameterizedTest
@CsvSource({
    "100, 10, 90",
    "200, 20, 160",
    "50, 0, 50"
})
@DisplayName("should calculate total with discount")
void shouldCalculateTotalWithDiscount(double price, double discount, double expected) {
    var order = createOrderWithPrice(price, discount);
    assertThat(order.calculateTotal()).isEqualTo(BigDecimal.valueOf(expected));
}

@ParameterizedTest
@MethodSource("provideOrderTestCases")
@DisplayName("should validate order")
void shouldValidateOrder(CreateOrderRequest request, boolean expectedValid) {
    if (expectedValid) {
        assertThatCode(() -> orderService.create(request)).doesNotThrowAnyException();
    } else {
        assertThatThrownBy(() -> orderService.create(request))
            .isInstanceOf(ValidationException.class);
    }
}

static Stream<Arguments> provideOrderTestCases() {
    return Stream.of(
        Arguments.of(validRequest(), true),
        Arguments.of(requestWithNoItems(), false),
        Arguments.of(requestWithNullCustomer(), false)
    );
}

@ParameterizedTest
@EnumSource(value = OrderStatus.class, names = {"PENDING", "PROCESSING"})
@DisplayName("should allow cancellation for specific statuses")
void shouldAllowCancellation(OrderStatus status) {
    var order = createOrderWithStatus(status);
    assertThat(order.canCancel()).isTrue();
}
```

## WebMvc Tests

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
@DisplayName("OrderController Tests")
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OrderService orderService;

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("GET /api/orders/{id} - should return order")
    void shouldReturnOrder() throws Exception {
        // Arrange
        var order = TestDataFactory.orderDto();
        when(orderService.findById(1L)).thenReturn(Optional.of(order));

        // Act & Assert
        mockMvc.perform(get("/api/orders/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(order.id()))
            .andExpect(jsonPath("$.orderNumber").value(order.orderNumber()))
            .andExpect(jsonPath("$.status").value(order.status().name()));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("POST /api/orders - should create order")
    void shouldCreateOrder() throws Exception {
        // Arrange
        var request = TestDataFactory.createOrderRequest();
        var created = TestDataFactory.orderDto();
        when(orderService.create(any())).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNotEmpty());

        verify(orderService).create(any(CreateOrderRequest.class));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("POST /api/orders - should return 400 for invalid request")
    void shouldReturn400ForInvalidRequest() throws Exception {
        var invalidRequest = new CreateOrderRequest(null, List.of());

        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors").isNotEmpty());
    }
}
```

## Data JPA Tests

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@DisplayName("OrderRepository Tests")
class OrderRepositoryTest {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("should find orders by customer")
    void shouldFindOrdersByCustomer() {
        // Arrange
        var customer = entityManager.persist(TestDataFactory.customer());
        var order1 = entityManager.persist(TestDataFactory.orderFor(customer));
        var order2 = entityManager.persist(TestDataFactory.orderFor(customer));
        entityManager.flush();

        // Act
        var orders = orderRepository.findByCustomerId(customer.getId());

        // Assert
        assertThat(orders)
            .hasSize(2)
            .extracting(Order::getId)
            .containsExactlyInAnyOrder(order1.getId(), order2.getId());
    }

    @Test
    @DisplayName("should find orders with items using fetch join")
    void shouldFindOrdersWithItems() {
        // Arrange
        var order = entityManager.persist(TestDataFactory.orderWithItems(3));
        entityManager.flush();
        entityManager.clear();

        // Act
        var result = orderRepository.findByIdWithItems(order.getId());

        // Assert
        assertThat(result).isPresent();
        assertThat(result.get().getItems())
            .hasSize(3)
            .allSatisfy(item -> assertThat(item.getOrder()).isNotNull());
    }
}
```

## Test Data Factory

```java
public final class TestDataFactory {

    private TestDataFactory() {}

    public static Customer customer() {
        return Customer.builder()
            .name("Test Customer")
            .email("test@example.com")
            .build();
    }

    public static Order order() {
        return Order.builder()
            .orderNumber("ORD-" + System.currentTimeMillis())
            .status(OrderStatus.CREATED)
            .total(BigDecimal.valueOf(100))
            .build();
    }

    public static Order orderWithItems(int itemCount) {
        var order = order();
        for (int i = 0; i < itemCount; i++) {
            order.addItem(orderItem());
        }
        return order;
    }

    public static OrderItem orderItem() {
        return OrderItem.builder()
            .productId(1L)
            .productName("Test Product")
            .quantity(1)
            .price(BigDecimal.TEN)
            .build();
    }

    public static CreateOrderRequest createOrderRequest() {
        return new CreateOrderRequest(
            1L,
            List.of(new CreateOrderItemRequest(1L, 2))
        );
    }

    public static OrderDto orderDto() {
        return new OrderDto(
            1L,
            "ORD-123",
            OrderStatus.CREATED,
            BigDecimal.valueOf(100),
            Instant.now()
        );
    }
}
```

## Test Configuration

### application-test.yml
```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL
    driver-class-name: org.h2.Driver

  jpa:
    hibernate:
      ddl-auto: create-drop
    properties:
      hibernate:
        dialect: org.hibernate.dialect.H2Dialect

  main:
    allow-bean-definition-overriding: true

logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql: TRACE
```

## Memory Bank Integration

When writing tests:

1. **Document test patterns**: Add common patterns to knowledge base
2. **Track test coverage**: Document coverage requirements
3. **Share test utilities**: Add reusable test helpers to knowledge base

## What You MUST Do

- Use descriptive test names with `@DisplayName`
- Follow AAA pattern (Arrange, Act, Assert)
- Use AssertJ for fluent assertions
- Group related tests with `@Nested`
- Use test data factories for consistent test data
- Mock external dependencies in unit tests

## What You MUST NOT Do

- Write tests without assertions
- Use production data in tests
- Share state between test methods
- Ignore flaky tests
- Test implementation details instead of behavior
- Use Thread.sleep() in tests (use Awaitility instead)
