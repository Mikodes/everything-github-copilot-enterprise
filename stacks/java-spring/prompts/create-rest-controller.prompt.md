---
name: create-rest-controller
description: Generate a Spring REST controller following enterprise best practices with validation, error handling, and documentation
---

# Create REST Controller

Generate a Spring REST controller for a specific resource with proper structure, validation, and documentation.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Understand existing controller patterns in the codebase
3. Identify the service layer interface

## Input

```
Resource Name: {name of the resource, e.g., "Order", "Customer", "Product"}
Base Path: {API base path, e.g., "/api/v1/orders"}
Operations: {list of operations: CREATE, READ, READ_ALL, UPDATE, DELETE, SEARCH}
Service Class: {existing service class to inject}
DTO Classes: {request/response DTO classes if they exist}
```

## Generation Process

### 1. Controller Class

Generate a controller following this structure:

```java
@RestController
@RequestMapping("${basePath}")
@RequiredArgsConstructor
@Validated
@Tag(name = "${resourceName}s", description = "${resourceName} management endpoints")
@Slf4j
public class ${ResourceName}Controller {

    private final ${ResourceName}Service ${resourceName}Service;

    // Operations based on requirements
}
```

### 2. CRUD Operations Template

#### Create
```java
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
@Operation(
    summary = "Create a new ${resourceName}",
    description = "Creates a new ${resourceName} with the provided data"
)
@ApiResponses({
    @ApiResponse(responseCode = "201", description = "Successfully created"),
    @ApiResponse(responseCode = "400", description = "Invalid input"),
    @ApiResponse(responseCode = "409", description = "Resource already exists")
})
public ${ResourceName}Response create(
        @Valid @RequestBody Create${ResourceName}Request request) {
    log.info("Creating ${resourceName}: {}", request);
    return ${resourceName}Service.create(request);
}
```

#### Read by ID
```java
@GetMapping("/{id}")
@Operation(summary = "Get ${resourceName} by ID")
@ApiResponses({
    @ApiResponse(responseCode = "200", description = "Found"),
    @ApiResponse(responseCode = "404", description = "Not found")
})
public ${ResourceName}Response getById(
        @PathVariable @Positive Long id) {
    log.debug("Getting ${resourceName} by id: {}", id);
    return ${resourceName}Service.findById(id)
        .orElseThrow(() -> new ${ResourceName}NotFoundException(id));
}
```

#### Read All (Paginated)
```java
@GetMapping
@Operation(summary = "Get all ${resourceName}s with pagination")
public Page<${ResourceName}Response> getAll(
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "20") @Positive @Max(100) int size,
        @RequestParam(defaultValue = "createdAt,desc") String sort) {
    log.debug("Getting ${resourceName}s page: {}, size: {}", page, size);
    var pageable = PageRequest.of(page, size, Sort.by(parseSortOrders(sort)));
    return ${resourceName}Service.findAll(pageable);
}

private List<Sort.Order> parseSortOrders(String sort) {
    // Parse "field,direction" format
    return Arrays.stream(sort.split(","))
        .map(s -> s.split(","))
        .map(parts -> new Sort.Order(
            parts.length > 1 ? Sort.Direction.fromString(parts[1]) : Sort.Direction.ASC,
            parts[0]))
        .toList();
}
```

#### Update
```java
@PutMapping("/{id}")
@Operation(summary = "Update an existing ${resourceName}")
@ApiResponses({
    @ApiResponse(responseCode = "200", description = "Successfully updated"),
    @ApiResponse(responseCode = "400", description = "Invalid input"),
    @ApiResponse(responseCode = "404", description = "Not found")
})
public ${ResourceName}Response update(
        @PathVariable @Positive Long id,
        @Valid @RequestBody Update${ResourceName}Request request) {
    log.info("Updating ${resourceName} {}: {}", id, request);
    return ${resourceName}Service.update(id, request);
}
```

#### Delete
```java
@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
@Operation(summary = "Delete a ${resourceName}")
@ApiResponses({
    @ApiResponse(responseCode = "204", description = "Successfully deleted"),
    @ApiResponse(responseCode = "404", description = "Not found")
})
public void delete(@PathVariable @Positive Long id) {
    log.info("Deleting ${resourceName}: {}", id);
    ${resourceName}Service.delete(id);
}
```

#### Search
```java
@GetMapping("/search")
@Operation(summary = "Search ${resourceName}s with filters")
public Page<${ResourceName}Response> search(
        @Valid ${ResourceName}SearchCriteria criteria,
        @RequestParam(defaultValue = "0") @PositiveOrZero int page,
        @RequestParam(defaultValue = "20") @Positive @Max(100) int size) {
    log.debug("Searching ${resourceName}s with criteria: {}", criteria);
    return ${resourceName}Service.search(criteria, PageRequest.of(page, size));
}
```

### 3. Request/Response DTOs

#### Create Request
```java
public record Create${ResourceName}Request(
    @NotBlank @Size(max = 100)
    String name,

    @NotNull
    ${ResourceType} type,

    @Size(max = 500)
    String description,

    @Valid @NotEmpty
    List<${ItemType}> items
) {}
```

#### Update Request
```java
public record Update${ResourceName}Request(
    @Size(max = 100)
    String name,

    ${ResourceType} type,

    @Size(max = 500)
    String description
) {}
```

#### Response
```java
public record ${ResourceName}Response(
    Long id,
    String name,
    ${ResourceType} type,
    String description,
    ${ResourceStatus} status,
    Instant createdAt,
    Instant updatedAt
) {}
```

### 4. Search Criteria
```java
public record ${ResourceName}SearchCriteria(
    String name,
    ${ResourceType} type,
    ${ResourceStatus} status,
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    Instant createdAfter,
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    Instant createdBefore
) {}
```

## Output Checklist

Ensure the generated controller has:

- [ ] `@RestController` and `@RequestMapping` annotations
- [ ] Constructor injection with `@RequiredArgsConstructor`
- [ ] `@Validated` for parameter validation
- [ ] OpenAPI documentation (`@Tag`, `@Operation`, `@ApiResponses`)
- [ ] Proper HTTP status codes
- [ ] Request validation with `@Valid`
- [ ] Path variable validation (`@Positive`, etc.)
- [ ] Pagination for list endpoints
- [ ] Logging with `@Slf4j`
- [ ] Consistent naming conventions

## Memory Bank Updates

After generating the controller:

- [ ] Add endpoint documentation to API reference
- [ ] Update module context if creating new module
- [ ] Document any new patterns used

## Example Usage

**User**: Create a REST controller for Product management

**Response**:
[Generates complete ProductController with all CRUD operations, DTOs, validation, and documentation]
