---
applyTo: "**/*.java,**/application*.yml"
excludeAgent: ""
---

# Virtual Threads (Project Loom) Instructions

These instructions apply when using Virtual Threads in Java 21+ with Spring Boot applications.

## Overview

Virtual Threads are lightweight threads that enable high-throughput concurrent applications with minimal resource overhead. They are ideal for I/O-bound workloads where threads spend most of their time waiting.

## Enabling Virtual Threads in Spring Boot

### Spring Boot 3.2+ Configuration
```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true

# For Tomcat specifically
server:
  tomcat:
    threads:
      max: 200  # Still useful as a safety limit
```

### Programmatic Configuration
```java
@Configuration
public class VirtualThreadConfig {

    // For Tomcat
    @Bean
    public TomcatProtocolHandlerCustomizer<?> tomcatVirtualThreads() {
        return protocolHandler -> {
            protocolHandler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        };
    }

    // For custom async operations
    @Bean
    public AsyncTaskExecutor applicationTaskExecutor() {
        return new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor());
    }

    // For @Scheduled tasks
    @Bean
    public TaskScheduler taskScheduler() {
        return new SimpleAsyncTaskScheduler();
    }
}
```

## When to Use Virtual Threads

### Good Use Cases

```java
// ✅ I/O-bound operations - database queries
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    public List<Order> getOrdersForCustomers(List<Long> customerIds) {
        // Each call blocks waiting for database - perfect for virtual threads
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<List<Order>>> futures = customerIds.stream()
                .map(customerId -> executor.submit(() ->
                    orderRepository.findByCustomerId(customerId)))
                .toList();

            return futures.stream()
                .map(this::getResult)
                .flatMap(List::stream)
                .toList();
        }
    }

    private <T> T getResult(Future<T> future) {
        try {
            return future.get();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

// ✅ HTTP client calls
@Service
@RequiredArgsConstructor
public class ExternalApiService {

    private final RestClient restClient;

    public List<ProductInfo> fetchProductDetails(List<String> productIds) {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            return productIds.stream()
                .map(id -> executor.submit(() -> fetchProduct(id)))
                .map(this::getResult)
                .toList();
        }
    }

    private ProductInfo fetchProduct(String productId) {
        return restClient.get()
            .uri("/products/{id}", productId)
            .retrieve()
            .body(ProductInfo.class);
    }
}

// ✅ File I/O operations
public List<String> readMultipleFiles(List<Path> paths) {
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        return paths.stream()
            .map(path -> executor.submit(() -> Files.readString(path)))
            .map(this::getResult)
            .toList();
    }
}
```

### When NOT to Use Virtual Threads

```java
// ❌ CPU-bound tasks - virtual threads don't help here
public class CpuIntensiveService {

    // Use platform threads with ForkJoinPool instead
    public List<BigInteger> computeFactorials(List<Integer> numbers) {
        return numbers.parallelStream() // Uses ForkJoinPool
            .map(this::factorial)
            .toList();
    }

    private BigInteger factorial(int n) {
        // Pure CPU computation
        BigInteger result = BigInteger.ONE;
        for (int i = 2; i <= n; i++) {
            result = result.multiply(BigInteger.valueOf(i));
        }
        return result;
    }
}

// ❌ Synchronized blocks with long waits - pins the carrier thread
public class ProblematicService {

    private final Object lock = new Object();

    public void badPattern() {
        synchronized (lock) {  // PINS carrier thread!
            performLongIoOperation();
        }
    }

    // ✅ Use ReentrantLock instead
    private final ReentrantLock reentrantLock = new ReentrantLock();

    public void goodPattern() {
        reentrantLock.lock();
        try {
            performLongIoOperation();
        } finally {
            reentrantLock.unlock();
        }
    }
}
```

## Structured Concurrency (Preview)

```java
// Enable preview features: --enable-preview
public class StructuredConcurrencyExample {

    public OrderWithDetails fetchOrderWithDetails(Long orderId) throws Exception {
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            // Fork subtasks
            Subtask<Order> orderTask = scope.fork(() ->
                orderRepository.findById(orderId).orElseThrow());
            Subtask<Customer> customerTask = scope.fork(() ->
                customerService.getCustomer(order.getCustomerId()));
            Subtask<List<Product>> productsTask = scope.fork(() ->
                productService.getProducts(order.getProductIds()));

            // Wait for all to complete or one to fail
            scope.join();
            scope.throwIfFailed();

            // Combine results
            return new OrderWithDetails(
                orderTask.get(),
                customerTask.get(),
                productsTask.get()
            );
        }
    }

    // ShutdownOnSuccess - return first successful result
    public Product findProductFromAnySource(String productId) throws Exception {
        try (var scope = new StructuredTaskScope.ShutdownOnSuccess<Product>()) {
            scope.fork(() -> primaryCatalog.findProduct(productId));
            scope.fork(() -> secondaryCatalog.findProduct(productId));
            scope.fork(() -> fallbackCatalog.findProduct(productId));

            scope.join();
            return scope.result();
        }
    }
}
```

