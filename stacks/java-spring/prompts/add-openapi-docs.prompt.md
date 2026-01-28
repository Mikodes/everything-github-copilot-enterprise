---
name: add-openapi-docs
description: Add OpenAPI 3.0 documentation to a Spring Boot REST API using springdoc-openapi
---

# Add OpenAPI Documentation

Configure OpenAPI 3.0 documentation for a Spring Boot REST API using springdoc-openapi.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Identify existing REST controllers
3. Check authentication requirements

## Input

```
API Title: {title for the API documentation}
API Version: {API version, e.g., "1.0.0"}
Description: {brief API description}
Contact: {contact information}
Servers: {list of server URLs}
Security: {JWT | OAuth2 | API Key | None}
Groups: {API groups if needed}
```

## Generation Process

### 1. Add Dependencies

#### Gradle
```kotlin
dependencies {
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.3.0")

    // For WebFlux
    // implementation("org.springdoc:springdoc-openapi-starter-webflux-ui:2.3.0")
}
```

#### Maven
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.3.0</version>
</dependency>
```

### 2. OpenAPI Configuration

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(apiInfo())
            .externalDocs(externalDocs())
            .servers(servers())
            .components(securityComponents())
            .addSecurityItem(securityRequirement());
    }

    private Info apiInfo() {
        return new Info()
            .title("${API_TITLE}")
            .version("${API_VERSION}")
            .description("""
                ${API_DESCRIPTION}

                ## Features
                - Feature 1
                - Feature 2

                ## Authentication
                This API uses JWT Bearer tokens for authentication.
                """)
            .termsOfService("https://example.com/terms")
            .contact(new Contact()
                .name("API Support")
                .email("api-support@example.com")
                .url("https://example.com/support"))
            .license(new License()
                .name("Apache 2.0")
                .url("https://www.apache.org/licenses/LICENSE-2.0"));
    }

    private ExternalDocumentation externalDocs() {
        return new ExternalDocumentation()
            .description("Full API Documentation")
            .url("https://docs.example.com/api");
    }

    private List<Server> servers() {
        return List.of(
            new Server()
                .url("http://localhost:8080")
                .description("Local Development"),
            new Server()
                .url("https://api.staging.example.com")
                .description("Staging"),
            new Server()
                .url("https://api.example.com")
                .description("Production")
        );
    }

    private Components securityComponents() {
        return new Components()
            .addSecuritySchemes("bearerAuth", new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("Enter JWT token"));
    }

    private SecurityRequirement securityRequirement() {
        return new SecurityRequirement().addList("bearerAuth");
    }
}
```

### 3. Application Configuration

```yaml
# application.yml
springdoc:
  api-docs:
    enabled: true
    path: /v3/api-docs
  swagger-ui:
    enabled: true
    path: /swagger-ui.html
    operationsSorter: method
    tagsSorter: alpha
    disable-swagger-default-url: true
    display-request-duration: true
    filter: true
    show-extensions: true
  packages-to-scan: com.example.api
  paths-to-match: /api/**
  default-consumes-media-type: application/json
  default-produces-media-type: application/json
  show-actuator: false
  group-configs:
    - group: orders
      paths-to-match: /api/orders/**
      packages-to-scan: com.example.api.orders
    - group: customers
      paths-to-match: /api/customers/**
      packages-to-scan: com.example.api.customers
```

### 4. Controller Documentation

```java
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Tag(
    name = "Orders",
    description = "Order management endpoints for creating, retrieving, updating, and deleting orders"
)
public class OrderController {

    private final OrderService orderService;

    @Operation(
        summary = "Create a new order",
        description = "Creates a new order with the provided items for the specified customer"
    )
    @ApiResponses({
        @ApiResponse(
            responseCode = "201",
            description = "Order created successfully",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = OrderResponse.class),
                examples = @ExampleObject(
                    name = "Created Order",
                    value = """
                        {
                            "id": 123,
                            "orderNumber": "ORD-2024-001",
                            "status": "CREATED",
                            "total": 99.99
                        }
                        """
                )
            )
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid request",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = ProblemDetail.class)
            )
        ),
        @ApiResponse(
            responseCode = "401",
            description = "Unauthorized",
            content = @Content
        ),
        @ApiResponse(
            responseCode = "409",
            description = "Order already exists",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = ProblemDetail.class)
            )
        )
    })
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse createOrder(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                description = "Order creation request",
                required = true,
                content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateOrderRequest.class),
                    examples = @ExampleObject(
                        name = "Sample Order",
                        value = """
                            {
                                "customerId": 1,
                                "items": [
                                    {"productId": 100, "quantity": 2, "price": 29.99},
                                    {"productId": 101, "quantity": 1, "price": 39.99}
                                ]
                            }
                            """
                    )
                )
            )
            @Valid @RequestBody CreateOrderRequest request) {
        return orderService.create(request);
    }

    @Operation(
        summary = "Get order by ID",
        description = "Retrieves an order by its unique identifier"
    )
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Order found",
            content = @Content(schema = @Schema(implementation = OrderResponse.class))
        ),
        @ApiResponse(
            responseCode = "404",
            description = "Order not found",
            content = @Content(schema = @Schema(implementation = ProblemDetail.class))
        )
    })
    @GetMapping("/{id}")
    public OrderResponse getOrder(
            @Parameter(
                description = "Order ID",
                required = true,
                example = "123"
            )
            @PathVariable @Positive Long id) {
        return orderService.findById(id)
            .orElseThrow(() -> new OrderNotFoundException(id));
    }

    @Operation(
        summary = "Search orders",
        description = "Search orders with filters and pagination"
    )
    @GetMapping
    public Page<OrderResponse> searchOrders(
            @Parameter(description = "Filter by status")
            @RequestParam(required = false) OrderStatus status,

            @Parameter(description = "Filter by customer ID")
            @RequestParam(required = false) Long customerId,

            @Parameter(description = "Filter orders created after this date")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdAfter,

            @Parameter(description = "Page number (0-indexed)", example = "0")
            @RequestParam(defaultValue = "0") @PositiveOrZero int page,

            @Parameter(description = "Page size", example = "20")
            @RequestParam(defaultValue = "20") @Positive @Max(100) int size,

            @Parameter(description = "Sort field and direction", example = "createdAt,desc")
            @RequestParam(defaultValue = "createdAt,desc") String sort) {

        var criteria = new OrderSearchCriteria(status, customerId, createdAfter, null);
        return orderService.search(criteria, PageRequest.of(page, size));
    }

    @Operation(
        summary = "Delete an order",
        description = "Deletes an order. Only orders in CREATED status can be deleted."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Order deleted"),
        @ApiResponse(responseCode = "404", description = "Order not found"),
        @ApiResponse(responseCode = "409", description = "Order cannot be deleted")
    })
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearerAuth")
    public void deleteOrder(
            @Parameter(description = "Order ID", required = true)
            @PathVariable @Positive Long id) {
        orderService.delete(id);
    }
}
```

