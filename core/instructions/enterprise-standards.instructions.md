---
applyTo: "**/*"
excludeAgent: ""
---

# Enterprise Standards

These standards apply to all code in this project. They are derived from industry best practices and team conventions documented in the Memory Bank.

## Code Quality

### General Principles

1. **Readability First**: Code is read more often than written. Prioritize clarity.
2. **Single Responsibility**: Each class/function should do one thing well.
3. **DRY (Don't Repeat Yourself)**: Extract common logic into reusable components.
4. **KISS (Keep It Simple)**: Prefer simple solutions over clever ones.
5. **YAGNI (You Aren't Gonna Need It)**: Don't add functionality until needed.

### Naming Conventions

- **Classes**: PascalCase, noun phrases (`OrderService`, `CustomerRepository`)
- **Methods**: camelCase (Java/.NET), verb phrases (`calculateTotal`, `findByEmail`)
- **Variables**: camelCase, descriptive names (`customerCount`, not `c` or `cnt`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Avoid**: Abbreviations, single letters (except loop indices), Hungarian notation

### Method Design

- **Size**: Methods should fit on one screen (~20-30 lines max)
- **Parameters**: Maximum 3-4 parameters; use objects for more
- **Return**: Single return type; avoid returning null when possible
- **Side Effects**: Minimize; document when necessary

### Error Handling

1. **Fail Fast**: Validate inputs early
2. **Specific Exceptions**: Use specific exception types, not generic ones
3. **Meaningful Messages**: Include context in error messages
4. **Don't Swallow**: Never catch exceptions silently
5. **Log Appropriately**: Log errors with sufficient context for debugging

```java
// ❌ Bad
try {
    processOrder(order);
} catch (Exception e) {
    // ignored
}

// ✅ Good
try {
    processOrder(order);
} catch (OrderProcessingException e) {
    logger.error("Failed to process order {}: {}", order.getId(), e.getMessage(), e);
    throw new ServiceException("Order processing failed", e);
}
```

## Security

### Authentication & Authorization

1. **Never Trust Input**: Validate and sanitize all user input
2. **Least Privilege**: Grant minimum necessary permissions
3. **Defense in Depth**: Multiple layers of security
4. **Fail Secure**: Default to deny access

### Sensitive Data

1. **No Secrets in Code**: Use environment variables or secret management
2. **Encrypt at Rest**: Sensitive data must be encrypted
3. **Encrypt in Transit**: Use TLS for all communications
4. **Mask in Logs**: Never log passwords, tokens, or PII

```java
// ❌ Never do this
private static final String API_KEY = "sk-1234567890";

// ✅ Use configuration
@Value("${api.key}")
private String apiKey;
```

### Common Vulnerabilities (OWASP Top 10)

1. **Injection**: Use parameterized queries, never concatenate SQL
2. **XSS**: Encode output, use Content Security Policy
3. **CSRF**: Use CSRF tokens for state-changing operations
4. **Broken Access Control**: Verify permissions on every request

## Testing

### Test Requirements

1. **Unit Tests**: All business logic must have unit tests
2. **Integration Tests**: Critical paths must have integration tests
3. **Coverage**: Minimum 80% line coverage for new code
4. **Naming**: Test names should describe the scenario

### Test Structure (AAA Pattern)

```java
@Test
void shouldCalculateTotalWithDiscount() {
    // Arrange
    Order order = new Order();
    order.addItem(new Item("Product", 100.00));
    order.setDiscountPercent(10);
    
    // Act
    double total = order.calculateTotal();
    
    // Assert
    assertThat(total).isEqualTo(90.00);
}
```

### What to Test

- ✅ Business logic
- ✅ Edge cases and boundary conditions
- ✅ Error handling paths
- ✅ Integration points
- ❌ Getters/setters (unless they have logic)
- ❌ Framework code
- ❌ Third-party libraries

## Documentation

### Code Documentation

1. **Self-Documenting Code**: Prefer clear code over comments
2. **Why, Not What**: Comments explain why, not what
3. **Public API**: All public methods need documentation
4. **Keep Updated**: Outdated comments are worse than no comments

### Required Documentation

- **README**: How to setup, run, and contribute
- **API Documentation**: OpenAPI/Swagger for REST APIs
- **Architecture Decisions**: ADRs in Memory Bank
- **Runbooks**: Operational procedures

## Version Control

### Commit Messages

Follow Conventional Commits format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Example:
```
feat(orders): add support for bulk order creation

- Add BatchOrderService for processing multiple orders
- Implement validation for batch size limits
- Add integration tests for bulk operations

Closes #123
```

### Branch Naming

```
<type>/<ticket-id>-<short-description>

feature/PROJ-123-add-bulk-orders
bugfix/PROJ-456-fix-calculation
hotfix/PROJ-789-security-patch
```

### Pull Requests

1. **Small PRs**: Prefer small, focused changes
2. **Description**: Explain what and why
3. **Tests**: Include relevant tests
4. **Self-Review**: Review your own code first
5. **Link Issues**: Reference related tickets

## Performance

### Database

1. **Avoid N+1**: Use joins or batch fetching
2. **Index**: Index columns used in WHERE and JOIN
3. **Pagination**: Always paginate large result sets
4. **Connection Pooling**: Use connection pools

### Caching

1. **Cache Appropriately**: Cache expensive, frequently-read data
2. **Invalidation Strategy**: Plan for cache invalidation
3. **TTL**: Set appropriate time-to-live values

### Async Operations

1. **Don't Block**: Use async for I/O operations
2. **Timeout**: Set timeouts on external calls
3. **Circuit Breaker**: Implement for external dependencies

## Logging

### Log Levels

- **ERROR**: System errors requiring immediate attention
- **WARN**: Potential issues that should be monitored
- **INFO**: Significant business events
- **DEBUG**: Detailed information for debugging

### Log Content

```java
// ✅ Good - includes context
logger.info("Order {} created for customer {} with {} items", 
    orderId, customerId, itemCount);

// ❌ Bad - no context
logger.info("Order created");
```

### What to Log

- ✅ Business transactions (start, end, result)
- ✅ Errors with stack traces
- ✅ External service calls
- ✅ Authentication events
- ❌ Sensitive data (passwords, tokens, PII)
- ❌ Every line of execution

## Memory Bank Integration

All standards should be:
1. **Documented**: In `.memory-bank/project/context.md`
2. **Reasoned**: Major standards should have ADRs
3. **Exemplified**: Good examples in `.memory-bank/knowledge/patterns.md`
4. **Counter-Exemplified**: Bad examples in `.memory-bank/knowledge/antipatterns.md`

When deviating from standards:
1. Document the reason in the code
2. Consider if an ADR is needed
3. Discuss with the team
