# Dependency Injection & Interfaces

> Decouple classes from concrete implementations.

## Idea

Classes depend on **interfaces** (contracts), not on concrete classes.
Laravel's Service Container resolves the binding at runtime.

## When to Use

✅ Multiple implementations possible (e.g., payment gateways, notification channels)
✅ External services that need mocking in tests
✅ Repository pattern (contract + database implementation)

## When NOT to Use

❌ Only one implementation exists and is unlikely to change — just inject the concrete class
❌ Simple utility classes with no side effects

## Example

```php
// Contract
interface PaymentGateway
{
    public function charge(int $amountInCents): PaymentResult;
}

// Implementation
final class StripePaymentGateway implements PaymentGateway
{
    public function charge(int $amountInCents): PaymentResult
    {
        // Stripe API call...
    }
}
```

## Binding in ServiceProvider

```php
$this->app->bind(PaymentGateway::class, StripePaymentGateway::class);
```

## Naming

- Interfaces (contracts): descriptive name without suffix — `PaymentGateway`, `SmsProvider`
- Implementations: prefixed with technology — `StripePaymentGateway`, `TwilioSmsProvider`
- Namespace: `App\Contracts\` for interfaces

## Rules

- One interface = one responsibility (Interface Segregation)
- Bind in the module's ServiceProvider, not in AppServiceProvider
- Do **NOT** mark implementation classes `final` if they need mocking in tests

