---
applyTo: "**/*.java,**/pom.xml,**/build.gradle*"
excludeAgent: ""
---

# Lombok & MapStruct Instructions

These instructions apply when using Lombok for boilerplate reduction and MapStruct for object mapping in Spring Boot applications.

## Lombok Setup

### build.gradle.kts
```kotlin
dependencies {
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")
}
```

### Maven pom.xml
```xml
<dependencies>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <scope>provided</scope>
    </dependency>
</dependencies>
```

## Lombok Best Practices

### Entity Class Pattern
```java
@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
@ToString(exclude = {"items", "customer"})
@EqualsAndHashCode(of = "id")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String orderNumber;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    // Custom builder method
    public static class OrderBuilder {
        public OrderBuilder addItem(OrderItem item) {
            if (this.items == null) {
                this.items = new ArrayList<>();
            }
            this.items.add(item);
            return this;
        }
    }
}
```

### Service Class Pattern
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderMapper orderMapper;
    private final ApplicationEventPublisher eventPublisher;

    public OrderDto create(CreateOrderRequest request) {
        log.info("Creating order for customer: {}", request.customerId());
        // Implementation
    }
}
```

### DTO with Builder
```java
@Value
@Builder
public class OrderDto {
    Long id;
    String orderNumber;
    OrderStatus status;
    BigDecimal total;
    Instant createdAt;
    List<OrderItemDto> items;
}
```

### Configuration Properties
```java
@ConfigurationProperties(prefix = "app.orders")
@Getter
@Setter
@Validated
public class OrderProperties {

    @NotNull
    private Duration timeout = Duration.ofSeconds(30);

    @Min(1)
    private int maxRetries = 3;

    @NotBlank
    private String defaultStatus = "PENDING";

    @Valid
    private RetryConfig retry = new RetryConfig();

    @Getter
    @Setter
    public static class RetryConfig {
        private Duration initialDelay = Duration.ofMillis(100);
        private Duration maxDelay = Duration.ofSeconds(5);
        private double multiplier = 2.0;
    }
}
```

## Lombok Annotations Reference

### Recommended Usage
```java
// ✅ Use @RequiredArgsConstructor for constructor injection
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository; // Auto-injected
}

// ✅ Use @Value for immutable DTOs
@Value
public class OrderSummary {
    Long id;
    String orderNumber;
    OrderStatus status;
}

// ✅ Use @Builder for complex object construction
@Builder
public class SearchCriteria {
    private String query;
    private List<String> filters;
    @Builder.Default
    private int page = 0;
    @Builder.Default
    private int size = 20;
}

// ✅ Use @Slf4j for logging
@Slf4j
public class OrderService {
    public void process() {
        log.info("Processing order");
        log.debug("Debug info: {}", details);
    }
}

// ✅ Use @With for immutable updates
@Value
@With
public class OrderState {
    Long orderId;
    OrderStatus status;
    Instant updatedAt;
}

// Usage: newState = oldState.withStatus(OrderStatus.SHIPPED);
```

### Avoid These Patterns
```java
// ❌ Don't use @Data on JPA entities (causes issues with lazy loading)
@Data // BAD
@Entity
public class Order { }

// ❌ Don't use @EqualsAndHashCode without specifying fields for entities
@EqualsAndHashCode // BAD - includes all fields
@Entity
public class Order { }

// ❌ Don't include lazy associations in toString
@ToString // BAD - triggers lazy loading
@Entity
public class Order {
    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;
}
```

## MapStruct Setup

### build.gradle.kts
```kotlin
dependencies {
    implementation("org.mapstruct:mapstruct:1.5.5.Final")
    annotationProcessor("org.mapstruct:mapstruct-processor:1.5.5.Final")

    // Lombok + MapStruct binding (order matters!)
    annotationProcessor("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok-mapstruct-binding:0.2.0")
}
```

### Maven pom.xml
```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <configuration>
                <annotationProcessorPaths>
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                        <version>${lombok.version}</version>
                    </path>
                    <path>
                        <groupId>org.mapstruct</groupId>
                        <artifactId>mapstruct-processor</artifactId>
                        <version>${mapstruct.version}</version>
                    </path>
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok-mapstruct-binding</artifactId>
                        <version>0.2.0</version>
                    </path>
                </annotationProcessorPaths>
            </configuration>
        </plugin>
    </plugins>
</build>
```

## MapStruct Mapper Patterns

### Basic Mapper
```java
@Mapper(componentModel = "spring")
public interface OrderMapper {

    OrderDto toDto(Order order);

