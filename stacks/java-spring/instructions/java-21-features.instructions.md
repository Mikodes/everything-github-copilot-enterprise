---
applyTo: "**/*.java"
excludeAgent: ""
---

# Java 21 Features Instructions

These instructions apply when writing Java code targeting Java 21 (LTS). Java 21 introduces several important features that improve code readability, performance, and developer experience.

## Virtual Threads (Project Loom)

Virtual threads are lightweight threads that dramatically reduce the effort of writing, maintaining, and observing high-throughput concurrent applications.

### When to Use Virtual Threads

```java
// ✅ Use for I/O-bound tasks
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> futures = urls.stream()
        .map(url -> executor.submit(() -> fetchUrl(url)))
        .toList();

    for (Future<String> future : futures) {
        String result = future.get();
        process(result);
    }
}

// ✅ Use with Spring Boot 3.2+
// application.yml
spring:
  threads:
    virtual:
      enabled: true
```

### When NOT to Use Virtual Threads

```java
// ❌ Don't use for CPU-bound tasks
// Virtual threads don't help with CPU-intensive work
// Use platform threads with ForkJoinPool instead

// ❌ Don't use synchronized blocks with long waits
synchronized (lock) {
    // This pins the carrier thread
    performLongOperation();
}

// ✅ Use ReentrantLock instead
lock.lock();
try {
    performLongOperation();
} finally {
    lock.unlock();
}
```

## Record Patterns (Pattern Matching)

### Destructuring in instanceof
```java
// ❌ Old style
if (obj instanceof Point) {
    Point p = (Point) obj;
    System.out.println(p.x() + ", " + p.y());
}

// ✅ Java 21 - Pattern matching with destructuring
if (obj instanceof Point(int x, int y)) {
    System.out.println(x + ", " + y);
}

// ✅ Nested patterns
if (obj instanceof Line(Point(int x1, int y1), Point(int x2, int y2))) {
    double length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}
```

### Pattern Matching in Switch
```java
// ✅ Exhaustive switch with records
sealed interface Shape permits Circle, Rectangle, Triangle {}
record Circle(double radius) implements Shape {}
record Rectangle(double width, double height) implements Shape {}
record Triangle(double base, double height) implements Shape {}

double area = switch (shape) {
    case Circle(double r) -> Math.PI * r * r;
    case Rectangle(double w, double h) -> w * h;
    case Triangle(double b, double h) -> 0.5 * b * h;
};

// ✅ Guards in patterns
String describe = switch (obj) {
    case Integer i when i > 0 -> "positive integer: " + i;
    case Integer i when i < 0 -> "negative integer: " + i;
    case Integer i -> "zero";
    case String s when s.isBlank() -> "blank string";
    case String s -> "string: " + s;
    case null -> "null value";
    default -> "unknown: " + obj;
};
```

## Sequenced Collections

### New Collection Interfaces
```java
// SequencedCollection - ordered collection with defined encounter order
SequencedCollection<String> list = new ArrayList<>();
list.addFirst("first");
list.addLast("last");
String first = list.getFirst();
String last = list.getLast();
list.removeFirst();
list.removeLast();
SequencedCollection<String> reversed = list.reversed();

// SequencedSet - set with defined encounter order
SequencedSet<String> set = new LinkedHashSet<>();
set.addFirst("first");
set.reversed().forEach(System.out::println);

// SequencedMap - map with defined encounter order
SequencedMap<String, Integer> map = new LinkedHashMap<>();
map.putFirst("first", 1);
map.putLast("last", 99);
Map.Entry<String, Integer> firstEntry = map.firstEntry();
Map.Entry<String, Integer> lastEntry = map.lastEntry();
SequencedMap<String, Integer> reversedMap = map.reversed();
```

## String Templates (Preview in 21, Standard in 22+)

