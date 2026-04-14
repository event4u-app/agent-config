---
name: php
description: "Use when writing modern PHP (8.2+) — strict typing, clean patterns, proper error handling, and best practices."
source: package
---

# php

## When to use

All PHP. Language syntax/typing/patterns. Project conventions → `coder`. Detect version from `composer.json` + Dockerfile (use lowest).

## Strict typing

- `declare(strict_types=1)` in every **new** file.
- Typed properties, parameters, and return types — always.
- Use union types: `string|int`, nullable: `?string`.
- Use intersection types (PHP 8.1+): `Countable&Iterator`.
- Use `never` return type for functions that always throw or exit.
- Use `void` for functions that return nothing.

## Modern PHP features

### Constructor property promotion
```php
public function __construct(
    private readonly string $name,
    private readonly int $age,
) {}
```

### Readonly properties and classes
```php
readonly class UserDto {
    public function __construct(
        public string $name,
        public string $email,
    ) {}
}
```

### Enums
```php
enum Status: string {
    case Active = 'active';
    case Inactive = 'inactive';

    public function label(): string {
        return match($this) {
            self::Active => 'Active',
            self::Inactive => 'Inactive',
        };
    }
}
```

### Match expressions
```php
$result = match($status) {
    'active' => 'green',
    'pending' => 'yellow',
    default => 'gray',
};
```

### Named arguments
```php
$user = new User(
    name: 'John',
    email: 'john@example.com',
    role: Role::Admin,
);
```

### Nullsafe operator
```php
$city = $user?->getAddress()?->getCity();
```

### First-class callable syntax
```php
$names = array_map($user->getName(...), $users);
```

### Fibers (PHP 8.1+)
Only use when the project explicitly uses async patterns.

## Code style

- **PSR-12** as baseline (enforced via ECS in most projects).
- `camelCase` for variables and methods.
- `PascalCase` for classes, interfaces, traits, enums.
- `UPPER_SNAKE_CASE` for constants.
- `snake_case` for array keys.
- Single quotes for strings without interpolation.
- Yoda comparisons: `null === $var`.
- Trailing commas in multiline arrays and parameter lists.
- Short array syntax `[]`, never `array()`.

## Control flow

- **Early return** over nested if/else.
- No one-liner if statements — always use braces.
- Use `match` over `switch` when returning values.
- Use null coalescing: `$value ?? $default`.
- Use null coalescing assignment: `$value ??= $default`.

## Error handling

- Use typed exceptions: extend `RuntimeException`, `InvalidArgumentException`, etc.
- Catch specific exceptions, not bare `\Exception` (unless re-throwing).
- Use `finally` for cleanup.
- Never swallow exceptions silently.

## Arrays and collections

- Use `array_map`, `array_filter`, `array_reduce` for transformations.
- Use spread operator for merging: `[...$a, ...$b]`.
- Use `array_key_exists()` vs `isset()` intentionally (null values differ).
- Type array contents in PHPDoc: `@param array<int, User> $users`.

## String handling

- Single quotes for plain strings: `'hello'`.
- Double quotes only for interpolation: `"Hello {$name}"`.
- Use `sprintf()` for complex formatting with multiple placeholders.
- Use `str_starts_with()`, `str_ends_with()`, `str_contains()` (PHP 8.0+).

## Type safety

- Prefer strict comparisons: `===` / `!==`.
- Use type declarations over PHPDoc where possible.
- Use `instanceof` for type checking.
- Avoid `mixed` — be specific about types.
- Use generics in PHPDoc for collections: `@param Collection<int, User>`.

## Gotcha

- The model sometimes generates PHP 8.1 syntax in a 8.2+ project — always use latest features.
- Don't use `match` without a default case — it throws `UnhandledMatchError`.
- `str_contains()` returns true for empty needle `''` — validate input first.

## Do NOT

- Do NOT use `float` for money — use `decimal` or the Math helper.
- Do NOT skip `declare(strict_types=1)` in new PHP files.
- Do NOT use loose comparisons (`==`/`!=`) — always `===`/`!==`.
- Do NOT use `var_dump()`, `print_r()`, or `dd()`.
- Do NOT use `@` error suppression, `eval()`, `extract()`, or `global`.