    List<OrderDto> toDtoList(List<Order> orders);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", constant = "CREATED")
    @Mapping(target = "createdAt", expression = "java(java.time.Instant.now())")
    Order toEntity(CreateOrderRequest request);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntity(@MappingTarget Order order, UpdateOrderRequest request);
}
```

### Complex Mapper with Custom Methods
```java
@Mapper(
    componentModel = "spring",
    uses = {OrderItemMapper.class, CustomerMapper.class},
    injectionStrategy = InjectionStrategy.CONSTRUCTOR,
    unmappedTargetPolicy = ReportingPolicy.ERROR
)
public interface OrderMapper {

    @Mapping(target = "customerName", source = "customer.name")
    @Mapping(target = "customerEmail", source = "customer.email")
    @Mapping(target = "itemCount", expression = "java(order.getItems().size())")
    @Mapping(target = "formattedTotal", source = "total", qualifiedByName = "formatCurrency")
    OrderDto toDto(Order order);

    @Named("formatCurrency")
    default String formatCurrency(BigDecimal amount) {
        if (amount == null) return null;
        return NumberFormat.getCurrencyInstance(Locale.US).format(amount);
    }

    @AfterMapping
    default void setAdditionalFields(Order order, @MappingTarget OrderDto.OrderDtoBuilder dto) {
        dto.isHighValue(order.getTotal().compareTo(BigDecimal.valueOf(1000)) > 0);
    }
}
```

### Mapper with Decorator
```java
@Mapper(componentModel = "spring")
@DecoratedWith(OrderMapperDecorator.class)
public interface OrderMapper {

    @Mapping(target = "status", ignore = true)
    OrderDto toDto(Order order);
}

public abstract class OrderMapperDecorator implements OrderMapper {

    @Autowired
    @Qualifier("delegate")
    private OrderMapper delegate;

    @Autowired
    private OrderStatusResolver statusResolver;

    @Override
    public OrderDto toDto(Order order) {
        OrderDto dto = delegate.toDto(order);
        // Add custom logic
        return dto.toBuilder()
            .status(statusResolver.resolveDisplayStatus(order))
            .build();
    }
}
```

### Mapper Configuration
```java
@MapperConfig(
    componentModel = "spring",
    injectionStrategy = InjectionStrategy.CONSTRUCTOR,
    unmappedTargetPolicy = ReportingPolicy.ERROR,
    nullValueMappingStrategy = NullValueMappingStrategy.RETURN_DEFAULT,
    nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE
)
public interface MapperConfiguration {
}

// Use in mappers
@Mapper(config = MapperConfiguration.class)
public interface OrderMapper {
    // ...
}
```

### Bi-directional Mapping
```java
@Mapper(componentModel = "spring")
public interface OrderMapper {

    @Mapping(target = "customerId", source = "customer.id")
    OrderDto toDto(Order order);

    @InheritInverseConfiguration
    @Mapping(target = "customer", ignore = true) // Set separately
    @Mapping(target = "items", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Order toEntity(OrderDto dto);
}
```

### Enum Mapping
```java
@Mapper(componentModel = "spring")
public interface StatusMapper {

    @ValueMappings({
        @ValueMapping(source = "PENDING", target = "IN_PROGRESS"),
        @ValueMapping(source = "COMPLETED", target = "DONE"),
        @ValueMapping(source = MappingConstants.ANY_REMAINING, target = "UNKNOWN")
    })
    ExternalStatus toExternalStatus(OrderStatus status);
}
```

## Testing Mappers

```java
@SpringBootTest(classes = {OrderMapperImpl.class, OrderItemMapperImpl.class})
class OrderMapperTest {

    @Autowired
    private OrderMapper orderMapper;

    @Test
    void shouldMapOrderToDto() {
        // Arrange
        var order = Order.builder()
            .id(1L)
            .orderNumber("ORD-123")
            .status(OrderStatus.CREATED)
            .build();

        // Act
        var dto = orderMapper.toDto(order);

        // Assert
        assertThat(dto.getId()).isEqualTo(1L);
        assertThat(dto.getOrderNumber()).isEqualTo("ORD-123");
    }
}
```

## Memory Bank Integration

When using Lombok and MapStruct:

1. **Document patterns**: Add mapping patterns to knowledge base
2. **Configuration**: Add mapper config to project context
3. **Conventions**: Document team conventions for annotations

## What You MUST Do

- Use `@RequiredArgsConstructor` for Spring bean constructor injection
- Configure Lombok-MapStruct binding for correct annotation processing order
- Use `@Value` for immutable DTOs
- Exclude lazy associations from `@ToString`
- Use `@EqualsAndHashCode(of = "id")` for JPA entities

## What You MUST NOT Do

- Use `@Data` on JPA entities
- Include lazy associations in `toString()` or `equals()`/`hashCode()`
- Forget to configure annotation processor order
- Use `@AllArgsConstructor` for Spring beans (use `@RequiredArgsConstructor`)
- Ignore MapStruct unmapped target warnings
