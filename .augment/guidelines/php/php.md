# PHP Guidelines

**Skills:** `php`, `coder` | **Rules:** `php-coding.md`

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

## Naming — expressive, no abbreviations

- Boolean: `isValid()`, `hasPermission()`. Retrieval: `getUser()`. Actions: `sendEmail()`

## Strings — single quotes, `.` concatenation, `sprintf()` for complex only

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

## DocBlocks — only when type hints insufficient (`@param array<int, MyObject>`). No signature repetition.

## Arrays

- Short syntax only (`[]`, not `array()`)
- Trailing comma on each line
- Each item on a separate line
- Keys in `snake_case`

## Enums

- Cases must be **UPPERCASE**: `case MONDAY;`
- Use [backed enums](https://www.php.net/manual/en/language.enumerations.backed.php) for database values

## Operator Precedence — explicit parentheses when mixing `?:`, `??`, `.`

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

## Performance — avoid `array_merge()` in loops (O(n²))

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

## Return Types — `static` for fluent (preserves subclass), `self` for `final`/intentional

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

## Constructor Property Promotion — separate lines, trailing comma

