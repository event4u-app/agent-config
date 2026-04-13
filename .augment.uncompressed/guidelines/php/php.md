# PHP Guidelines

> PHP conventions and coding standards.

**Related Skills:** `php`, `coder`, `php-service`
**Related Rules:** `php-coding.md`

## Quick Reference

| Topic           | Rule                                                  |
|-----------------|-------------------------------------------------------|
| Strict types    | `declare(strict_types=1);` in every file              |
| Variables       | `camelCase`                                           |
| Array keys      | `snake_case`                                          |
| Constants       | `UPPER_SNAKE_CASE`                                    |
| Strings         | Single quotes (no interpolation), prefer concatenation (`.`), `sprintf()` only when complex |
| Comparisons     | Always `===` / `!==`, Yoda style (`null === $var`)    |
| Types           | Explicit types for properties, parameters, returns    |

## Naming

- Method names must be **expressive**, not declarative. No abbreviations.
- Boolean checks: `isValid()`, `hasPermission()` — not `valid()`, `check()`
- Retrieving: `getUser()`, `fetchUserData()` — not `user()`, `userData()`
- Actions: `sendEmail()`, `processPayment()` — not `email()`, `payment()`

## Strings

- Single quotes when no interpolation: `$table = 'users';`
- Prefer concatenation with `.` operator: `'Hi ' . $name . '!'`
- Use `sprintf()` only when concatenation becomes unreadable (many placeholders, formatting): `sprintf('There are %d items in %s', $count, $location)`

## Control Structures

- **No one-liner IF** statements
- **Prefer early return** over `else` / nested `if`
- Ternary for short statements only

```php
// ✅ Early return
if (!$conditionA) {
    return;
}
// conditionA passed...
```

## Typed Properties

- Always use typed properties. Nullable with default `null`:

```php
// ✅ Good
public ?int $age = null;

// ❌ Bad
public int | null $age;
```

## Typed Arguments

- Prefer typed method arguments over arrays. Named arguments with spread for bulk:

```php
// ✅ Type-safe
public function createUser(int $id, string $name): void {}

// Call with array via spread
$data = ['id' => 1, 'name' => 'John'];
createUser(...$data);
```

## DocBlocks

- **Only** use DocBlocks to explain complex logic or when type hints are insufficient
- **Must** add DocBlock for iterable types: `@param array<int, MyObject> $items`
- Do NOT add DocBlocks that just repeat the type signature

## Arrays

- Short syntax only (`[]`, not `array()`)
- Trailing comma on each line
- Each item on a separate line
- Keys in `snake_case`

## Enums

- Cases must be **UPPERCASE**: `case MONDAY;`
- Use [backed enums](https://www.php.net/manual/en/language.enumerations.backed.php) for database values

## Operator Precedence — Always Use Parentheses

When mixing `?:` (ternary/elvis), `??` (null coalessce), or `.` (concatenation),
**always use explicit parentheses** to make the intended evaluation order unambiguous.

```php
// ❌ Bad — ambiguous: is it ($a ?: 'index ') . $i  or  $a ?: ('index ' . $i)?
$label = $a ?: 'index ' . $i;

// ✅ Good — explicit and unambiguous
$label = $a ?: ('index ' . $i);

// ❌ Bad — nested ternary/elvis without grouping
$value = $a ?: $b ?: $c . $d;

// ✅ Good
$value = $a ?: ($b ?: ($c . $d));
```

This applies to **any** combination of operators where precedence is not immediately obvious.
When in doubt, add parentheses — readability beats brevity.

## Performance Tips

### ❌  Avoid `array_merge()` in Loops

`array_merge()` inside a loop copies the entire array each iteration → **O(n²)**.

```php
// ❌ Bad — O(n²)
$all = [];
foreach ($pages as $page) {
    $all = array_merge($all, $page->items());
}

// ✅ Good — O(n)
$all = [];
foreach ($pages as $page) {
    array_push($all, ...$page->items());
}
```

## Traits

- One `use` statement per line:

```php
// ✅ Good
use TraitA;
use TraitB;
```

## Interfaces

- Namespace: `App\Contracts` (grouped in subfolders)
- No `Interface` suffix: `SmsProvider`, not `SmsProviderInterface`

## Return Types — `static` vs `self`

- **Prefer `static`** for fluent methods (setters, builders, chainable methods) — it preserves the actual class type in subclasses.
- **Use `self`** when it is intentionally more precise — e.g., `final` classes, named constructors, or when you explicitly want to lock the return type to the declaring class.
- This is especially important for Eloquent models, DTOs, and any class that may be extended.

```php
// ✅ Preferred — preserves subclass type
public function setName(string $name): static
{
    $this->name = $name;
    return $this;
}

// ✅ Also fine — class is final, self is more precise
final class Config
{
    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }
}
```

## Constructor Property Promotion

- Each property on a separate line, trailing comma on last property
- Preferred over manual assignment in constructor body

