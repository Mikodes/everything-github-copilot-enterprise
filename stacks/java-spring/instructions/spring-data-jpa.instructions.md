---
applyTo: "**/*.java,**/application*.yml"
excludeAgent: ""
---

# Spring Data JPA Instructions

These instructions apply when using Spring Data JPA for data access in Spring Boot applications.

## Entity Design

### Standard Entity Structure
```java
@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_order_customer", columnList = "customer_id"),
    @Index(name = "idx_order_status", columnList = "status"),
    @Index(name = "idx_order_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(exclude = {"items", "customer"})
@EqualsAndHashCode(of = "id")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal total;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<OrderItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    // Factory method
    public static Order create(Customer customer, List<OrderItem> items) {
        var order = new Order();
        order.setOrderNumber(generateOrderNumber());
        order.setStatus(OrderStatus.CREATED);
        order.setCustomer(customer);
        items.forEach(order::addItem);
        order.calculateTotal();
        return order;
    }

    // Business methods
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
        calculateTotal();
    }

    public void removeItem(OrderItem item) {
        items.remove(item);
        item.setOrder(null);
        calculateTotal();
    }

    private void calculateTotal() {
        this.total = items.stream()
            .map(OrderItem::getSubtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String generateOrderNumber() {
        return "ORD-" + System.currentTimeMillis();
    }
}
```

### Embedded Value Objects
```java
@Embeddable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Address {

    @Column(length = 100)
    private String street;

    @Column(length = 50)
    private String city;

    @Column(length = 10)
    private String postalCode;

    @Column(length = 2)
    private String country;
}

@Entity
public class Customer {

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "street", column = @Column(name = "billing_street")),
        @AttributeOverride(name = "city", column = @Column(name = "billing_city")),
        @AttributeOverride(name = "postalCode", column = @Column(name = "billing_postal_code")),
        @AttributeOverride(name = "country", column = @Column(name = "billing_country"))
    })
    private Address billingAddress;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "street", column = @Column(name = "shipping_street")),
        @AttributeOverride(name = "city", column = @Column(name = "shipping_city")),
        @AttributeOverride(name = "postalCode", column = @Column(name = "shipping_postal_code")),
        @AttributeOverride(name = "country", column = @Column(name = "shipping_country"))
    })
    private Address shippingAddress;
}
```

## Repository Design

### Standard Repository
```java
public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    // Query derivation
    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);

    Optional<Order> findByOrderNumber(String orderNumber);

    boolean existsByOrderNumber(String orderNumber);

    long countByStatus(OrderStatus status);

    // JPQL with fetch joins (prevents N+1)
    @Query("""
        SELECT DISTINCT o FROM Order o
        LEFT JOIN FETCH o.items
        WHERE o.id = :id
        """)
    Optional<Order> findByIdWithItems(@Param("id") Long id);

    @Query("""
        SELECT o FROM Order o
        JOIN FETCH o.customer c
        WHERE o.status = :status
        ORDER BY o.createdAt DESC
        """)
    List<Order> findByStatusWithCustomer(@Param("status") OrderStatus status);

    // Paginated with fetch (requires countQuery)
    @Query(value = """
        SELECT o FROM Order o
        JOIN FETCH o.customer
        WHERE o.status = :status
        """,
        countQuery = "SELECT COUNT(o) FROM Order o WHERE o.status = :status")
    Page<Order> findByStatusPageable(@Param("status") OrderStatus status, Pageable pageable);

    // Native query for complex operations
    @Query(value = """
        SELECT o.* FROM orders o
        WHERE o.created_at >= :since
        AND o.status IN (:statuses)
        ORDER BY o.total DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Order> findTopOrdersSince(
        @Param("since") Instant since,
        @Param("statuses") List<String> statuses,
        @Param("limit") int limit
    );

    // Modifying queries
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Order o SET o.status = :status WHERE o.id IN :ids")
    int bulkUpdateStatus(@Param("status") OrderStatus status, @Param("ids") List<Long> ids);

    @Modifying
    @Query("DELETE FROM Order o WHERE o.status = :status AND o.createdAt < :before")
    int deleteOldOrders(@Param("status") OrderStatus status, @Param("before") Instant before);
}
```

### Projections

```java
// Interface projection (best performance for read-only)
public interface OrderSummary {
    Long getId();
    String getOrderNumber();
    OrderStatus getStatus();
    BigDecimal getTotal();
    Instant getCreatedAt();

    // Nested projection
    CustomerInfo getCustomer();

    interface CustomerInfo {
        Long getId();
        String getName();
    }
}

// DTO projection with constructor
public record OrderDto(
    Long id,
    String orderNumber,
    OrderStatus status,
    BigDecimal total,
    String customerName
) {}

// Repository methods
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Interface projection
    List<OrderSummary> findSummariesByStatus(OrderStatus status);

    // DTO projection
    @Query("""
        SELECT new com.example.dto.OrderDto(
            o.id, o.orderNumber, o.status, o.total, c.name
        )
        FROM Order o
        JOIN o.customer c
        WHERE o.status = :status
        """)
    List<OrderDto> findDtosByStatus(@Param("status") OrderStatus status);

    // Dynamic projection
    <T> List<T> findByStatus(OrderStatus status, Class<T> type);
}
```