```java
// Note: Enable preview features if using Java 21
// --enable-preview flag required

// ✅ String templates (when standard)
String name = "Duke";
int age = 25;
String message = STR."Hello, my name is \{name} and I am \{age} years old.";

// ✅ Format templates
double price = 19.99;
String formatted = FMT."Price: %.2f\{price}";

// ✅ Multi-line with expressions
String json = STR."""
    {
        "name": "\{name}",
        "age": \{age},
        "isAdult": \{age >= 18}
    }
    """;
```

## Sealed Classes (Finalized)

```java
// ✅ Define closed hierarchies
public sealed interface PaymentMethod permits CreditCard, BankTransfer, DigitalWallet {}

public record CreditCard(String number, String expiry) implements PaymentMethod {}
public record BankTransfer(String iban) implements PaymentMethod {}
public sealed interface DigitalWallet extends PaymentMethod permits PayPal, ApplePay {}

public record PayPal(String email) implements DigitalWallet {}
public record ApplePay(String deviceId) implements DigitalWallet {}

// ✅ Exhaustive switch (compiler ensures all cases handled)
String process(PaymentMethod method) {
    return switch (method) {
        case CreditCard(String number, String expiry) ->
            "Processing card ending in " + number.substring(number.length() - 4);
        case BankTransfer(String iban) ->
            "Processing bank transfer to " + iban;
        case PayPal(String email) ->
            "Processing PayPal payment for " + email;
        case ApplePay(String deviceId) ->
            "Processing Apple Pay from device " + deviceId;
    };
}
```

## Records Best Practices

```java
// ✅ Compact constructor for validation
public record Order(String id, List<Item> items, BigDecimal total) {
    public Order {
        Objects.requireNonNull(id, "id cannot be null");
        Objects.requireNonNull(items, "items cannot be null");
        items = List.copyOf(items); // Defensive copy
        if (total.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("total cannot be negative");
        }
    }
}

// ✅ Additional methods on records
public record Point(int x, int y) {
    public double distanceFromOrigin() {
        return Math.sqrt(x * x + y * y);
    }

    public Point translate(int dx, int dy) {
        return new Point(x + dx, y + dy);
    }

    public static Point origin() {
        return new Point(0, 0);
    }
}

// ✅ Records with generics
public record Pair<L, R>(L left, R right) {
    public <T> Pair<T, R> mapLeft(Function<L, T> mapper) {
        return new Pair<>(mapper.apply(left), right);
    }
}
```

## Improved null Handling

```java
// ✅ Use Optional correctly
public Optional<User> findUser(Long id) {
    return Optional.ofNullable(userRepository.findById(id));
}

// ✅ Chain Optional operations
String displayName = findUser(id)
    .map(User::profile)
    .map(Profile::displayName)
    .orElse("Anonymous");

// ✅ Pattern matching with null
String handle = switch (value) {
    case null -> "null value";
    case String s when s.isBlank() -> "blank";
    case String s -> s.trim();
};
```

## Improved Switch Expressions

```java
// ✅ Multiple patterns
String result = switch (day) {
    case MONDAY, FRIDAY, SUNDAY -> "busy";
    case TUESDAY -> "productive";
    case THURSDAY, SATURDAY -> "relaxed";
    case WEDNESDAY -> "meeting day";
};

// ✅ Yield for complex cases
int value = switch (status) {
    case ACTIVE -> 1;
    case INACTIVE -> 0;
    case PENDING -> {
        log.info("Checking pending status");
        yield calculatePendingValue();
    }
};
```

## Memory Bank Integration

When using Java 21 features:

1. **Document feature usage**: Add to `.memory-bank/knowledge/java-patterns.md`
2. **Track compatibility**: Note minimum Java version in project context
3. **Migration notes**: Document upgrade path from older Java versions

## What You MUST Do

- Enable preview features explicitly if using them
- Use virtual threads for I/O-bound concurrent operations
- Prefer records for immutable data transfer objects
- Use sealed types for closed hierarchies
- Use pattern matching to eliminate instanceof chains

## What You MUST NOT Do

- Use virtual threads for CPU-intensive work
- Use synchronized blocks inside virtual thread code
- Create mutable records (use classes instead)
- Ignore exhaustiveness warnings in switch expressions
- Mix old and new patterns inconsistently