### 5. DTO Documentation

```java
@Schema(description = "Request to create a new order")
public record CreateOrderRequest(

    @Schema(
        description = "Customer ID",
        example = "1",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    @NotNull
    Long customerId,

    @Schema(
        description = "Order items",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    @NotEmpty
    @Valid
    List<OrderItemRequest> items

) {}

@Schema(description = "Order item in a create request")
public record OrderItemRequest(

    @Schema(description = "Product ID", example = "100")
    @NotNull
    Long productId,

    @Schema(description = "Quantity", example = "2", minimum = "1")
    @NotNull @Positive
    Integer quantity,

    @Schema(description = "Unit price", example = "29.99")
    @NotNull @Positive
    BigDecimal price

) {}

@Schema(description = "Order response")
public record OrderResponse(

    @Schema(description = "Order ID", example = "123")
    Long id,

    @Schema(description = "Order number", example = "ORD-2024-001")
    String orderNumber,

    @Schema(description = "Order status", example = "CREATED")
    OrderStatus status,

    @Schema(description = "Total amount", example = "99.99")
    BigDecimal total,

    @Schema(description = "Customer ID", example = "1")
    Long customerId,

    @Schema(description = "Order items")
    List<OrderItemResponse> items,

    @Schema(description = "Creation timestamp", example = "2024-01-15T10:30:00Z")
    Instant createdAt,

    @Schema(description = "Last update timestamp", example = "2024-01-15T10:30:00Z")
    Instant updatedAt

) {}
```

### 6. Enum Documentation

```java
@Schema(
    description = "Order status",
    enumAsRef = true
)
public enum OrderStatus {

    @Schema(description = "Order has been created but not yet submitted")
    CREATED,

    @Schema(description = "Order has been submitted for processing")
    SUBMITTED,

    @Schema(description = "Order is being processed")
    PROCESSING,

    @Schema(description = "Order has been shipped")
    SHIPPED,

    @Schema(description = "Order has been delivered")
    DELIVERED,

    @Schema(description = "Order has been cancelled")
    CANCELLED
}
```

### 7. Security in Swagger UI

```java
@Configuration
public class OpenApiSecurityConfig {

    @Bean
    public OpenApiCustomizer securityOpenApiCustomizer() {
        return openApi -> {
            // Add security to all paths except public
            openApi.getPaths().forEach((path, item) -> {
                if (!path.startsWith("/api/public")) {
                    item.readOperations().forEach(operation -> {
                        if (operation.getSecurity() == null) {
                            operation.setSecurity(List.of(
                                new SecurityRequirement().addList("bearerAuth")
                            ));
                        }
                    });
                }
            });
        };
    }
}
```

### 8. Actuator Security

```java
// Exclude actuator from OpenAPI docs but allow Swagger
@Bean
public GroupedOpenApi publicApi() {
    return GroupedOpenApi.builder()
        .group("public-api")
        .pathsToMatch("/api/**")
        .pathsToExclude("/actuator/**")
        .build();
}
```

## Access Points

After configuration:

- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **OpenAPI JSON**: http://localhost:8080/v3/api-docs
- **OpenAPI YAML**: http://localhost:8080/v3/api-docs.yaml

## Output Checklist

Ensure the documentation has:

- [ ] springdoc-openapi dependency added
- [ ] OpenAPI configuration class
- [ ] Application.yml springdoc settings
- [ ] `@Tag` on all controllers
- [ ] `@Operation` on all endpoints
- [ ] `@ApiResponses` for response codes
- [ ] `@Parameter` for path/query params
- [ ] `@Schema` on DTOs and fields
- [ ] Security scheme configured
- [ ] Examples provided
- [ ] Grouped APIs (if applicable)

## Memory Bank Updates

After adding OpenAPI docs:

- [ ] Document API versioning strategy
- [ ] Add OpenAPI patterns to knowledge base
- [ ] Update project documentation

## Example Usage

**User**: Add OpenAPI documentation to my Order API with JWT authentication

**Response**:
[Generates complete OpenAPI configuration with controller annotations, DTO schemas, and security]
