---
applyTo: "**/*.java,**/application*.yml,**/application*.yaml,**/pom.xml,**/build.gradle*"
excludeAgent: ""
---

# Spring Boot 4.x Instructions

These instructions apply to projects using Spring Boot 4.x, the latest major version with enhanced Java 21+ support, virtual threads, and improved developer experience.

## Spring Boot 4.x Key Features

### Java 21+ Required
Spring Boot 4.x requires Java 21 as the minimum version, enabling full use of:
- Virtual Threads (Project Loom)
- Record Patterns
- Pattern Matching for switch
- Sequenced Collections

### Virtual Threads Configuration

```yaml
# application.yml - Enable virtual threads globally
spring:
  threads:
    virtual:
      enabled: true

  # Tomcat with virtual threads
  servlet:
    threads:
      virtual: true
```

```java
// Programmatic configuration
@Configuration
public class ThreadConfig {

    @Bean
    public TomcatProtocolHandlerCustomizer<?> virtualThreadCustomizer() {
        return protocolHandler -> {
            protocolHandler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        };
    }
}
```

### Improved Observability

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus

  tracing:
    enabled: true
    sampling:
      probability: 1.0

  observations:
    key-values:
      application: ${spring.application.name}

  metrics:
    tags:
      application: ${spring.application.name}
      environment: ${spring.profiles.active:default}
```

```java
// Custom observation
@Service
@RequiredArgsConstructor
public class OrderService {

    private final ObservationRegistry observationRegistry;

    public Order createOrder(CreateOrderRequest request) {
        return Observation.createNotStarted("order.create", observationRegistry)
            .lowCardinalityKeyValue("order.type", request.type().name())
            .observe(() -> processOrder(request));
    }
}
```

## Configuration Properties

### Records as Configuration Properties
```java
@ConfigurationProperties(prefix = "app.orders")
@Validated
public record OrderProperties(
    @NotNull Duration timeout,
    @Min(1) int maxRetries,
    @NotBlank String defaultStatus,
    RetryProperties retry
) {
    public record RetryProperties(
        Duration initialDelay,
        Duration maxDelay,
        double multiplier
    ) {
        public RetryProperties {
            if (initialDelay == null) initialDelay = Duration.ofMillis(100);
            if (maxDelay == null) maxDelay = Duration.ofSeconds(5);
            if (multiplier == 0) multiplier = 2.0;
        }
    }
}
```

```yaml
# application.yml
app:
  orders:
    timeout: 30s
    max-retries: 3
    default-status: PENDING
    retry:
      initial-delay: 100ms
      max-delay: 5s
      multiplier: 2.0
```

## REST Client (Declarative)

### HTTP Interface Clients
```java
// Define the interface
public interface UserClient {

    @GetExchange("/users/{id}")
    User getUser(@PathVariable Long id);

    @GetExchange("/users")
    List<User> getAllUsers(@RequestParam(required = false) String status);

    @PostExchange("/users")
    User createUser(@RequestBody CreateUserRequest request);

    @PutExchange("/users/{id}")
    User updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request);

    @DeleteExchange("/users/{id}")
    void deleteUser(@PathVariable Long id);

    // Async variant
    @GetExchange("/users/{id}")
    CompletableFuture<User> getUserAsync(@PathVariable Long id);
}

// Configuration
@Configuration
public class ClientConfig {

    @Bean
    public UserClient userClient(RestClient.Builder builder) {
        RestClient restClient = builder
            .baseUrl("http://user-service")
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .build();

        RestClientAdapter adapter = RestClientAdapter.create(restClient);
        HttpServiceProxyFactory factory = HttpServiceProxyFactory
            .builderFor(adapter)
            .build();

        return factory.createClient(UserClient.class);
    }
}
```

### RestClient (Fluent API)
```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final RestClient restClient;

    public User getUser(Long id) {
        return restClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .body(User.class);
    }

    public List<User> searchUsers(UserSearchCriteria criteria) {
        return restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/users")
                .queryParam("status", criteria.status())
                .queryParam("role", criteria.role())
                .build())
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
    }

    public User createUser(CreateUserRequest request) {
        return restClient.post()
            .uri("/users")
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                throw new UserValidationException(res.getStatusText());
            })
            .body(User.class);
    }
}
```

## JDBC Client

```java
@Repository
@RequiredArgsConstructor
public class OrderRepository {

