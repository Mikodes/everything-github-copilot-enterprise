---
applyTo: "**/*.java,**/application*.yml,**/pom.xml,**/build.gradle*"
excludeAgent: ""
---

# Spring Cloud Instructions

These instructions apply when building microservices with Spring Cloud in Spring Boot 3.x/4.x applications.

## Spring Cloud BOM

### Gradle (build.gradle.kts)
```kotlin
dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2023.0.0")
    }
}

dependencies {
    implementation("org.springframework.cloud:spring-cloud-starter-gateway")
    implementation("org.springframework.cloud:spring-cloud-starter-circuitbreaker-resilience4j")
    implementation("org.springframework.cloud:spring-cloud-starter-config")
    implementation("org.springframework.cloud:spring-cloud-starter-loadbalancer")
    implementation("org.springframework.cloud:spring-cloud-stream-binder-kafka")
}
```

### Maven (pom.xml)
```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2023.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

## Spring Cloud Gateway

### Gateway Configuration
```yaml
spring:
  application:
    name: api-gateway

  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1
            - name: CircuitBreaker
              args:
                name: orderServiceCB
                fallbackUri: forward:/fallback/orders
            - name: Retry
              args:
                retries: 3
                statuses: SERVICE_UNAVAILABLE,BAD_GATEWAY
                methods: GET
                backoff:
                  firstBackoff: 50ms
                  maxBackoff: 500ms
                  factor: 2

        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
            - Header=X-API-Version, v[12]
          filters:
            - StripPrefix=1
            - AddRequestHeader=X-Gateway-Request-Id, ${random.uuid}
            - name: RequestRateLimiter
              args:
                redis-rate-limiter:
                  replenishRate: 100
                  burstCapacity: 200

      default-filters:
        - DedupeResponseHeader=Access-Control-Allow-Origin
        - name: RequestSize
          args:
            maxSize: 5MB

      globalcors:
        cors-configurations:
          '[/api/**]':
            allowedOrigins: "https://app.example.com"
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
            allowedHeaders: "*"
            allowCredentials: true
```

### Custom Gateway Filter
```java
@Component
public class JwtAuthGatewayFilterFactory
        extends AbstractGatewayFilterFactory<JwtAuthGatewayFilterFactory.Config> {

    private final JwtDecoder jwtDecoder;

    public JwtAuthGatewayFilterFactory(JwtDecoder jwtDecoder) {
        super(Config.class);
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            String authHeader = exchange.getRequest().getHeaders()
                .getFirst(HttpHeaders.AUTHORIZATION);

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return unauthorizedResponse(exchange);
            }

            String token = authHeader.substring(7);

            try {
                Jwt jwt = jwtDecoder.decode(token);

                ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header("X-User-Id", jwt.getSubject())
                    .header("X-User-Email", jwt.getClaimAsString("email"))
                    .header("X-User-Roles", String.join(",", extractRoles(jwt)))
                    .build();

                return chain.filter(exchange.mutate().request(mutatedRequest).build());
            } catch (JwtException e) {
                log.warn("JWT validation failed: {}", e.getMessage());
                return unauthorizedResponse(exchange);
            }
        };
    }

    private Mono<Void> unauthorizedResponse(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    @Data
    public static class Config {
        private boolean enabled = true;
        private List<String> excludePaths = List.of();
    }
}
```

## Service Discovery (Kubernetes)

### Configuration
```yaml
spring:
  cloud:
    kubernetes:
      discovery:
        enabled: true
        all-namespaces: false
      loadbalancer:
        mode: service
```

### Service Client
```java
@Configuration
public class ServiceClientConfig {

    @Bean
    @LoadBalanced
    public RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder();
    }

    @Bean
    public WebClient.Builder loadBalancedWebClientBuilder() {
        return WebClient.builder();
    }
}

@Service
@RequiredArgsConstructor
public class OrderServiceClient {

    private final RestClient.Builder restClientBuilder;

    public Order getOrder(Long id) {
        return restClientBuilder.build()
            .get()
            .uri("http://order-service/api/orders/{id}", id)
            .retrieve()
            .body(Order.class);
    }
}
```

## Circuit Breaker (Resilience4j)

### Configuration
```yaml
resilience4j:
  circuitbreaker:
    configs:
      default:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: true
        recordExceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
          - org.springframework.web.client.ResourceAccessException
    instances:
      orderService:
        baseConfig: default
        failureRateThreshold: 60
        waitDurationInOpenState: 60s

      paymentService:
        baseConfig: default
        slowCallDurationThreshold: 2s
        slowCallRateThreshold: 80

  retry:
    configs:
      default:
        maxAttempts: 3
        waitDuration: 500ms
        enableExponentialBackoff: true
        exponentialBackoffMultiplier: 2
        retryExceptions:
          - java.io.IOException
          - org.springframework.web.client.ResourceAccessException
    instances:
      orderService:
        baseConfig: default

  bulkhead:
    configs:
      default:
        maxConcurrentCalls: 25
        maxWaitDuration: 0ms
    instances:
      orderService:
        baseConfig: default
        maxConcurrentCalls: 50

  timelimiter:
    configs:
      default:
        timeoutDuration: 5s
        cancelRunningFuture: true
    instances:
      orderService:
        baseConfig: default
        timeoutDuration: 10s

  ratelimiter:
    configs:
      default:
        limitForPeriod: 100
        limitRefreshPeriod: 1s
        timeoutDuration: 0ms
    instances:
      orderService:
        baseConfig: default
        limitForPeriod: 200
