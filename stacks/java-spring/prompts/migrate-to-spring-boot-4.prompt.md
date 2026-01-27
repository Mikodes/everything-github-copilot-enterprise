---
name: migrate-to-spring-boot-4
description: Guide for migrating a Spring Boot 3.x application to Spring Boot 4.x
---

# Migrate to Spring Boot 4

Step-by-step guide for migrating a Spring Boot 3.x application to Spring Boot 4.x with minimal disruption.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Check current Spring Boot version and dependencies
3. Identify Java version (must be 21+)

## Input

```
Current Version: {current Spring Boot version, e.g., "3.2.0"}
Java Version: {current Java version}
Dependencies: {list of key dependencies to check compatibility}
Features Used: {WebMvc/WebFlux, JPA, Security, Cloud, etc.}
```

## Pre-Migration Checklist

### 1. Verify Prerequisites

```bash
# Check Java version (must be 21+)
java --version

# Check current Spring Boot version
./gradlew dependencies | grep spring-boot

# Or Maven
mvn dependency:tree | grep spring-boot
```

### 2. Update Java Version

If on Java 17, upgrade to Java 21:

```kotlin
// build.gradle.kts
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
```

```xml
<!-- pom.xml -->
<properties>
    <java.version>21</java.version>
</properties>
```

## Migration Steps

### Step 1: Update Spring Boot Version

#### Gradle
```kotlin
// build.gradle.kts
plugins {
    id("org.springframework.boot") version "4.0.0"
    id("io.spring.dependency-management") version "1.1.4"
}
```

#### Maven
```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.0.0</version>
</parent>
```

### Step 2: Update Spring Cloud (if used)

```kotlin
// build.gradle.kts
dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2024.0.0")
    }
}
```

### Step 3: Enable Virtual Threads

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true
```

### Step 4: Update to New REST Client

#### Before (WebClient for non-reactive)
```java
@Service
public class UserService {
    private final WebClient webClient;

    public User getUser(Long id) {
        return webClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .bodyToMono(User.class)
            .block();
    }
}
```

#### After (RestClient - simpler for blocking)
```java
@Service
public class UserService {
    private final RestClient restClient;

    public User getUser(Long id) {
        return restClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .body(User.class);
    }
}
```

### Step 5: Update to HTTP Interface Clients

#### Before (Feign or manual WebClient)
```java
@FeignClient(name = "users")
public interface UserClient {
    @GetMapping("/users/{id}")
    User getUser(@PathVariable Long id);
}
```

#### After (HTTP Interface)
```java
public interface UserClient {
    @GetExchange("/users/{id}")
    User getUser(@PathVariable Long id);
}

@Configuration
public class ClientConfig {
    @Bean
    public UserClient userClient(RestClient.Builder builder) {
        RestClient restClient = builder.baseUrl("http://user-service").build();
        return HttpServiceProxyFactory
            .builderFor(RestClientAdapter.create(restClient))
            .build()
            .createClient(UserClient.class);
    }
}
```

### Step 6: Update Security Configuration

#### Before (Spring Security 6.x pattern)
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/public/**").permitAll()
            .anyRequest().authenticated());
    return http.build();
}
```

#### After (mostly unchanged, but verify)
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/public/**").permitAll()
            .anyRequest().authenticated())
        .build();
}
```

### Step 7: Update to Problem Details

#### Before
```java
@ExceptionHandler(OrderNotFoundException.class)
@ResponseStatus(HttpStatus.NOT_FOUND)
public ErrorResponse handleNotFound(OrderNotFoundException ex) {
    return new ErrorResponse(404, ex.getMessage());
}
```

#### After
```java
@ExceptionHandler(OrderNotFoundException.class)
public ProblemDetail handleNotFound(OrderNotFoundException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.NOT_FOUND,
        ex.getMessage()
    );
    problem.setTitle("Order Not Found");
    problem.setProperty("orderId", ex.getOrderId());
    return problem;
}
```

### Step 8: Update JDBC to JdbcClient

#### Before
```java
@Repository
public class OrderRepository {
    private final JdbcTemplate jdbc;

    public Optional<Order> findById(Long id) {
        return jdbc.query(
            "SELECT * FROM orders WHERE id = ?",
            (rs, row) -> mapOrder(rs),
            id
        ).stream().findFirst();
    }
}
```

#### After
```java
@Repository
public class OrderRepository {
    private final JdbcClient jdbc;

    public Optional<Order> findById(Long id) {
        return jdbc.sql("SELECT * FROM orders WHERE id = :id")
            .param("id", id)
            .query(Order.class)
            .optional();
    }
}
```

### Step 9: Update Testcontainers

#### Before
```java
@Container
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

@DynamicPropertySource
static void configureProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
}
```

#### After
```java
@Container
@ServiceConnection
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");
// No @DynamicPropertySource needed!
```

### Step 10: Update Observability

```yaml
# application.yml
management:
  observations:
    key-values:
      application: ${spring.application.name}
  tracing:
    sampling:
      probability: 1.0
```

## Deprecated APIs to Remove

| Deprecated | Replacement |
|------------|-------------|
| `WebClient.block()` for non-reactive | `RestClient` |
| `RestTemplate` | `RestClient` |
| `@EnableWebMvc` (mostly) | Auto-configuration |
| `spring.config.import=configserver:` | Check new patterns |
| `MockMvc.perform().andDo(print())` | Usually not needed |

## Dependency Updates

### Check Compatibility

| Dependency | Min Version for SB4 |
|------------|---------------------|
| Spring Security | 7.0+ |
| Spring Data | 2024.0+ |
| Hibernate | 7.0+ |
| Flyway | 10+ |
| Liquibase | 4.25+ |
| Testcontainers | 1.19+ |
| MapStruct | 1.5.5+ |
| Lombok | 1.18.30+ |

### Update Script (Gradle)
```kotlin
// Check for updates
./gradlew dependencyUpdates
```

## Testing the Migration

### 1. Compile Check
```bash
./gradlew clean build -x test
```

### 2. Run Tests
```bash
./gradlew test
```

### 3. Check for Runtime Issues
```bash
./gradlew bootRun
```

### 4. Check Actuator Endpoints
```bash
curl http://localhost:8080/actuator/health
```

## Rollback Plan

If issues occur:

1. Revert version changes in build file
2. Restore any removed deprecated code
3. Run full test suite
4. Document issues found for future attempt

## Post-Migration

### Enable New Features

```yaml
spring:
  threads:
    virtual:
      enabled: true

management:
  httpexchanges:
    recording:
      enabled: true
```

### Performance Comparison

Run load tests before and after:

```bash
# Using wrk
wrk -t12 -c400 -d30s http://localhost:8080/api/orders
```

## Output Checklist

Ensure migration is complete:

- [ ] Spring Boot 4.x in build file
- [ ] Java 21 configured
- [ ] Virtual threads enabled
- [ ] RestClient replacing WebClient (for blocking)
- [ ] HTTP Interface clients configured
- [ ] Problem Details for errors
- [ ] JdbcClient replacing JdbcTemplate
- [ ] @ServiceConnection for Testcontainers
- [ ] All tests passing
- [ ] Application starts successfully
- [ ] Actuator endpoints working

## Memory Bank Updates

After migration:

- [ ] Update project context with new version
- [ ] Create ADR documenting migration decision
- [ ] Document any breaking changes encountered
- [ ] Update knowledge base with new patterns

## Example Usage

**User**: Migrate my Spring Boot 3.2 application to Spring Boot 4

**Response**:
[Provides detailed migration steps specific to the application's dependencies and features]
