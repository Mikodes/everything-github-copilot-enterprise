# API Conventions

This document defines the API conventions for all microservices in the e-commerce platform.

## URL Structure

### Base Path
```
/api/v{version}/{resource}
```

### Examples
```
GET  /api/v1/orders
GET  /api/v1/orders/123
POST /api/v1/orders
PUT  /api/v1/orders/123
DELETE /api/v1/orders/123
```

## HTTP Methods

| Method | Usage | Idempotent |
|--------|-------|------------|
| GET | Retrieve resources | Yes |
| POST | Create resources | No |
| PUT | Full update | Yes |
| PATCH | Partial update | Yes |
| DELETE | Remove resources | Yes |

## Response Codes

### Success

| Code | Usage |
|------|-------|
| 200 OK | Successful GET, PUT, PATCH |
| 201 Created | Successful POST |
| 204 No Content | Successful DELETE |

### Client Errors

| Code | Usage |
|------|-------|
| 400 Bad Request | Validation errors |
| 401 Unauthorized | Missing/invalid auth |
| 403 Forbidden | Insufficient permissions |
| 404 Not Found | Resource not found |
| 409 Conflict | Resource conflict |
| 422 Unprocessable | Business rule violation |

### Server Errors

| Code | Usage |
|------|-------|
| 500 Internal Error | Unexpected server error |
| 502 Bad Gateway | Upstream service error |
| 503 Service Unavailable | Service overloaded |

## Error Response Format (Problem Details - RFC 7807)

```json
{
  "type": "https://api.example.com/errors/order-not-found",
  "title": "Order Not Found",
  "status": 404,
  "detail": "Order with ID 123 was not found",
  "instance": "/api/v1/orders/123",
  "timestamp": "2024-01-15T10:30:00Z",
  "traceId": "abc123"
}
```

### Validation Errors

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "customerId",
      "message": "must not be null"
    },
    {
      "field": "items",
      "message": "must not be empty"
    }
  ]
}
```

## Pagination

### Request
```
GET /api/v1/orders?page=0&size=20&sort=createdAt,desc
```

### Response
```json
{
  "content": [...],
  "page": {
    "number": 0,
    "size": 20,
    "totalElements": 150,
    "totalPages": 8
  }
}
```

### Headers
```
X-Total-Count: 150
X-Total-Pages: 8
Link: <...?page=1>; rel="next", <...?page=7>; rel="last"
```

## Filtering

Use query parameters for simple filters:
```
GET /api/v1/orders?status=PENDING&customerId=123
```

For complex queries, use POST with body:
```
POST /api/v1/orders/search
{
  "status": ["PENDING", "PROCESSING"],
  "createdAfter": "2024-01-01T00:00:00Z",
  "minTotal": 100.00
}
```

## Versioning

We use **URI versioning**:
```
/api/v1/orders
/api/v2/orders
```

### Deprecation
- Announce deprecation 6 months before removal
- Add `Deprecation` header to responses
- Document migration path

## Authentication

### Bearer Token
```
Authorization: Bearer <jwt-token>
```

### Claims Expected
```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "roles": ["USER", "ADMIN"]
}
```

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | Bearer token |
| `Content-Type` | Yes | `application/json` |
| `Accept` | No | `application/json` |
| `X-Request-ID` | No | Client request ID |
| `X-Correlation-ID` | No | Distributed trace ID |

## Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Echo client request ID |
| `X-Correlation-ID` | Trace ID for debugging |
| `X-Rate-Limit-Remaining` | Remaining requests |

## Rate Limiting

- Default: 100 requests/minute per user
- Headers in response:
  ```
  X-Rate-Limit-Limit: 100
  X-Rate-Limit-Remaining: 95
  X-Rate-Limit-Reset: 1705312200
  ```

## Naming Conventions

### URLs
- Use lowercase with hyphens: `/api/v1/order-items`
- Use plural nouns: `/orders` not `/order`
- Use nouns, not verbs: `/orders` not `/getOrders`

### JSON
- Use camelCase for properties
- Use ISO 8601 for dates: `2024-01-15T10:30:00Z`
- Use strings for IDs in responses

## Examples

### Create Order
```http
POST /api/v1/orders
Content-Type: application/json
Authorization: Bearer <token>

{
  "customerId": 123,
  "items": [
    {"productId": 1, "quantity": 2}
  ]
}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/orders/456
Content-Type: application/json

{
  "id": "456",
  "orderNumber": "ORD-2024-000456",
  "status": "CREATED"
}
```

### Get Order
```http
GET /api/v1/orders/456
Authorization: Bearer <token>
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "456",
  "orderNumber": "ORD-2024-000456",
  "status": "CREATED",
  "customerId": "123",
  "items": [...],
  "total": 99.99,
  "createdAt": "2024-01-15T10:30:00Z"
}
```
