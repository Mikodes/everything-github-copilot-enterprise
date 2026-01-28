# ADR-002: Event-Driven Communication with Kafka

## Status

**Accepted** - 2024-01-05

## Context

With our microservices architecture (ADR-001), we need to define how services communicate with each other. Key requirements:

- **Decoupling**: Services should not have direct dependencies
- **Reliability**: Messages should not be lost
- **Scalability**: Handle high throughput during peak times
- **Auditability**: Ability to replay events for debugging/recovery

Use cases that require async communication:
- Order created → Reserve inventory
- Payment confirmed → Update order status
- Order shipped → Send notification

## Decision

We will use **Apache Kafka** as our event streaming platform with the following patterns:

### Event Types

1. **Domain Events**: Business state changes
   - `OrderCreatedEvent`, `OrderCancelledEvent`
   - `InventoryReservedEvent`, `InventoryReleasedEvent`
   - `PaymentConfirmedEvent`, `PaymentFailedEvent`

2. **Integration Events**: Cross-service communication
   - Contain only necessary data for the consumer
   - Include correlation IDs for tracing

### Topic Strategy

| Topic | Partitions | Retention | Purpose |
|-------|------------|-----------|---------|
| `orders.created` | 6 | 7 days | Order creation events |
| `orders.updated` | 6 | 7 days | Order status changes |
| `inventory.reserved` | 6 | 7 days | Stock reservation |
| `payments.processed` | 6 | 30 days | Payment events |
| `notifications.send` | 3 | 3 days | Notification requests |

### Event Schema

```json
{
  "eventId": "uuid",
  "eventType": "OrderCreatedEvent",
  "timestamp": "2024-01-15T10:30:00Z",
  "correlationId": "request-uuid",
  "source": "order-service",
  "data": {
    "orderId": 123,
    "customerId": 456,
    "total": 99.99
  }
}
```

### Consumer Groups

- Each service has its own consumer group
- Enables independent consumption and replay
- Example: `order-service`, `inventory-service`, `notification-service`

### Error Handling

1. **Retry Topic**: Failed messages go to `{topic}.retry`
2. **Dead Letter Topic**: After 3 retries, go to `{topic}.dlq`
3. **Manual intervention**: Process DLQ messages manually

## Consequences

### Positive

- **Loose coupling**: Services communicate via events, not direct calls
- **Reliability**: Kafka's durability guarantees message delivery
- **Replay capability**: Can reprocess events for recovery
- **Scalability**: Kafka handles high throughput easily
- **Audit trail**: Events provide complete history

### Negative

- **Eventual consistency**: No immediate consistency guarantees
- **Complexity**: Additional infrastructure to manage
- **Debugging difficulty**: Async flows harder to trace
- **Message ordering**: Only guaranteed within partition

### Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Eventual consistency | UI shows pending states, optimistic updates |
| Operational complexity | Managed Kafka (Confluent Cloud) considered |
| Debugging | Distributed tracing with correlation IDs |
| Ordering | Partition by order ID for order-related events |

## Implementation Guidelines

### Publishing Events

```java
@Service
@RequiredArgsConstructor
public class OrderEventPublisher {

    private final StreamBridge streamBridge;

    public void publishOrderCreated(Order order) {
        var event = OrderCreatedEvent.builder()
            .eventId(UUID.randomUUID().toString())
            .orderId(order.getId())
            .customerId(order.getCustomerId())
            .total(order.getTotal())
            .timestamp(Instant.now())
            .build();

        var message = MessageBuilder
            .withPayload(event)
            .setHeader("partitionKey", order.getId().toString())
            .setHeader("correlationId", MDC.get("correlationId"))
            .build();

        streamBridge.send("orderCreated-out-0", message);
    }
}
```

### Consuming Events

```java
@Configuration
public class OrderEventConsumer {

    @Bean
    public Consumer<Message<InventoryReservedEvent>> inventoryReserved(
            OrderService orderService) {
        return message -> {
            var event = message.getPayload();
            var correlationId = message.getHeaders().get("correlationId", String.class);

            MDC.put("correlationId", correlationId);
            try {
                orderService.confirmInventoryReserved(event.getOrderId());
            } finally {
                MDC.remove("correlationId");
            }
        };
    }
}
```

## Alternatives Considered

### RabbitMQ

**Pros**: Simpler setup, better for complex routing
**Cons**: Less scalable, no replay capability
**Why rejected**: Need event replay for recovery scenarios

### Direct REST Calls with Retry

**Pros**: Simpler architecture, immediate consistency
**Cons**: Tight coupling, cascade failures
**Why rejected**: Doesn't meet decoupling requirements

### AWS SQS/SNS

**Pros**: Managed service, no infrastructure
**Cons**: Vendor lock-in, less control
**Why rejected**: Multi-cloud requirement

## References

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Spring Cloud Stream](https://spring.io/projects/spring-cloud-stream)
- [Event-Driven Microservices](https://www.oreilly.com/library/view/building-event-driven-microservices/9781492057888/)

---

*Decision made by: Tech Lead, Senior Engineer*
