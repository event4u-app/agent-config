# Event / Listener Pattern

> Decouple side effects from core logic.

## Idea

A core process dispatches an **Event**, other parts of the system react via **Listeners**.
The core process doesn't know (or care) who listens.

## Typical Use Cases

✅ Notifications (email, push) after an action
✅ Logging, audit trails
✅ Syncing data to external systems
✅ Cache invalidation
✅ Triggering follow-up jobs

## Example

```php
// Event — immutable data container
final readonly class OrderPlaced
{
    public function __construct(
        public int $orderId,
        public int $customerId,
    ) {}
}

// Listener
final class SendOrderConfirmation
{
    public function handle(OrderPlaced $event): void
    {
        // send email...
    }
}
```

## Dispatching

```php
// In a service or action
OrderPlaced::dispatch($order->getId(), $order->getCustomerId());

// Or via event helper
event(new OrderPlaced($order->getId(), $order->getCustomerId()));
```

## Laravel Discovery

Since Laravel 11, events and listeners are auto-discovered — no manual registration
needed. Configured in `bootstrap/app.php`.

## Rules

- Events are `final readonly` — immutable data containers
- Pass **IDs**, not model instances (smaller payload, avoids serialization issues)
- One listener per side effect — don't cram multiple things into one listener
- Use queued listeners (`ShouldQueue`) for slow operations (emails, API calls)

## When NOT to Use

❌ Direct, synchronous flow where caller needs the result — just call the service directly
❌ Only one "listener" that always runs — a direct method call is simpler and easier to follow
❌ Everything — too many events make the application flow hard to trace

