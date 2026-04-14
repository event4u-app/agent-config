---
name: pest-testing
description: "Use when writing Pest tests for Laravel — clear intent, good coverage, maintainable structure, and alignment with project testing conventions."
source: package
---

# pest-testing

## When to use

All Laravel testing: feature, unit, API, model, service, auth, validation, DB tests, factories/fakes/mocks.

Extends `coder`, `laravel`, `eloquent`.

## Before writing tests

1. Read base skills (`coder`, `laravel`, `eloquent`)
2. Confirm Pest, inspect existing tests
3. Match current style (naming, helpers, datasets, structure)
4. Check factories/seeders — reuse patterns
5. Understand behavior under test before writing
6. Prefer existing helpers/assertions

## Core principles

Test behavior, not implementation. One test = one behavior. Minimal setup. Cover happy path + validation + auth failures + edge cases.

## TDD (Red-Green-Refactor)

1. **RED** — failing test for expected behavior
2. **Verify RED** — fails for right reason (not typo). Passes immediately → fix test
3. **GREEN** — minimal code to pass
4. **Verify GREEN** — all tests pass
5. **REFACTOR** — clean up, keep green

Bug fix: failing test reproducing bug FIRST, then fix. Tests after implementation prove nothing.

## Laravel: Feature tests for HTTP/validation/auth/middleware. Unit for isolated pure logic. Prefer Feature when framework integration matters. Reuse factories.

## Pest style: descriptive names, `it()`/`test()` per convention, datasets for readability, focused tests.

## Pest PHP rules

- No `readonly`/`final` on test classes
- No `use` for global classes (`Exception`, `DateTimeImmutable`) — Pest auto-imports
- Only `use` namespaced classes (`App\Models\...`)

## Flaky tests

- Time: `$this->travel(5)->seconds()` — never rely on `now()` differing between lines
- DB: don't assume null — parallel tests may modify records
- Parallel (8+ processes): no global state, row counts, auto-increment IDs

## HTTP/API: Test status codes, structure, validation errors, auth, persistence. JSON: assert relevant fields + error structure + DB state. Not just `200`.

## Validation: Cover required fields, invalid formats, boundaries, business constraints. Focused tests, not giant "all invalid".

## Authorization: Test guest, unauthorized, authorized. Don't assume policy works without testing.

## DB assertions: `assertDatabaseHas`/`Missing`, relation checks. Meaningful fields only.

## Snapshot testing with `coduo/php-matcher`

This project uses [`coduo/php-matcher`](https://github.com/coduo/php-matcher) for flexible snapshot assertions.
Pattern files live in `snapshots/` directories next to the test files.

### Pattern variables

Use pattern variables instead of hardcoded values in snapshot files.
This makes snapshots resilient to data changes while still enforcing type correctness.

| Pattern | Matches | Example |
|---|---|---|
| `@boolean@` | `true` or `false` | `'is_active' => '@boolean@'` |
| `@integer@` | Any integer | `'id' => '@integer@'` |
| `@string@` | Any string | `'name' => '@string@'` |
| `@null@` | `null` | `'deleted_at' => '@null@'` |
| `@datetime@` | ISO datetime string | `'created_at' => '@datetime@'` |
| `@uuid@` | UUID string | `'uuid' => '@uuid@'` |
| `@array@` | Any array | `'items' => '@array@'` |
| `@double@` | Any float | `'amount' => '@double@'` |
| `@wildcard@` | Anything | `'data' => '@wildcard@'` |

Combine with `||` for nullable fields: `'deleted_at' => '@null@||@datetime@'`

### Rules

- **Never hardcode dynamic values** (IDs, timestamps, UUIDs) in snapshots — use pattern variables or `$replacements`.
- **Never hardcode boolean defaults** (e.g., `false`) when other booleans in the same file use `@boolean@` — be consistent.
- Use `$variable ?? '@pattern@'` syntax to allow test-specific overrides via `replacements` parameter.
- Use `PhpMatcherHelper::ruleBackedEnum(EnumClass::class, 'string')` for enum fields.

### Example snapshot file

```php
// snapshots/user-resource.php
return [
    'id' => $id ?? '@integer@',
    'name' => $name ?? '@string@',
    'email' => $email ?? '@string@',
    'is_active' => $is_active ?? '@boolean@',
    'created_at' => $created_at ?? '@datetime@',
    'deleted_at' => $deleted_at ?? '@null@||@datetime@',
];
```

### Example test usage

```php
expect($response->json())
    ->toMatchPhpPatternFile(
        patternFile: __DIR__ . '/snapshots/user-resource.php',
        replacements: ['id' => $user->getId()],
    );
```

## Fakes/mocks: Laravel fakes (`Queue::fake()`, `Bus::fake()`, `Event::fake()`, `Mail::fake()`, `Notification::fake()`, `Storage::fake()`). Mock only external boundaries. 3+ mocks → Feature test instead.

## Factories: explicit state, named scenarios, realistic minimal data.

## Test smells

| Smell | Fix |
|---|---|
| Overmocking | Replace with real/fakes |
| Fragile | Assert meaningful fields only |
| Giant (5+ behaviors) | Split |
| Missing assertions | Add verification |
| Duplication | Consolidate/datasets |

## FIRST: Fast, Isolated, Repeatable, Self-validating, Timely.

## Do NOT: test private methods, over-mock internals, assert implementation details, giant multi-behavior tests, skip auth/validation coverage, use PHPUnit class syntax.

## Gotcha

- No `readonly`/`final` on test helpers — breaks mocking
- No `use` for global classes in Pest — auto-imported
- Use `travel(5)->seconds()` for time tests
- Parallel tests share DB — don't assume null