```

### Service with Resilience
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderIntegrationService {

    private final RestClient restClient;

    @CircuitBreaker(name = "orderService", fallbackMethod = "getOrderFallback")
    @Retry(name = "orderService")
    @Bulkhead(name = "orderService")
    @TimeLimiter(name = "orderService")
    public CompletableFuture<Order> getOrderAsync(Long orderId) {
        return CompletableFuture.supplyAsync(() ->
            restClient.get()
                .uri("/api/orders/{id}", orderId)
                .retrieve()
                .body(Order.class)
        );
    }

    @CircuitBreaker(name = "orderService", fallbackMethod = "getOrderFallbackSync")
    @Retry(name = "orderService")
    public Order getOrder(Long orderId) {
        return restClient.get()
            .uri("/api/orders/{id}", orderId)
            .retrieve()
            .body(Order.class);
    }

    // Fallback methods
    private CompletableFuture<Order> getOrderFallback(Long orderId, Throwable t) {
        log.warn("Circuit breaker fallback for order {}: {}", orderId, t.getMessage());
        return CompletableFuture.completedFuture(Order.unavailable(orderId));
    }

    private Order getOrderFallbackSync(Long orderId, Throwable t) {
        log.warn("Fallback for order {}: {}", orderId, t.getMessage());
        return Order.unavailable(orderId);
    }
}
```

## Spring Cloud Stream (Kafka)

### Configuration
```yaml
spring:
  cloud:
    stream:
      kafka:
        binder:
          brokers: ${KAFKA_BROKERS:localhost:9092}
          configuration:
            security.protocol: ${KAFKA_SECURITY_PROTOCOL:PLAINTEXT}
        bindings:
          orderEvents-out-0:
            producer:
              configuration:
                acks: all
                retries: 3

      bindings:
        # Outbound
        orderEvents-out-0:
          destination: orders.events
          contentType: application/json
          producer:
            partitionKeyExpression: headers['partitionKey']

        # Inbound
        orderEvents-in-0:
          destination: orders.events
          group: ${spring.application.name}
          contentType: application/json
          consumer:
            max-attempts: 3
            back-off-initial-interval: 1000
            back-off-multiplier: 2.0
            concurrency: 3

      function:
        definition: orderEventProcessor
```

### Event Publishing
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderEventPublisher {

    private final StreamBridge streamBridge;

    public void publishOrderCreated(Order order) {
        var event = new OrderCreatedEvent(
            order.getId(),
            order.getCustomerId(),
            order.getTotal(),
            Instant.now()
        );

        Message<OrderCreatedEvent> message = MessageBuilder
            .withPayload(event)
            .setHeader("partitionKey", order.getCustomerId())
            .setHeader("eventType", "ORDER_CREATED")
            .setHeader("correlationId", UUID.randomUUID().toString())
            .build();

        boolean sent = streamBridge.send("orderEvents-out-0", message);

        if (sent) {
            log.info("Published OrderCreatedEvent for order {}", order.getId());
        } else {
            log.error("Failed to publish OrderCreatedEvent for order {}", order.getId());
        }
    }
}
```

### Event Consumer
```java
@Configuration
@Slf4j
public class OrderEventConsumer {

    @Bean
    public Consumer<Message<OrderEvent>> orderEventProcessor() {
        return message -> {
            var event = message.getPayload();
            var headers = message.getHeaders();

            String correlationId = headers.get("correlationId", String.class);
            String eventType = headers.get("eventType", String.class);

            log.info("Processing {} event with correlationId: {}", eventType, correlationId);

            switch (event) {
                case OrderCreatedEvent created -> handleOrderCreated(created);
                case OrderCancelledEvent cancelled -> handleOrderCancelled(cancelled);
                default -> log.warn("Unknown event type: {}", event.getClass().getSimpleName());
            }
        };
    }

    private void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Order created: {} for customer {}", event.orderId(), event.customerId());
        // Process order created event
    }

    private void handleOrderCancelled(OrderCancelledEvent event) {
        log.info("Order cancelled: {}", event.orderId());
        // Process order cancelled event
    }
}
```

## Distributed Tracing

### Configuration
```yaml
management:
  tracing:
    enabled: true
    sampling:
      probability: ${TRACING_SAMPLE_RATE:1.0}
    propagation:
      type: w3c,b3

  zipkin:
    tracing:
      endpoint: ${ZIPKIN_ENDPOINT:http://localhost:9411/api/v2/spans}

logging:
  pattern:
    level: "%5p [${spring.application.name:},%X{traceId:-},%X{spanId:-}]"
```

### Custom Spans
```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final Tracer tracer;
    private final ObservationRegistry observationRegistry;

    public Order processOrder(CreateOrderRequest request) {
        return Observation.createNotStarted("order.process", observationRegistry)
            .lowCardinalityKeyValue("order.type", request.type().name())
            .observe(() -> {
                Span span = tracer.currentSpan();
                if (span != null) {
                    span.tag("customer.id", request.customerId());
                }
                return doProcessOrder(request);
            });
    }
}
```

## Config Server

### Client Configuration
```yaml
spring:
  config:
    import: optional:configserver:${CONFIG_SERVER_URL:http://localhost:8888}

  cloud:
    config:
      fail-fast: true
      retry:
        max-attempts: 5
        initial-interval: 1000
        multiplier: 1.5
```

## Memory Bank Integration

When using Spring Cloud:

1. **Document service map**: Add service interactions to project context
2. **Track resilience patterns**: Document circuit breaker configs
3. **Event catalog**: Maintain list of events and their schemas

## What You MUST Do

- Use circuit breakers for all external service calls
- Configure proper timeouts for all integrations
- Implement fallback methods for critical operations
- Use distributed tracing for request correlation
- Configure proper retry policies

## What You MUST NOT Do

- Call services without circuit breakers
- Ignore timeout configuration
- Use synchronous chains without resilience patterns
- Share databases between microservices
- Ignore message ordering requirements
