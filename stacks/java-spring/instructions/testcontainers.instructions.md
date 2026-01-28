---
applyTo: "**/src/test/**/*.java"
excludeAgent: ""
---

# Testcontainers Instructions

These instructions apply when using Testcontainers for integration testing in Spring Boot applications.

## Dependencies

### build.gradle.kts
```kotlin
dependencies {
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:testcontainers")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:kafka")
    testImplementation("org.testcontainers:localstack")
}
```

## Spring Boot 3.1+ @ServiceConnection

### PostgreSQL with Service Connection
```java
@SpringBootTest
@Testcontainers
class OrderServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("orders")
        .withUsername("test")
        .withPassword("test");

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void shouldCreateAndRetrieveOrder() {
        // Test with real PostgreSQL
        var request = new CreateOrderRequest(1L, List.of(item()));
        var created = orderService.create(request);

        var found = orderService.findById(created.id());

        assertThat(found).isPresent();
        assertThat(found.get().id()).isEqualTo(created.id());
    }
}
```

### Kafka with Service Connection
```java
@SpringBootTest
@Testcontainers
class OrderEventIntegrationTest {

    @Container
    @ServiceConnection
    static KafkaContainer kafka = new KafkaContainer(
        DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));

    @Autowired
    private OrderEventPublisher publisher;

    @Autowired
    private KafkaTemplate<String, OrderEvent> kafkaTemplate;

    @Test
    void shouldPublishOrderCreatedEvent() {
        var order = TestDataFactory.order();

        publisher.publishOrderCreated(order);

        // Verify message was sent
        await().atMost(Duration.ofSeconds(10))
            .untilAsserted(() -> {
                // Assert message received
            });
    }
}
```

## Multiple Containers

```java
@SpringBootTest
@Testcontainers
class FullIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
        .withNetwork(Network.SHARED)
        .withNetworkAliases("postgres");

    @Container
    @ServiceConnection
    static KafkaContainer kafka = new KafkaContainer(
        DockerImageName.parse("confluentinc/cp-kafka:7.5.0"))
        .withNetwork(Network.SHARED);

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
        .withNetwork(Network.SHARED)
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Test
    void shouldIntegrateAllServices() {
        // Test with all containers running
    }
}
```

## Reusable Container Configuration

### Test Base Class
```java
@Testcontainers
public abstract class AbstractIntegrationTest {

    @Container
    @ServiceConnection
    protected static final PostgreSQLContainer<?> postgres;

    @Container
    @ServiceConnection
    protected static final KafkaContainer kafka;

    static {
        postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("testdb")
            .withReuse(true);

        kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"))
            .withReuse(true);
    }
}

@SpringBootTest
class OrderServiceTest extends AbstractIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Test
    void shouldCreateOrder() {
        // Test with shared containers
    }
}
```

### Test Configuration Class
```java
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    public PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("testdb");
    }

    @Bean
    @ServiceConnection
    public KafkaContainer kafkaContainer() {
        return new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));
    }
}

// Use in tests
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class OrderServiceTest {
    // Tests
}
```

## Database Initialization

### With SQL Scripts
```java
@Container
@ServiceConnection
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
    .withInitScript("db/init.sql");
```

### With Flyway/Liquibase
```yaml
# application-test.yml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    clean-disabled: false
```

```java
@SpringBootTest
@Testcontainers
class DatabaseMigrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private Flyway flyway;

    @BeforeEach
    void setUp() {
        flyway.clean();
        flyway.migrate();
    }

    @Test
    void shouldMigrateDatabase() {
        assertThat(flyway.info().current().getVersion().toString())
            .isEqualTo("2.0");
    }
}
```

## LocalStack (AWS Services)

