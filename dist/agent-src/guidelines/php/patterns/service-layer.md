# Service Layer / Action Pattern

> The most valuable pattern in Laravel projects.

## Idea

Controllers stay thin and delegate business logic to dedicated classes.
These classes have a single responsibility and an expressive name.

## Naming

- **Action** — single operation: `CreateOrderAction`, `PublishArticle`
- **Service** — broader domain scope: `PaymentService`, `ImportService`

Use Actions for focused, one-off operations. Use Services when grouping related operations.

## When to Use

✅ Logic is more than "validate + save"
✅ Logic is reused across controllers, commands, observers or jobs
✅ Logic involves multiple models, external APIs, or side effects
✅ You want to test business logic independently from HTTP layer

## When NOT to Use

❌ Simple CRUD — `$model->update($request->validated())` can stay in the controller
❌ One-liner logic — don't create a class for a single Eloquent call

## Example

```php
final class CreateOrderAction
{
    public function __construct(
        private PaymentService $paymentService,
        private NotificationService $notificationService,
    ) {}

    public function execute(CreateOrderDTO $data): Order
    {
        $order = Order::create($data->toArray());

        $this->paymentService->charge($order);
        $this->notificationService->sendOrderConfirmation($order);

        return $order;
    }
}
```

## In Controllers

Inject via constructor or method injection:

```php
public function __invoke(
    CreateOrderRequest $request,
    CreateOrderAction $action,
): OrderResource {
    $order = $action->execute(CreateOrderDTO::fromRequest($request));
    return OrderResource::make($order);
}
```

