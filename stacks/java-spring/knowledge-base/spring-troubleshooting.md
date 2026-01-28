# Spring Boot Troubleshooting Guide

This guide helps diagnose and resolve common issues in Spring Boot applications.

## Table of Contents

1. [Startup Issues](#startup-issues)
2. [Database Issues](#database-issues)
3. [JPA/Hibernate Issues](#jpahibernate-issues)
4. [Transaction Issues](#transaction-issues)
5. [Security Issues](#security-issues)
6. [Performance Issues](#performance-issues)
7. [Testing Issues](#testing-issues)
8. [Dependency Issues](#dependency-issues)

---

## Startup Issues

### Application Fails to Start: "Bean not found"

**Symptoms**:
```
No qualifying bean of type 'com.example.service.OrderService' available
```

**Causes & Solutions**:

1. **Missing component scan**
   ```java
   // Ensure main class is in root package
   @SpringBootApplication
   public class Application { } // in com.example

   // Or specify base packages
   @SpringBootApplication(scanBasePackages = "com.example")
   ```

2. **Missing annotation**
   ```java
   // Ensure service has @Service, @Component, etc.
   @Service  // Was this missing?
   public class OrderService { }
   ```

3. **Conditional bean not created**
   ```java
   // Check if conditions are met
   @ConditionalOnProperty(name = "feature.enabled", havingValue = "true")
   @Service
   public class FeatureService { }
   ```
   ```yaml
   # application.yml
   feature:
     enabled: true  # Must be set
   ```

### Application Fails to Start: "Port already in use"

**Symptoms**:
```
Web server failed to start. Port 8080 was already in use.
```

**Solutions**:

```bash
# Find process using the port
lsof -i :8080
kill -9 <PID>

# Or use different port
./gradlew bootRun --args='--server.port=8081'
```

```yaml
# application.yml - use random port
server:
  port: 0
```

### Circular Dependency

**Symptoms**:
```
The dependencies of some of the beans in the application context form a cycle:
   orderService -> inventoryService -> orderService
```

**Solutions**:

1. **Use @Lazy**
   ```java
   @Service
   public class OrderService {
       public OrderService(@Lazy InventoryService inventoryService) {
           this.inventoryService = inventoryService;
       }
   }
   ```

2. **Use events (preferred)**
   ```java
   @Service
   public class OrderService {
       private final ApplicationEventPublisher events;

       public void createOrder() {
           events.publishEvent(new OrderCreatedEvent(orderId));
       }
   }
   ```

3. **Redesign - extract common logic to third service**

---

## Database Issues

### Connection Refused

**Symptoms**:
```
Unable to acquire JDBC Connection: Connection refused
```

**Checklist**:

```bash
# 1. Check database is running
docker ps | grep postgres

# 2. Check connectivity
nc -zv localhost 5432

# 3. Check credentials
psql -h localhost -U user -d database
```

```yaml
# 4. Verify configuration
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: ${DB_USER}
    password: ${DB_PASSWORD}
```

### Connection Pool Exhausted

**Symptoms**:
```
HikariPool-1 - Connection is not available, request timed out after 30000ms.
```

**Causes**:
- Long-running transactions
- Connections not being released
- Pool too small for load

**Solutions**:

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20       # Increase if needed
      minimum-idle: 5
      connection-timeout: 30000
      leak-detection-threshold: 60000  # Detect leaks
```

```java
// Ensure connections are released
@Transactional  // Properly manages connection
public void process() { }

// For manual JDBC, use try-with-resources
try (Connection conn = dataSource.getConnection();
     PreparedStatement stmt = conn.prepareStatement(sql)) {
    // Use connection
}  // Auto-closed
```

### Flyway/Liquibase Migration Fails

**Symptoms**:
```
Migration checksum mismatch for migration version 1
```

**Solutions**:

```bash
# For Flyway - repair checksums (development only!)
./gradlew flywayRepair

# Or delete entry from flyway_schema_history
DELETE FROM flyway_schema_history WHERE version = '1';
```

```yaml
# Disable validation in development
spring:
  flyway:
    validate-on-migrate: false  # Dev only!
```

---

## JPA/Hibernate Issues

### LazyInitializationException

**Symptoms**:
```
LazyInitializationException: failed to lazily initialize a collection -
could not initialize proxy - no Session
```

**Cause**: Accessing lazy-loaded data outside transaction/session.

**Solutions**:

1. **Fetch data in service layer**
   ```java
   @Transactional(readOnly = true)
   public OrderDto getOrder(Long id) {
       Order order = repository.findByIdWithItems(id).orElseThrow();
       return mapper.toDto(order);  // Access items within transaction
   }
   ```

2. **Use fetch join**
   ```java
   @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
   Optional<Order> findByIdWithItems(Long id);
   ```

3. **Use EntityGraph**
   ```java
   @EntityGraph(attributePaths = {"items"})
   Optional<Order> findById(Long id);
   ```

4. **Use DTO projection** (best for read-only)
   ```java
   @Query("SELECT new com.example.OrderDto(o.id, o.name) FROM Order o")
   List<OrderDto> findAllAsDto();
   ```

### N+1 Query Problem

**Symptoms**: Slow queries, many similar SQL statements in logs.

**Diagnosis**:

```yaml
# Enable SQL logging
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql: TRACE
```

**Solutions**:

```java
// 1. Fetch join
@Query("SELECT o FROM Order o JOIN FETCH o.customer")
List<Order> findAllWithCustomers();

// 2. EntityGraph
@EntityGraph(attributePaths = {"customer", "items"})
List<Order> findByStatus(OrderStatus status);

// 3. Batch fetching
@BatchSize(size = 25)
@OneToMany(mappedBy = "order")
private List<OrderItem> items;
```

### Detached Entity Passed to Persist

**Symptoms**:
```
PersistentObjectException: detached entity passed to persist
```

**Cause**: Trying to save an entity with an ID already set.

**Solutions**:

```java
// Use merge instead of save for updates
@Transactional
public Order update(Order order) {
    return entityManager.merge(order);  // Works with detached
}

// Or fetch fresh and update
@Transactional
public Order update(Long id, UpdateRequest request) {
    Order order = repository.findById(id).orElseThrow();
    mapper.updateEntity(order, request);
    return repository.save(order);  // Now it's managed
}
```

### OptimisticLockException

**Symptoms**:
```
OptimisticLockException: Row was updated or deleted by another transaction
```

**Cause**: Concurrent modification of same entity.

**Solutions**:

```java
// 1. Retry logic
@Retryable(value = OptimisticLockException.class, maxAttempts = 3)
@Transactional
public Order update(Long id, UpdateRequest request) {
    Order order = repository.findById(id).orElseThrow();
    // Update order
    return repository.save(order);
}

// 2. Pessimistic locking for critical sections
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT o FROM Order o WHERE o.id = :id")
Optional<Order> findByIdForUpdate(Long id);
```

---

## Transaction Issues

### Transaction Not Rolling Back

**Symptoms**: Exception thrown but data still committed.

**Causes & Solutions**:

1. **Unchecked vs Checked exceptions**
   ```java
   // By default, only unchecked exceptions trigger rollback
   @Transactional(rollbackFor = Exception.class)  // Include checked
   public void process() throws MyCheckedException { }
   ```

2. **Exception caught and swallowed**
   ```java
   @Transactional
   public void process() {
       try {
           riskyOperation();
       } catch (Exception e) {
           log.error("Error", e);
           throw e;  // Must re-throw for rollback!
       }
   }
   ```

3. **Self-invocation (no proxy)**
   ```java
   @Service
   public class OrderService {
       public void process() {
           saveOrder();  // @Transactional ignored!
       }

       @Transactional  // Not applied - self call
       public void saveOrder() { }
   }
   ```

   **Fix**: Inject self or restructure:
   ```java
   @Service
   @RequiredArgsConstructor
   public class OrderService {
       private final OrderService self;  // Self injection

       public void process() {
           self.saveOrder();  // Now goes through proxy
       }
   }
   ```

### Transaction on Wrong Method

**Symptoms**: Transactions not working as expected.

**Checklist**:
- ✅ Method is `public`
- ✅ Method is in Spring bean (not `new MyClass()`)
- ✅ Not called from same class (self-invocation)
- ✅ Correct propagation setting

---

## Security Issues

### 403 Forbidden on All Requests

**Symptoms**: All API calls return 403.

**Checklist**:

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        // 1. Check CSRF configuration
        .csrf(csrf -> csrf.disable())  // For APIs (use tokens for web)

        // 2. Check authorization rules
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/public/**").permitAll()
            .requestMatchers("/api/**").authenticated())

        // 3. Check authentication method
        .oauth2ResourceServer(oauth2 -> oauth2.jwt())
        .build();
}
```

### CORS Errors

**Symptoms**:
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution**:

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:3000"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```

### JWT Validation Failures

**Symptoms**:
```
Invalid JWT: The token is expired
Invalid JWT: Invalid signature
```

**Checklist**:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com/realms/myapp  # Check URL
          # Or
          jwk-set-uri: https://auth.example.com/.well-known/jwks.json
```

```bash
# Verify token manually
curl https://auth.example.com/realms/myapp/.well-known/openid-configuration

# Decode token
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq
```

---

## Performance Issues

### Slow Startup

**Diagnosis**:

```yaml
# Enable startup timing
logging:
  level:
    org.springframework.boot.autoconfigure: DEBUG

# Or use startup actuator
management:
  endpoint:
    startup:
      enabled: true
```

**Solutions**:

```yaml
spring:
  jpa:
    defer-datasource-initialization: true
    hibernate:
      ddl-auto: validate  # Not 'update' in production

  main:
    lazy-initialization: true  # Careful with this
```

### High Memory Usage

**Diagnosis**:

```bash
# Enable heap dump on OOM
java -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -jar app.jar

# Analyze with tools
jmap -histo <pid>
```

**Common causes**:
- Large result sets without pagination
- EntityManager not cleared in batch operations
- Session/cache growth

```java
// For batch operations
@Transactional
public void batchProcess(List<Order> orders) {
    for (int i = 0; i < orders.size(); i++) {
        entityManager.persist(orders.get(i));
        if (i % 50 == 0) {
            entityManager.flush();
            entityManager.clear();  // Release memory
        }
    }
}
```

---

## Testing Issues

### Context Not Loading in Tests

**Symptoms**:
```
Failed to load ApplicationContext
```

**Checklist**:

```java
// 1. Use correct test annotation
@SpringBootTest  // Full context
@WebMvcTest(OrderController.class)  // Web layer only
@DataJpaTest  // JPA only

// 2. Mock external dependencies
@MockBean
private ExternalService externalService;

// 3. Use test profile
@ActiveProfiles("test")
```

### Tests Slow

**Solutions**:

```java
// 1. Use test slices instead of @SpringBootTest
@WebMvcTest  // Faster than @SpringBootTest

// 2. Share containers
@Testcontainers
class AbstractIntegrationTest {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>()
        .withReuse(true);  // Reuse between tests
}

// 3. Disable unnecessary auto-configuration
@SpringBootTest
@DisableAutoConfiguration(exclude = {SecurityAutoConfiguration.class})
```

### Testcontainers Not Starting

**Checklist**:

```bash
# 1. Docker running?
docker info

# 2. Docker socket accessible?
ls -la /var/run/docker.sock

# 3. Network issues?
docker pull postgres:16-alpine
```

```properties
# ~/.testcontainers.properties
testcontainers.reuse.enable=true
docker.client.strategy=org.testcontainers.dockerclient.UnixSocketClientProviderStrategy
```

---

## Dependency Issues

### Version Conflicts

**Diagnosis**:

```bash
# Gradle
./gradlew dependencies --configuration compileClasspath

# Maven
mvn dependency:tree
```

**Solutions**:

```kotlin
// Gradle - force version
configurations.all {
    resolutionStrategy {
        force("com.fasterxml.jackson.core:jackson-databind:2.15.2")
    }
}
```

```xml
<!-- Maven - use dependencyManagement -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.15.2</version>
        </dependency>
    </dependencies>
</dependencyManagement>
```

### ClassNotFoundException / NoSuchMethodError

**Cause**: Runtime classpath differs from compile classpath.

**Diagnosis**:

```bash
# Find which JAR contains the class
jar tf myapp.jar | grep ClassName

# Check for multiple versions
./gradlew dependencies | grep jackson
```

**Solution**: Align versions using Spring Boot BOM:

```kotlin
dependencyManagement {
    imports {
        mavenBom("org.springframework.boot:spring-boot-dependencies:3.2.0")
    }
}
```

---

## Quick Diagnostic Commands

```bash
# Check application health
curl localhost:8080/actuator/health | jq

# Check environment
curl localhost:8080/actuator/env | jq

# Check beans
curl localhost:8080/actuator/beans | jq

# Check mappings
curl localhost:8080/actuator/mappings | jq

# Thread dump
curl localhost:8080/actuator/threaddump | jq

# Heap info
curl localhost:8080/actuator/metrics/jvm.memory.used | jq
```
