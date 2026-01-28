---
name: create-service-layer
description: Generate a Spring service layer with proper transaction management, validation, and event publishing
---

# Create Service Layer

Generate a Spring service implementation with proper architecture, transaction management, and best practices.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Understand existing service patterns in the codebase
3. Identify the repository and mapper interfaces

## Input

```
Service Name: {name of the service, e.g., "Order", "Customer", "Product"}
Repository: {repository class to inject}
Mapper: {MapStruct mapper class if exists}
Dependencies: {other services or ports to inject}
Events: {domain events to publish}
Caching: {caching requirements if any}
```

## Generation Process

### 1. Service Interface

```java
public interface ${ResourceName}Service {

    ${ResourceName}Dto create(Create${ResourceName}Request request);

    Optional<${ResourceName}Dto> findById(Long id);

    Page<${ResourceName}Dto> findAll(Pageable pageable);

    ${ResourceName}Dto update(Long id, Update${ResourceName}Request request);

    void delete(Long id);

    Page<${ResourceName}Dto> search(${ResourceName}SearchCriteria criteria, Pageable pageable);
}
```

### 2. Service Implementation

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class ${ResourceName}ServiceImpl implements ${ResourceName}Service {

    private final ${ResourceName}Repository repository;
    private final ${ResourceName}Mapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    private final MeterRegistry meterRegistry;

    @Override
    @Transactional
    @Timed(value = "${resource}.create", description = "Time to create ${resource}")
    public ${ResourceName}Dto create(Create${ResourceName}Request request) {
        log.info("Creating ${resourceName}: {}", request);

        // Validate business rules
        validateCreateRequest(request);

        // Map to entity
        var entity = mapper.toEntity(request);
        entity.setStatus(${ResourceStatus}.CREATED);

        // Save
        var saved = repository.save(entity);

        // Publish event
        eventPublisher.publishEvent(new ${ResourceName}CreatedEvent(saved.getId()));

        // Record metric
        meterRegistry.counter("${resource}.created", "status", "success").increment();

        log.info("${ResourceName} created with ID: {}", saved.getId());
        return mapper.toDto(saved);
    }

    @Override
    @Cacheable(value = "${resources}", key = "#id")
    public Optional<${ResourceName}Dto> findById(Long id) {
        log.debug("Finding ${resourceName} by ID: {}", id);
        return repository.findById(id)
            .map(mapper::toDto);
    }

    @Override
    public Page<${ResourceName}Dto> findAll(Pageable pageable) {
        log.debug("Finding all ${resourceName}s, page: {}", pageable);
        return repository.findAll(pageable)
            .map(mapper::toDto);
    }

    @Override
    @Transactional
    @CacheEvict(value = "${resources}", key = "#id")
    @Timed(value = "${resource}.update", description = "Time to update ${resource}")
    public ${ResourceName}Dto update(Long id, Update${ResourceName}Request request) {
        log.info("Updating ${resourceName} {}: {}", id, request);

        var entity = repository.findById(id)
            .orElseThrow(() -> new ${ResourceName}NotFoundException(id));

        // Validate business rules
        validateUpdateRequest(entity, request);

        // Apply updates
        mapper.updateEntity(entity, request);

        // Save
        var saved = repository.save(entity);

        // Publish event
        eventPublisher.publishEvent(new ${ResourceName}UpdatedEvent(saved.getId()));

        log.info("${ResourceName} {} updated", id);
        return mapper.toDto(saved);
    }

    @Override
    @Transactional
    @CacheEvict(value = "${resources}", key = "#id")
    public void delete(Long id) {
        log.info("Deleting ${resourceName}: {}", id);

        var entity = repository.findById(id)
            .orElseThrow(() -> new ${ResourceName}NotFoundException(id));

        // Validate can delete
        validateCanDelete(entity);

        repository.delete(entity);

        // Publish event
        eventPublisher.publishEvent(new ${ResourceName}DeletedEvent(id));

        log.info("${ResourceName} {} deleted", id);
    }

    @Override
    public Page<${ResourceName}Dto> search(${ResourceName}SearchCriteria criteria, Pageable pageable) {
        log.debug("Searching ${resourceName}s with criteria: {}", criteria);

        Specification<${ResourceName}> spec = Specification.where(null)
            .and(${ResourceName}Specifications.hasName(criteria.name()))
            .and(${ResourceName}Specifications.hasStatus(criteria.status()))
            .and(${ResourceName}Specifications.createdBetween(criteria.createdAfter(), criteria.createdBefore()));

        return repository.findAll(spec, pageable)
            .map(mapper::toDto);
    }

    // Business Validation Methods

    private void validateCreateRequest(Create${ResourceName}Request request) {
        // Check for duplicates
        if (repository.existsByName(request.name())) {
            throw new ${ResourceName}AlreadyExistsException(request.name());
        }

        // Additional business validations
    }

    private void validateUpdateRequest(${ResourceName} entity, Update${ResourceName}Request request) {
        // Check status allows modification
        if (!entity.canBeModified()) {
            throw new ${ResourceName}NotModifiableException(entity.getId(), entity.getStatus());
        }

        // Check for name conflicts (if name is being changed)
        if (request.name() != null && !request.name().equals(entity.getName())) {
            if (repository.existsByNameAndIdNot(request.name(), entity.getId())) {
                throw new ${ResourceName}AlreadyExistsException(request.name());
            }
        }
    }

    private void validateCanDelete(${ResourceName} entity) {
        if (!entity.canBeDeleted()) {
            throw new ${ResourceName}NotDeletableException(entity.getId(), entity.getStatus());
        }
    }
}
```

### 3. Specifications for Search

```java
public class ${ResourceName}Specifications {

