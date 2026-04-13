---
name: microservices
description: "Use when designing microservice architectures — service boundaries, API contracts, event-driven patterns, or inter-service communication."
---

# microservices

## When to use

Use this skill when designing or working with distributed systems, service boundaries,
inter-service communication, or event-driven architectures.

## Service boundaries

### How to define boundaries

- **Domain-driven:** One service per bounded context (e.g., Orders, Inventory, Users).
- **Team-aligned:** One service per team that owns it.
- **Data-owned:** Each service owns its data — no shared databases.

### Signs of wrong boundaries

| Symptom | Problem |
|---|---|
| Services always deployed together | Too tightly coupled — merge them |
| Circular dependencies | Wrong boundary — restructure |
| Shared database tables | Missing service — extract shared data |
| Chatty communication | Too fine-grained — merge or batch |

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

## Observability

- **Distributed tracing** — trace requests across services (OpenTelemetry, Jaeger).
- **Correlation IDs** — pass a unique ID through all service calls.
- **Centralized logging** — aggregate logs from all services (ELK, Loki).
- **Health checks** — each service exposes `/health` endpoint.
- **Metrics** — RED method (Rate, Errors, Duration) per service.

## Core rules

- **Each service owns its data** — no shared databases.
- **Design for failure** — every external call can fail.
- **Use idempotent operations** — safe to retry.
- **Keep services independently deployable** — no coordinated releases.
- **Contract-first** — define APIs before implementing.
- **Observe everything** — tracing, logging, metrics, health checks.


## Auto-trigger keywords

- microservices
- service boundaries
- event-driven
- API contract

## Gotcha

- Don't create microservices for the sake of it — a monolith is simpler and often better for small teams.
- The model tends to suggest synchronous HTTP calls between services — prefer async events.
- Distributed transactions are hard — design for eventual consistency, not ACID across services.

## Do NOT

- Do not share databases between services.
- Do not create synchronous chains of 5+ services — use async patterns.
- Do not skip circuit breakers for external service calls.
- Do not use distributed transactions (2PC) — use sagas instead.
- Do not deploy services together — they should be independently deployable.
- Do not create a "god service" that knows about everything.
