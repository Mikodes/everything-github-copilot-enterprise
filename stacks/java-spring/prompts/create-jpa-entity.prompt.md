---
name: create-jpa-entity
description: Generate a JPA entity with proper mapping, relationships, and lifecycle methods
---

# Create JPA Entity

Generate a JPA entity following best practices for mapping, relationships, and performance.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Check existing entity patterns in the codebase
3. Understand the database schema or requirements

## Input

```
Entity Name: {name of the entity, e.g., "Order", "Customer", "Product"}
Table Name: {database table name}
Fields: {list of fields with types}
Relationships: {ManyToOne, OneToMany, ManyToMany relationships}
Indexes: {columns to index}
Constraints: {unique constraints, checks}
Auditing: {true/false - include audit fields}
Soft Delete: {true/false - include soft delete}
```

## Generation Process

### 1. Basic Entity Structure

```java
@Entity
@Table(
    name = "${table_name}",
    indexes = {
        @Index(name = "idx_${table}_customer", columnList = "customer_id"),
        @Index(name = "idx_${table}_status", columnList = "status"),
        @Index(name = "idx_${table}_created", columnList = "created_at")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_${table}_number", columnNames = {"${unique_field}"})
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
@ToString(exclude = {"items", "customer"})
@EqualsAndHashCode(of = "id")
public class ${EntityName} {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Fields...
}
```

### 2. Field Mappings

```java
// String field with constraints
@Column(name = "order_number", nullable = false, unique = true, length = 50)
private String orderNumber;

// Enum field
@Enumerated(EnumType.STRING)
@Column(nullable = false, length = 20)
private OrderStatus status;

// Numeric field with precision
@Column(nullable = false, precision = 19, scale = 4)
private BigDecimal total;

// Boolean field
@Column(nullable = false)
@Builder.Default
private Boolean active = true;

// JSON field (PostgreSQL)
@Column(columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
private Map<String, Object> metadata;

// Large text
@Lob
@Column(columnDefinition = "text")
private String description;
```

### 3. Temporal Fields

```java
// Creation timestamp (auto-set)
@CreationTimestamp
@Column(name = "created_at", nullable = false, updatable = false)
private Instant createdAt;

// Update timestamp (auto-update)
@UpdateTimestamp
@Column(name = "updated_at", nullable = false)
private Instant updatedAt;

// Manual date fields
@Column(name = "due_date")
private LocalDate dueDate;

@Column(name = "scheduled_at")
private LocalDateTime scheduledAt;
```

### 4. Relationships

#### ManyToOne (Owning Side)
```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "customer_id", nullable = false,
    foreignKey = @ForeignKey(name = "fk_order_customer"))
private Customer customer;
```

#### OneToMany (Inverse Side)
```java
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
@OrderBy("createdAt ASC")
@Builder.Default
private List<OrderItem> items = new ArrayList<>();

// Helper methods for bidirectional relationship
public void addItem(OrderItem item) {
    items.add(item);
    item.setOrder(this);
}

public void removeItem(OrderItem item) {
    items.remove(item);
    item.setOrder(null);
}
```

#### ManyToMany
```java
@ManyToMany
@JoinTable(
    name = "product_categories",
    joinColumns = @JoinColumn(name = "product_id"),
    inverseJoinColumns = @JoinColumn(name = "category_id"),
    foreignKey = @ForeignKey(name = "fk_product_category_product"),
    inverseForeignKey = @ForeignKey(name = "fk_product_category_category")
)
@Builder.Default
private Set<Category> categories = new HashSet<>();

public void addCategory(Category category) {
    categories.add(category);
    category.getProducts().add(this);
}

public void removeCategory(Category category) {
    categories.remove(category);
    category.getProducts().remove(this);
}
```

### 5. Embedded Objects

```java
@Embedded
@AttributeOverrides({
    @AttributeOverride(name = "street", column = @Column(name = "billing_street")),
    @AttributeOverride(name = "city", column = @Column(name = "billing_city")),
    @AttributeOverride(name = "postalCode", column = @Column(name = "billing_postal_code")),
    @AttributeOverride(name = "country", column = @Column(name = "billing_country"))
})
private Address billingAddress;

// Embeddable class
@Embeddable
@Getter
@Setter
@NoArgsConstructor
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
```

### 6. Optimistic Locking

```java
@Version
private Long version;
```

### 7. Auditing with Spring Data

```java
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

// Entity extends auditable
@Entity
public class Order extends AuditableEntity {
    // Entity fields
}
```

### 8. Soft Delete

```java
@Entity
@SQLDelete(sql = "UPDATE orders SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Order {

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public boolean isDeleted() {
        return deletedAt != null;
    }
}
```

### 9. Business Methods

```java
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

// Business logic
public void submit() {
    if (status != OrderStatus.CREATED) {
        throw new IllegalStateException("Can only submit orders in CREATED status");
    }
    if (items.isEmpty()) {
        throw new IllegalStateException("Cannot submit empty order");
    }
    this.status = OrderStatus.SUBMITTED;
}

public boolean canCancel() {
    return status == OrderStatus.CREATED || status == OrderStatus.SUBMITTED;
}

public void cancel(String reason) {
    if (!canCancel()) {
        throw new IllegalStateException("Cannot cancel order in status: " + status);
    }
    this.status = OrderStatus.CANCELLED;
}

// Calculation method
private void calculateTotal() {
    this.total = items.stream()
        .map(OrderItem::getSubtotal)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
}
```

### 10. Complete Entity Example

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
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
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
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    // Business methods...
}
```

## Output Checklist

Ensure the generated entity has:

- [ ] Proper `@Entity` and `@Table` annotations
- [ ] Indexes for frequently queried columns
- [ ] LAZY fetch type for all associations
- [ ] `@Version` for optimistic locking
- [ ] Audit fields or extends AuditableEntity
- [ ] Helper methods for bidirectional relationships
- [ ] `@ToString(exclude = ...)` for lazy associations
- [ ] `@EqualsAndHashCode(of = "id")`
- [ ] Protected no-args constructor
- [ ] Factory methods for object creation
- [ ] Business methods with validation

## Memory Bank Updates

After generating the entity:

- [ ] Add entity diagram to module context
- [ ] Document relationships in knowledge base
- [ ] Update data model documentation

## Example Usage

**User**: Create an Order entity with customer relationship and order items

**Response**:
[Generates complete Order entity with all mappings, relationships, and business methods]