### Specifications for Dynamic Queries

```java
public class OrderSpecifications {

    public static Specification<Order> hasStatus(OrderStatus status) {
        return (root, query, cb) ->
            status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<Order> hasCustomer(Long customerId) {
        return (root, query, cb) ->
            customerId == null ? null : cb.equal(root.get("customer").get("id"), customerId);
    }

    public static Specification<Order> createdBetween(Instant from, Instant to) {
        return (root, query, cb) -> {
            if (from == null && to == null) return null;
            if (from != null && to != null) {
                return cb.between(root.get("createdAt"), from, to);
            }
            if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("createdAt"), from);
            }
            return cb.lessThanOrEqualTo(root.get("createdAt"), to);
        };
    }

    public static Specification<Order> totalGreaterThan(BigDecimal minTotal) {
        return (root, query, cb) ->
            minTotal == null ? null : cb.greaterThan(root.get("total"), minTotal);
    }

    public static Specification<Order> withFetchedCustomer() {
        return (root, query, cb) -> {
            if (Long.class != query.getResultType()) {
                root.fetch("customer", JoinType.LEFT);
            }
            return null;
        };
    }
}

// Usage in service
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    public Page<Order> search(OrderSearchCriteria criteria, Pageable pageable) {
        Specification<Order> spec = Specification.where(null)
            .and(OrderSpecifications.hasStatus(criteria.status()))
            .and(OrderSpecifications.hasCustomer(criteria.customerId()))
            .and(OrderSpecifications.createdBetween(criteria.from(), criteria.to()))
            .and(OrderSpecifications.totalGreaterThan(criteria.minTotal()))
            .and(OrderSpecifications.withFetchedCustomer());

        return orderRepository.findAll(spec, pageable);
    }
}
```

## Transaction Management

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true) // Default: read-only
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final InventoryService inventoryService;
    private final EntityManager entityManager;

    // Read operations use class-level readOnly
    public Optional<OrderDto> findById(Long id) {
        return orderRepository.findById(id).map(this::toDto);
    }

    // Write operations override
    @Transactional
    public OrderDto create(CreateOrderRequest request) {
        var order = Order.create(request.customer(), request.items());
        return toDto(orderRepository.save(order));
    }

    // Explicit isolation level
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void processPayment(Long orderId) {
        var order = orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
        // Process with repeatable read isolation
    }

    // Rollback rules
    @Transactional(
        rollbackFor = {PaymentException.class, InventoryException.class},
        noRollbackFor = {NotificationException.class}
    )
    public OrderDto processOrder(Long orderId) {
        // Custom rollback behavior
    }

    // Programmatic transaction
    @Transactional
    public void batchProcess(List<Long> orderIds) {
        for (int i = 0; i < orderIds.size(); i++) {
            processOrder(orderIds.get(i));

            // Flush and clear periodically for large batches
            if (i % 50 == 0) {
                entityManager.flush();
                entityManager.clear();
            }
        }
    }
}
```

## Performance Configuration

### application.yml
```yaml
spring:
  jpa:
    open-in-view: false  # ALWAYS disable in production
    properties:
      hibernate:
        # Batch operations
        jdbc:
          batch_size: 50
          batch_versioned_data: true
        order_inserts: true
        order_updates: true

        # Statistics (development only)
        generate_statistics: ${JPA_STATS:false}

        # Second level cache
        cache:
          use_second_level_cache: true
          region.factory_class: org.hibernate.cache.jcache.JCacheRegionFactory
        javax:
          cache:
            provider: org.ehcache.jsr107.EhcacheCachingProvider

        # Query plan cache
        query:
          plan_cache_max_size: 2048
          plan_parameter_metadata_max_size: 128

  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      leak-detection-threshold: 60000
```

## Auditing

```java
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext())
            .map(SecurityContext::getAuthentication)
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getName);
    }
}

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public abstract class AuditableEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by", length = 100)
    private String updatedBy;
}

@Entity
public class Order extends AuditableEntity {
    // Entity fields
}
```

## Memory Bank Integration

When using Spring Data JPA:

1. **Document patterns**: Add entity design patterns to knowledge base
2. **Performance issues**: Document resolved N+1 and performance issues
3. **Schema decisions**: Create ADRs for significant schema changes

## What You MUST Do

- Always use `FetchType.LAZY` for associations
- Disable `spring.jpa.open-in-view` in production
- Use projections for read-only queries
- Add indexes for frequently queried columns
- Use `@Version` for optimistic locking
- Configure batch operations for bulk processing

## What You MUST NOT Do

- Use `EAGER` fetching on collections
- Enable Open Session in View in production
- Use entities directly in API responses
- Ignore N+1 query problems
- Create bidirectional relationships without helper methods
- Use `findAll()` without pagination on large tables
