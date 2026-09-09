# Policy Pattern

> Centralized authorization logic — built into Laravel.

## Idea

Authorization rules belong in **Policy classes**, not scattered across controllers,
middleware, or model methods.

## Laravel Mechanism

- One Policy per Model (or resource)
- Methods map to actions: `view`, `create`, `update`, `delete`, `restore`
- Called via `$this->authorize()` in controllers or `Gate::allows()` anywhere
- FormRequests call policies in `authorize()` method

## Example

```php
final class OrderPolicy
{
    public function view(User $user, Order $order): bool
    {
        return $user->getId() === $order->getUserId();
    }

    public function update(User $user, Order $order): bool
    {
        return $user->getId() === $order->getUserId()
            && $order->getStatus() !== OrderStatus::COMPLETED;
    }

    public function delete(User $user, Order $order): bool
    {
        return $user->isAdmin();
    }
}
```

## In FormRequests

```php
public function authorize(): bool
{
    /** @var Order $order */
    $order = $this->route('order');

    /** @var User $user */
    $user = $this->user();

    return $user->can('update', $order);
}
```

## Rules

- One Policy per Model — `App\Policies\{Model}Policy`
- Keep policy methods simple — delegate complex checks to the model or a service
- Return `bool` — no exceptions in policies
- Laravel auto-discovers policies by convention (no manual registration needed)

## When NOT to Use

❌ Global rules (e.g., "must be authenticated") — use middleware instead
❌ Business rules (e.g., "order must have items") — that's validation, not authorization

