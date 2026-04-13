---
name: microservices
description: "Use when designing microservice architectures — service boundaries, API contracts, event-driven patterns, or inter-service communication."
---

# microservices

## When to use

Distributed systems, service boundaries, inter-service communication, event-driven architectures.

## Boundaries: domain-driven (bounded context), team-aligned, data-owned (no shared DB). Wrong: deployed together (merge), circular deps (restructure), shared DB (extract), chatty (batch).

## Communication patterns

### Synchronous (Request/Response)

```
Service A --HTTP/gRPC--> Service B
```

- Use for: Queries, real-time operations, user-facing requests.
- Risk: Cascading failures, latency coupling.
- Mitigate: Circuit breakers, timeouts, retries with backoff.

### Asynchronous (Event-Driven)

```
Service A --Event--> Message Broker --Event--> Service B
```

- Use for: State changes, notifications, background processing.
- Benefit: Loose coupling, resilience, scalability.
- Risk: Eventual consistency, debugging complexity.

### Patterns

| Pattern | When to use |
|---|---|
| **REST API** | Simple CRUD, external APIs |
| **gRPC** | Internal service-to-service, high performance |
| **Message Queue** | Background jobs, one consumer |
| **Pub/Sub** | Events, multiple consumers |
| **Saga** | Distributed transactions across services |
| **CQRS** | Separate read/write models for performance |

## API contracts

### Contract-first design

Define the API contract before implementing:

```yaml
# OpenAPI spec
paths:
  /api/orders/{id}:
    get:
      summary: Get order by ID
      responses:
        200:
          description: Order found
        404:
          description: Order not found
```

### Versioning

- Use URL versioning (`/v1/orders`) or header versioning (`Accept: application/vnd.api.v1+json`).
- Never break existing contracts — add new fields, don't remove or rename.
- Deprecate old versions with a timeline.

## Event-driven patterns

### Event structure

```json
{
  "event_type": "order.created",
  "event_id": "uuid-here",
  "timestamp": "2026-03-20T10:00:00Z",
  "source": "order-service",
  "data": {
    "order_id": 123,
    "customer_id": 456,
    "total": "99.99"
  }
}
```

### Event rules

- Events are **immutable facts** — something that happened.
- Include **event_id** for idempotency.
- Include **timestamp** for ordering.
- Include **source** for tracing.
- Keep payloads **self-contained** — consumers shouldn't need to call back.

## Resilience patterns

| Pattern | Purpose | Implementation |
|---|---|---|
| **Circuit Breaker** | Stop calling failing services | Open after N failures, half-open after timeout |
| **Retry + Backoff** | Handle transient failures | Exponential backoff with jitter |
| **Timeout** | Prevent hanging requests | Set per-service timeouts |
| **Bulkhead** | Isolate failures | Separate thread pools/connections per service |
| **Fallback** | Graceful degradation | Return cached/default data on failure |

## Observability: distributed tracing (OpenTelemetry), correlation IDs, centralized logging, `/health`, RED metrics.

## Core: own data, design for failure, idempotent, independently deployable, contract-first, observe everything.

## Gotcha: monolith simpler for small teams, prefer async over sync, eventual consistency not ACID.

## Do NOT: shared databases, sync chains of 5+, skip circuit breakers, 2PC (use sagas), deploy together, god service.