    private ${ResourceName}Specifications() {}

    public static Specification<${ResourceName}> hasName(String name) {
        return (root, query, cb) ->
            name == null ? null : cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    public static Specification<${ResourceName}> hasStatus(${ResourceStatus} status) {
        return (root, query, cb) ->
            status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<${ResourceName}> createdBetween(Instant from, Instant to) {
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
}
```

### 4. Domain Events

```java
public record ${ResourceName}CreatedEvent(Long ${resourceName}Id) {}

public record ${ResourceName}UpdatedEvent(Long ${resourceName}Id) {}

public record ${ResourceName}DeletedEvent(Long ${resourceName}Id) {}
```

### 5. Custom Exceptions

```java
public class ${ResourceName}NotFoundException extends RuntimeException {
    private final Long ${resourceName}Id;

    public ${ResourceName}NotFoundException(Long id) {
        super("${ResourceName} not found with ID: " + id);
        this.${resourceName}Id = id;
    }

    public Long get${ResourceName}Id() {
        return ${resourceName}Id;
    }
}

public class ${ResourceName}AlreadyExistsException extends RuntimeException {
    public ${ResourceName}AlreadyExistsException(String name) {
        super("${ResourceName} already exists with name: " + name);
    }
}

public class ${ResourceName}NotModifiableException extends RuntimeException {
    public ${ResourceName}NotModifiableException(Long id, ${ResourceStatus} status) {
        super("${ResourceName} " + id + " cannot be modified in status: " + status);
    }
}
```

## Output Checklist

Ensure the generated service has:

- [ ] Interface and implementation separation
- [ ] `@Transactional(readOnly = true)` at class level
- [ ] `@Transactional` on write methods
- [ ] Proper logging with `@Slf4j`
- [ ] Constructor injection with `@RequiredArgsConstructor`
- [ ] Business validation methods
- [ ] Domain event publishing
- [ ] Metrics with `@Timed`
- [ ] Caching with `@Cacheable` and `@CacheEvict`
- [ ] Custom exceptions
- [ ] Specifications for search

## Memory Bank Updates

After generating the service:

- [ ] Document service patterns in knowledge base
- [ ] Update module context
- [ ] Add event documentation

## Example Usage

**User**: Create a service layer for Product management with caching and search

**Response**:
[Generates complete ProductService with all operations, caching, specifications, and event publishing]
