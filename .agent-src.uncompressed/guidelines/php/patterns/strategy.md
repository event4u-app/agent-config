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

## When NOT to Use

❌ Only two cases with trivial logic — a simple `match` or ternary is enough
❌ The "strategies" share no common interface or behavior

