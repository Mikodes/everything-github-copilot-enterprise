---
applyTo: "**/*.java,**/application*.yml,**/application*.yaml,**/pom.xml,**/build.gradle*"
excludeAgent: ""
---

# Spring Boot 3.x Instructions (LTS)

These instructions apply to projects using Spring Boot 3.x, the current Long Term Support (LTS) version. This version introduces Jakarta EE 9+, requires Java 17+, and includes significant improvements.

## Spring Boot 3.x Key Changes

### Jakarta EE 9+ Migration
```java
// ❌ Old (javax.*)
import javax.persistence.Entity;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.NotNull;

// ✅ New (jakarta.*)
import jakarta.persistence.Entity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotNull;
```

### Java 17+ Required
Minimum Java version is 17, enabling:
- Sealed classes
- Pattern matching for instanceof
- Records
- Text blocks
- Switch expressions

## Application Configuration

### application.yml Best Practices
```yaml
spring:
  application:
    name: order-service

  profiles:
    active: ${SPRING_PROFILES_ACTIVE:local}
    group:
      local: local,dev-tools
      production: prod,monitoring

  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:orders}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: ${DB_POOL_SIZE:10}
      connection-timeout: 30000

  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        format_sql: true
        jdbc:
          batch_size: 50

  jackson:
    default-property-inclusion: non_null
    serialization:
      write-dates-as-timestamps: false
    deserialization:
      fail-on-unknown-properties: false

server:
  port: ${SERVER_PORT:8080}
  shutdown: graceful
  compression:
    enabled: true
    mime-types: application/json,text/html,text/plain

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized
  health:
    db:
      enabled: true
    diskspace:
      enabled: true

logging:
  level:
    root: INFO
    com.example: DEBUG
    org.springframework.web: INFO
    org.hibernate.SQL: DEBUG
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
```

## REST Controllers

### Modern Controller Pattern
```java
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Validated
@Tag(name = "Orders", description = "Order management endpoints")
public class OrderController {

    private final OrderService orderService;

    @GetMapping("/{id}")
    @Operation(summary = "Get order by ID")
    public ResponseEntity<OrderDto> getOrder(
            @PathVariable @Positive Long id) {
        return orderService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @Operation(summary = "Get all orders with pagination")
    public Page<OrderDto> getOrders(
            @RequestParam(defaultValue = "0") @PositiveOrZero int page,
            @RequestParam(defaultValue = "20") @Positive @Max(100) int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return orderService.findAll(PageRequest.of(page, size, Sort.by(sort)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new order")
    public OrderDto createOrder(
            @Valid @RequestBody CreateOrderRequest request) {
        return orderService.create(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an existing order")
    public OrderDto updateOrder(
            @PathVariable @Positive Long id,
            @Valid @RequestBody UpdateOrderRequest request) {
        return orderService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete an order")
    public void deleteOrder(@PathVariable @Positive Long id) {
        orderService.delete(id);
    }
}
```

### Exception Handling
```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(EntityNotFoundException ex) {
        log.warn("Entity not found: {}", ex.getMessage());
        return new ErrorResponse(
            HttpStatus.NOT_FOUND.value(),
            "Not Found",
            ex.getMessage(),
            Instant.now()
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value"
            ));

        return new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Validation Failed",
            "Request validation failed",
            Instant.now(),
            errors
        );
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleGeneric(Exception ex) {
        log.error("Unexpected error", ex);
        return new ErrorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            "Internal Server Error",
            "An unexpected error occurred",
            Instant.now()
        );
    }
}

public record ErrorResponse(
    int status,
    String error,
    String message,
    Instant timestamp,
    Map<String, String> details
) {
    public ErrorResponse(int status, String error, String message, Instant timestamp) {
        this(status, error, message, timestamp, Map.of());
    }
}
```

## Service Layer