## Best Practices

### Thread Local Alternatives

```java
// ❌ ThreadLocal with virtual threads can cause issues
// Each virtual thread gets its own copy - memory overhead with millions of threads
private static final ThreadLocal<DateFormat> dateFormat =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

// ✅ Use ScopedValue (Preview) instead
private static final ScopedValue<RequestContext> REQUEST_CONTEXT = ScopedValue.newInstance();

public void processRequest(RequestContext context) {
    ScopedValue.where(REQUEST_CONTEXT, context)
        .run(() -> {
            // Access context anywhere in call stack
            var ctx = REQUEST_CONTEXT.get();
            handleRequest(ctx);
        });
}

// ✅ Or use method parameters / dependency injection
public void processWithContext(RequestContext context) {
    service.process(context);
}
```

### Executor Patterns

```java
@Configuration
public class ExecutorConfig {

    // ✅ Virtual thread executor for I/O operations
    @Bean("virtualExecutor")
    public ExecutorService virtualThreadExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    // ✅ Platform thread pool for CPU-bound operations
    @Bean("cpuExecutor")
    public ExecutorService cpuBoundExecutor() {
        return Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors()
        );
    }
}

@Service
@RequiredArgsConstructor
public class HybridService {

    @Qualifier("virtualExecutor")
    private final ExecutorService virtualExecutor;

    @Qualifier("cpuExecutor")
    private final ExecutorService cpuExecutor;

    public ProcessingResult process(List<DataItem> items) {
        // I/O operations on virtual threads
        List<Future<EnrichedData>> enrichmentFutures = items.stream()
            .map(item -> virtualExecutor.submit(() -> fetchExternalData(item)))
            .toList();

        List<EnrichedData> enrichedData = enrichmentFutures.stream()
            .map(this::getResult)
            .toList();

        // CPU operations on platform threads
        List<Future<ProcessedData>> processingFutures = enrichedData.stream()
            .map(data -> cpuExecutor.submit(() -> heavyComputation(data)))
            .toList();

        return combineResults(processingFutures);
    }
}
```

### Database Connection Pool Sizing

```yaml
# With virtual threads, you can have many more concurrent requests
# But database connections are still limited!
spring:
  datasource:
    hikari:
      maximum-pool-size: 50  # Database-side limit
      minimum-idle: 10
      connection-timeout: 30000

  # Semaphore to limit concurrent database operations
  # if pool exhaustion is an issue
```

```java
@Service
public class DatabaseBoundService {

    private final Semaphore dbSemaphore = new Semaphore(50);
    private final OrderRepository repository;

    public Order getOrder(Long id) {
        try {
            dbSemaphore.acquire();
            return repository.findById(id).orElseThrow();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceException("Interrupted", e);
        } finally {
            dbSemaphore.release();
        }
    }
}
```

## Monitoring Virtual Threads

```java
@Component
@Slf4j
public class VirtualThreadMonitor {

    @Scheduled(fixedRate = 60000)
    public void logVirtualThreadStats() {
        // JFR events for virtual threads
        // Enable with: -XX:StartFlightRecording=name=vt,filename=vt.jfr

        // Thread dump includes virtual threads in Java 21+
        // Use: jcmd <pid> Thread.dump_to_file -format=json threads.json
    }
}
```

### JFR Configuration
```
# Enable virtual thread events
jdk.VirtualThreadStart#enabled=true
jdk.VirtualThreadEnd#enabled=true
jdk.VirtualThreadPinned#enabled=true
jdk.VirtualThreadSubmitFailed#enabled=true
```

## Migration from Platform Threads

```java
// Before: Platform thread pool
@Bean
public ExecutorService taskExecutor() {
    return Executors.newFixedThreadPool(100);
}

// After: Virtual threads (much simpler!)
@Bean
public ExecutorService taskExecutor() {
    return Executors.newVirtualThreadPerTaskExecutor();
}

// Before: Reactive for high concurrency
public Mono<Order> getOrder(Long id) {
    return orderRepository.findById(id);
}

// After: Blocking code with virtual threads (simpler!)
public Order getOrder(Long id) {
    return orderRepository.findById(id).orElseThrow();
}
```

## Memory Bank Integration

When using Virtual Threads:

1. **Document thread strategy**: Add virtual thread usage to project context
2. **Pinning issues**: Document any carrier thread pinning discovered
3. **Performance results**: Add benchmarks to knowledge base

## What You MUST Do

- Enable virtual threads for I/O-bound Spring Boot applications
- Use `ReentrantLock` instead of `synchronized` for long operations
- Size database connection pools appropriately
- Monitor for carrier thread pinning
- Use Structured Concurrency for related subtasks

## What You MUST NOT Do

- Use virtual threads for CPU-bound tasks
- Use `synchronized` blocks around I/O operations
- Create unlimited virtual threads without backpressure
- Assume ThreadLocal is free (use ScopedValue)
- Ignore connection pool sizing
