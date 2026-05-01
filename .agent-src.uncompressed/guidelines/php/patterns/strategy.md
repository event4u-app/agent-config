# Strategy Pattern

> Choose the right algorithm at runtime — instead of if/else chains.

## Idea

Define a family of interchangeable algorithms behind an interface.
Select the implementation based on context (config, user input, enum value).

## Typical Use Cases

- Payment providers (Stripe, PayPal, Invoice)
- Export formats (CSV, PDF, Excel)
- Pricing / discount rules
- Notification channels (Email, SMS, Push)
- Import parsers (JSON, XML, CSV)

## Sniff test — when an enum/string discriminator wants to become a Strategy

Run these three questions **before** writing a second `match`/`switch` arm,
a second `if/elseif` branch, or a second hardcoded class per provider/type.
Two "yes" answers → extract Strategy + Registry. Three "yes" → it is
already overdue.

1. **Same-shape branches?** Do two or more branches/classes implement the
   *same operation* on the *same data*, differing only in provider-specific
   details (URL, field mapping, credentials, response parsing)?
2. **Closed-list edits?** Adding a new case requires editing an enum, a
   `match` block, an allowlist constant, *and* a service class — i.e. the
   change is mechanical but spans ≥3 files?
3. **Discriminator leakage?** Does the discriminator (`Type::FOO`,
   `'stripe'`, an `is_csv()` check) appear in ≥3 places that should not
   have to know about `FOO` specifically?

If yes → see *Refactoring recipe* below.

## Example

```php
interface DiscountStrategy
{
    public function calculate(int $subtotalInCents): int;
}

final class PercentageDiscount implements DiscountStrategy
{
    public function __construct(private int $percent) {}

    public function calculate(int $subtotalInCents): int
    {
        return Math::divide(Math::multiply($subtotalInCents, $this->percent), 100);
    }
}

final class FixedDiscount implements DiscountStrategy
{
    public function __construct(private int $amountInCents) {}

    public function calculate(int $subtotalInCents): int
    {
        return min($this->amountInCents, $subtotalInCents);
    }
}
```

## Selection via Enum

```php
enum DiscountType: string
{
    case PERCENTAGE = 'percentage';
    case FIXED = 'fixed';

    public function strategy(int $value): DiscountStrategy
    {
        return match ($this) {
            self::PERCENTAGE => new PercentageDiscount($value),
            self::FIXED => new FixedDiscount($value),
        };
    }
}
```

## Refactoring recipe — from discriminator to Strategy

Two anti-patterns appear in real codebases and both refactor into the same
Strategy + Registry shape. Each step is a separate commit so reviewers can
follow the safety chain.

### Sub-pattern A — *hardcoded single provider per class*

Each provider gets its own `FooImportService`, `FooJob`, `FooCommand`,
and every method body repeats `Provider::FOO->value` or
`Provider::FOO->getId()`. Adding a new provider means copy-pasting an
entire class tree.

```php
// Before — one class per provider, discriminator hardcoded.
final class StripeImportService
{
    public function id(): int     { return Provider::STRIPE->getId(); }
    public function name(): string { return Provider::STRIPE->value; }
    public function import(): void { /* Stripe-specific logic */ }
}

final class PaypalImportService
{
    public function id(): int     { return Provider::PAYPAL->getId(); }
    public function name(): string { return Provider::PAYPAL->value; }
    public function import(): void { /* PayPal-specific logic */ }
}
```

```php
// After — one interface, N strategies, one registry.
interface ImportStrategy
{
    public function provider(): Provider;
    public function import(): void;
}

final class StripeImport implements ImportStrategy
{
    public function provider(): Provider { return Provider::STRIPE; }
    public function import(): void       { /* Stripe-specific logic */ }
}
// ...PaypalImport implements ImportStrategy similarly.
```

Recipe (one commit per step):

1. Extract the interface (`ImportStrategy`) and move one provider class
   to implement it. Existing call sites keep using the old class.
2. Repeat for the remaining providers — still no callers changed.
3. Introduce the Registry (next section). Migrate call sites one by one
   from `new StripeImportService()` to `$registry->for(Provider::STRIPE)`.
4. Delete the old per-provider classes.

### Sub-pattern B — *allowlist constant on a single coordinator*

A central service holds an allowlist of supported discriminator values.
Every new provider edits the constant *and* a method that branches on it.

```php
// Before — closed-list edit per new provider.
final class EquipmentImportService
{
    private const FULL_SYNC_PROVIDERS = [
        Provider::STRIPE,
        Provider::PAYPAL,
        Provider::INVOICE,
    ];

    public function supportsFullSync(Provider $p): bool
    {
        return in_array($p, self::FULL_SYNC_PROVIDERS, true);
    }
}
```

The fix is a **capability flag on the strategy interface** — the strategy
declares its own capabilities, and the coordinator asks the strategy
instead of consulting an allowlist.

```php
interface ImportStrategy
{
    public function provider(): Provider;
    public function import(): void;
    public function supportsFullSync(): bool;   // capability flag
}
```

A new provider now adds itself by implementing the interface — no central
list to edit, no in_array call to maintain. The coordinator becomes:

```php
$strategy = $registry->for($provider);
if ($strategy->supportsFullSync()) {
    $strategy->fullSync();
}
```

## Registry companion

A Registry resolves the discriminator → strategy lookup that previously
lived in the `match` block. It owns the only place the enum is mapped to
classes; everything downstream sees only the interface.

```php
final class ImportStrategyRegistry
{
    /** @var array<string, ImportStrategy> */
    private array $byProvider;

    /** @param iterable<ImportStrategy> $strategies */
    public function __construct(iterable $strategies)
    {
        foreach ($strategies as $strategy) {
            $this->byProvider[$strategy->provider()->value] = $strategy;
        }
    }

    public function for(Provider $provider): ImportStrategy
    {
        return $this->byProvider[$provider->value]
            ?? throw new InvalidArgumentException(
                "No import strategy registered for {$provider->value}"
            );
    }
}
```

Wire-up in Laravel — tag the strategies, inject the tag into the registry:

```php
// In a ServiceProvider::register()
$this->app->tag([
    StripeImport::class,
    PaypalImport::class,
    InvoiceImport::class,
], 'import.strategies');

$this->app->bind(
    ImportStrategyRegistry::class,
    fn ($app) => new ImportStrategyRegistry($app->tagged('import.strategies')),
);
```

A new provider now adds itself by:

1. Implementing `ImportStrategy`.
2. Adding one line to the `tag()` call.

No `match` block grows. No allowlist edits. No coordinator method changes.

## When NOT to Use

❌ Only two cases with **trivial logic** — a simple `match` or ternary is
   enough. *"Trivial"* means the two arms each fit on one line and share
   no structural shape. Two arms that each call a method on a service
   are not trivial — see the sniff test.
❌ The "strategies" share no common interface or behavior — if the
   operations differ, you do not have a Strategy candidate.
❌ The discriminator is set once at boot and never re-evaluated — a
   single binding in the container is simpler than a Registry.