```java
@SpringBootTest
@Testcontainers
class S3IntegrationTest {

    @Container
    static LocalStackContainer localstack = new LocalStackContainer(
        DockerImageName.parse("localstack/localstack:3.0"))
        .withServices(LocalStackContainer.Service.S3);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("aws.endpoint", () -> localstack.getEndpointOverride(S3).toString());
        registry.add("aws.region", localstack::getRegion);
        registry.add("aws.access-key", localstack::getAccessKey);
        registry.add("aws.secret-key", localstack::getSecretKey);
    }

    @Autowired
    private S3Client s3Client;

    @BeforeEach
    void setUp() {
        s3Client.createBucket(b -> b.bucket("test-bucket"));
    }

    @Test
    void shouldUploadToS3() {
        var content = "test content";
        s3Client.putObject(
            b -> b.bucket("test-bucket").key("test.txt"),
            RequestBody.fromString(content)
        );

        var result = s3Client.getObject(
            b -> b.bucket("test-bucket").key("test.txt")
        );

        assertThat(result.readAllBytes())
            .isEqualTo(content.getBytes());
    }
}
```

## Waiting Strategies

```java
// Wait for log message
@Container
static GenericContainer<?> service = new GenericContainer<>("my-service:latest")
    .waitingFor(Wait.forLogMessage(".*Started.*\\n", 1));

// Wait for HTTP endpoint
@Container
static GenericContainer<?> api = new GenericContainer<>("api:latest")
    .withExposedPorts(8080)
    .waitingFor(Wait.forHttp("/health")
        .forStatusCode(200)
        .withStartupTimeout(Duration.ofMinutes(2)));

// Wait for port
@Container
static GenericContainer<?> db = new GenericContainer<>("postgres:16")
    .withExposedPorts(5432)
    .waitingFor(Wait.forListeningPort()
        .withStartupTimeout(Duration.ofMinutes(1)));

// Composite wait
@Container
static GenericContainer<?> app = new GenericContainer<>("app:latest")
    .waitingFor(Wait.forAll(
        Wait.forListeningPort(),
        Wait.forHttp("/ready").forStatusCode(200)
    ));
```

## Container Reuse

### Enable Reuse
```properties
# ~/.testcontainers.properties
testcontainers.reuse.enable=true
```

```java
@Container
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
    .withReuse(true)
    .withLabel("reuse.UUID", "order-service-tests");
```

## Docker Compose Support

```java
@SpringBootTest
@Testcontainers
class DockerComposeTest {

    @Container
    static DockerComposeContainer<?> compose = new DockerComposeContainer<>(
        new File("src/test/resources/docker-compose-test.yml"))
        .withExposedService("postgres", 5432,
            Wait.forListeningPort().withStartupTimeout(Duration.ofMinutes(2)))
        .withExposedService("kafka", 9092);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () ->
            "jdbc:postgresql://" +
            compose.getServiceHost("postgres", 5432) + ":" +
            compose.getServicePort("postgres", 5432) + "/testdb");
    }
}
```

## Singleton Pattern for Performance

```java
public final class SharedContainers {

    private static PostgreSQLContainer<?> postgres;
    private static KafkaContainer kafka;

    private SharedContainers() {}

    public static PostgreSQLContainer<?> getPostgres() {
        if (postgres == null) {
            postgres = new PostgreSQLContainer<>("postgres:16-alpine")
                .withReuse(true);
            postgres.start();
        }
        return postgres;
    }

    public static KafkaContainer getKafka() {
        if (kafka == null) {
            kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"))
                .withReuse(true);
            kafka.start();
        }
        return kafka;
    }
}

// Usage
@SpringBootTest
class OrderTest {

    @DynamicPropertySource
    static void configure(DynamicPropertyRegistry registry) {
        var postgres = SharedContainers.getPostgres();
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
```

## Memory Bank Integration

When using Testcontainers:

1. **Document container versions**: Add to project context
2. **Share configurations**: Add reusable patterns to knowledge base
3. **Performance tips**: Document container reuse strategies

## What You MUST Do

- Use `@ServiceConnection` for supported containers (Spring Boot 3.1+)
- Configure proper wait strategies
- Use container reuse for faster test execution
- Clean up test data between tests
- Use appropriate Docker image versions

## What You MUST NOT Do

- Hardcode container ports (always use mapped ports)
- Skip wait strategies for containers
- Use latest tags in production tests
- Ignore container startup failures
- Forget to close containers (let JUnit handle it)