    private final JdbcClient jdbcClient;

    public Optional<Order> findById(Long id) {
        return jdbcClient.sql("SELECT * FROM orders WHERE id = :id")
            .param("id", id)
            .query(Order.class)
            .optional();
    }

    public List<Order> findByStatus(OrderStatus status) {
        return jdbcClient.sql("""
                SELECT * FROM orders
                WHERE status = :status
                ORDER BY created_at DESC
                """)
            .param("status", status.name())
            .query(Order.class)
            .list();
    }

    public Long create(Order order) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("""
                INSERT INTO orders (order_number, customer_id, status, total)
                VALUES (:orderNumber, :customerId, :status, :total)
                """)
            .param("orderNumber", order.orderNumber())
            .param("customerId", order.customerId())
            .param("status", order.status().name())
            .param("total", order.total())
            .update(keyHolder);
        return keyHolder.getKey().longValue();
    }

    public int updateStatus(Long id, OrderStatus status) {
        return jdbcClient.sql("UPDATE orders SET status = :status WHERE id = :id")
            .param("id", id)
            .param("status", status.name())
            .update();
    }
}
```

## Problem Details (RFC 7807)

```java
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    public ProblemDetail handleOrderNotFound(OrderNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND,
            ex.getMessage()
        );
        problem.setTitle("Order Not Found");
        problem.setType(URI.create("https://api.example.com/errors/order-not-found"));
        problem.setProperty("orderId", ex.getOrderId());
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(ValidationException.class)
    public ProblemDetail handleValidation(ValidationException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            "Validation failed"
        );
        problem.setTitle("Validation Error");
        problem.setProperty("errors", ex.getErrors());
        return problem;
    }
}
```

## SSL Bundles

```yaml
# application.yml
spring:
  ssl:
    bundle:
      jks:
        server:
          keystore:
            location: classpath:server.jks
            password: ${SSL_KEYSTORE_PASSWORD}
            type: JKS
          key:
            alias: server
            password: ${SSL_KEY_PASSWORD}

        client:
          truststore:
            location: classpath:client-truststore.jks
            password: ${SSL_TRUSTSTORE_PASSWORD}
```

```java
@Configuration
public class SslClientConfig {

    @Bean
    public RestClient secureRestClient(RestClient.Builder builder, SslBundles sslBundles) {
        return builder
            .baseUrl("https://secure-service")
            .apply(restClientSsl -> restClientSsl.setSslBundle(sslBundles.getBundle("client")))
            .build();
    }
}
```

## Testcontainers Integration

```java
@SpringBootTest
@Testcontainers
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

    @Test
    void shouldCreateOrder() {
        // Test with real database and Kafka
        var request = new CreateOrderRequest("customer-1", List.of(item()));
        var order = orderService.createOrder(request);

        assertThat(order.id()).isNotNull();
        assertThat(order.status()).isEqualTo(OrderStatus.CREATED);
    }
}
```

## Docker Compose Support

```yaml
# compose.yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
```

```yaml
# application.yml
spring:
  docker:
    compose:
      enabled: true
      lifecycle-management: start-and-stop
      file: compose.yaml
```

## Memory Bank Integration

When using Spring Boot 4.x:

1. **Document version**: Note Spring Boot 4.x in project context
2. **Track features used**: List new features in knowledge base
3. **Migration notes**: Document upgrade from 3.x if applicable

## What You MUST Do

- Use Java 21+ features (virtual threads, records, pattern matching)
- Enable virtual threads for I/O-heavy applications
- Use HTTP interface clients for service communication
- Use Problem Details for error responses
- Use `@ServiceConnection` for Testcontainers

## What You MUST NOT Do

- Use Java versions below 21
- Use WebClient when RestClient suffices (non-reactive apps)
- Ignore observability configuration
- Use deprecated APIs from Spring Boot 3.x
- Block in virtual threads with synchronized blocks