### Service Pattern
```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderMapper orderMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final MeterRegistry meterRegistry;

    public Optional<OrderDto> findById(Long id) {
        return orderRepository.findById(id)
            .map(orderMapper::toDto);
    }

    public Page<OrderDto> findAll(Pageable pageable) {
        return orderRepository.findAll(pageable)
            .map(orderMapper::toDto);
    }

    @Transactional
    public OrderDto create(CreateOrderRequest request) {
        log.info("Creating order for customer: {}", request.customerId());

        var order = orderMapper.toEntity(request);
        order.setStatus(OrderStatus.CREATED);

        var saved = orderRepository.save(order);

        eventPublisher.publishEvent(new OrderCreatedEvent(saved.getId()));
        meterRegistry.counter("orders.created", "status", "success").increment();

        log.info("Order created with ID: {}", saved.getId());
        return orderMapper.toDto(saved);
    }

    @Transactional
    public OrderDto update(Long id, UpdateOrderRequest request) {
        var order = orderRepository.findById(id)
            .orElseThrow(() -> new OrderNotFoundException(id));

        orderMapper.updateEntity(order, request);
        var saved = orderRepository.save(order);

        return orderMapper.toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        if (!orderRepository.existsById(id)) {
            throw new OrderNotFoundException(id);
        }
        orderRepository.deleteById(id);
        log.info("Order deleted: {}", id);
    }
}
```

## Native Compilation (GraalVM)

### Build Configuration (Gradle)
```kotlin
plugins {
    id("org.graalvm.buildtools.native") version "0.9.28"
}

graalvmNative {
    binaries {
        named("main") {
            imageName.set("order-service")
            mainClass.set("com.example.OrderServiceApplication")
            buildArgs.addAll(
                "--no-fallback",
                "-H:+ReportExceptionStackTraces"
            )
        }
    }
}
```

### Runtime Hints
```java
@Configuration
@ImportRuntimeHints(AppRuntimeHints.class)
public class NativeConfig {
}

public class AppRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        // Register reflection
        hints.reflection()
            .registerType(OrderDto.class, MemberCategory.values())
            .registerType(CreateOrderRequest.class, MemberCategory.values());

        // Register resources
        hints.resources()
            .registerPattern("messages/*.properties");

        // Register serialization
        hints.serialization()
            .registerType(OrderDto.class);
    }
}
```

## Observability

### Micrometer Configuration
```java
@Configuration
public class ObservabilityConfig {

    @Bean
    public MeterRegistryCustomizer<MeterRegistry> metricsCommonTags(
            @Value("${spring.application.name}") String applicationName) {
        return registry -> registry.config()
            .commonTags(
                "application", applicationName,
                "environment", System.getenv().getOrDefault("ENVIRONMENT", "local")
            );
    }

    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }
}

// Usage
@Service
public class OrderService {

    @Timed(value = "order.creation.time", description = "Time to create an order")
    public OrderDto create(CreateOrderRequest request) {
        // ...
    }
}
```

## Caching

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        var caffeine = Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(Duration.ofMinutes(10))
            .recordStats();

        return new CaffeineCacheManager("orders", "customers") {{
            setCaffeine(caffeine);
        }};
    }
}

@Service
public class OrderService {

    @Cacheable(value = "orders", key = "#id")
    public Optional<OrderDto> findById(Long id) {
        return orderRepository.findById(id).map(orderMapper::toDto);
    }

    @CacheEvict(value = "orders", key = "#id")
    @Transactional
    public OrderDto update(Long id, UpdateOrderRequest request) {
        // ...
    }

    @CacheEvict(value = "orders", allEntries = true)
    @Scheduled(fixedRateString = "${cache.evict.interval:3600000}")
    public void evictAllCaches() {
        log.info("Evicting all order caches");
    }
}
```

## Memory Bank Integration

When using Spring Boot 3.x:

1. **Document version**: Note Spring Boot 3.x LTS in project context
2. **Track Jakarta migration**: Document javax to jakarta changes
3. **Native compilation**: Note if using GraalVM native

## What You MUST Do

- Use Jakarta EE 9+ namespaces (jakarta.*)
- Use Java 17+ features (records, sealed classes, pattern matching)
- Configure proper exception handling
- Set `spring.jpa.open-in-view=false`
- Use `@Validated` for parameter validation
- Configure graceful shutdown

## What You MUST NOT Do

- Use javax.* packages (migrated to jakarta.*)
- Enable Open Session in View in production
- Ignore validation errors
- Use blocking operations in reactive code
- Expose stack traces in production error responses
