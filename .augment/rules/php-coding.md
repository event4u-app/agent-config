---
type: "auto"
description: "Writing or reviewing PHP code — strict types, naming, comparisons, early returns, Eloquent conventions"
alwaysApply: false
source: package
---

# PHP Coding Rules

- `declare(strict_types=1)` in every **new** PHP file. Not required for existing files without it.
- Project `Math` helper for ALL business calculations. Never native arithmetic (`+`, `-`, `*`, `/`) for business math.
- Never `var_dump()`, `print_r()`, `dd()` — disallowed by PHPStan.
- Never `float` for money — `decimal` or `Math` helper.
- Strict comparison `===`/`!==`, Yoda style: `null === $var`.
- Early return over nested if/else.
- No one-liner if statements.
- Single quotes without interpolation. `sprintf()` for complex strings.
- Variables: `camelCase`. Array keys: `snake_case`. Constants: `UPPER_SNAKE_CASE`.
- Typed properties, parameters, return types — always.
- Constructor property promotion where sensible.

## Eloquent — Attribute Access

Read `eloquent_access_style` from `.agent-settings`. Default: `getters_setters`. See `eloquent` skill.

- **`getters_setters`**: Typed getter + fluent setter per attribute. Inside model: `getAttribute('col')`/`setAttribute('col', $val)`. Outside: getters/setters only.
- **`get_attribute`**: `getAttribute()`/`setAttribute()` everywhere.
- **`magic_properties`**: `$model->column_name` everywhere.

### Relationship Getters

- Every relationship MUST have typed getter **above** relationship method
- Inside getter: `$this->getAttribute('relationship_name')`, NEVER `$this->relationship_name`
- Outside model: ALWAYS getter (`$model->getEquipment()`), NEVER magic property
- `instanceof` checks over `null ===` for relationships

## Observers over `booted()`

- No `booted()`/`boot()` for lifecycle hooks
- Dedicated **Observer** via `#[ObservedBy]` attribute

## PHPStan

- Fix root cause. NEVER add to `phpstan-baseline.neon`.
- `ignoreErrors` in `phpstan.neon`: only for **structural toolchain limitations**. Not individual issues. **Unsure → ask.**
- Last resort (confirmed false positive):
  ```php
  // @phpstan-ignore-next-line — false positive: reason here
  ```

## Testing

- **Pest** syntax, not PHPUnit — unless explicitly asked.
- `tests/Unit/` auto-uses `UnitTestCase` (via `tests/Pest.php`).

## PHPDoc

- Only when type hints insufficient (e.g. `@param array<int, MyObject> $items`)
- Never repeat method signature
- One docblock per method
- Order: `@param` → `@return` → `@throws`
