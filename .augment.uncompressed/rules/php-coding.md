---
type: "auto"
description: "Writing or reviewing PHP code — strict types, naming, comparisons, early returns, Eloquent conventions"
alwaysApply: false
source: package
---

# PHP Coding Rules

- Use `declare(strict_types=1)` in every **new** PHP file. Not required when modifying existing files that don't have it.
- If the project has a `Math` helper class, use it for ALL business calculations. Never use native PHP arithmetic operators (`+`, `-`, `*`, `/`) for business calculations. Search for the `Math` class in the project.
- Never use `var_dump()`, `print_r()`, or `dd()` — they are disallowed by PHPStan config. Exception: legacy projects where these are already used and no alternative is feasible.
- Never use `float` for money — use `decimal` or the `Math` helper.
- Always use `===` / `!==` (strict comparison), Yoda style: `null === $var`.
- Early return over nested if/else.
- No one-liner if statements.
- Single quotes for strings without interpolation. `sprintf()` for complex strings.
- Variables: `camelCase`. Array keys: `snake_case`. Constants: `UPPER_SNAKE_CASE`.
- Typed properties, parameters, and return types — always.
- Constructor property promotion where it makes sense.

## Eloquent Models — Attribute Access

Read `eloquent_access_style` from `.agent-settings` to determine the preferred style.
Default: `getters_setters`. See the `eloquent` skill for the full reference table and examples.

- **`getters_setters`** (strict): Every attribute has a typed getter + fluent setter. Inside the model: `getAttribute('column_name')`/`setAttribute('column_name', $value)`. Outside: always getters/setters. If a getter doesn't exist yet, create it first.
- **`get_attribute`**: Use `getAttribute('column_name')`/`setAttribute('column_name', $value)` everywhere, no getters/setters needed.
- **`magic_properties`**: Laravel default `$model->column_name` everywhere.

### Relationship Getters

- Every relationship MUST have a typed getter method **above** the relationship method.
- **Inside the getter:** use `$this->getAttribute('relationship_name')`, NEVER `$this->relationship_name`.
- **Outside the model:** ALWAYS use the getter (`$model->getEquipment()`), NEVER access the magic property (`$model->equipment`).
- Use `instanceof` checks instead of `null ===` when checking relationship results.

## Eloquent Models — Observers over `booted()`

- Do NOT use `booted()` / `boot()` for model lifecycle hooks (saving, saved, deleted, etc.).
- Use a dedicated **Observer** class registered via `#[ObservedBy]` attribute.
- This keeps models slim and lifecycle logic testable and discoverable.

## PHPStan

- Always fix the root cause. Do NOT add entries to `phpstan-baseline.neon`.
- Adding `ignoreErrors` to `phpstan.neon` is allowed for **structural toolchain limitations** (e.g., Pest runtime bindings). NOT for individual code issues. **If unsure → ask the user.**
- If a fix is truly impossible (confirmed false positive), use an inline ignore as last resort:
  ```php
  // @phpstan-ignore-next-line — false positive: reason here
  ```

## Testing

- Always write tests in **Pest**, not PHPUnit class syntax — unless the user explicitly asks for PHPUnit.
- Pest tests in `tests/Unit/` automatically use `UnitTestCase` as the base class (configured in `tests/Pest.php`).

## PHPDoc

- Only add PHPDoc when type hints are insufficient (e.g. generic arrays: `@param array<int, MyObject> $items`).
- Do NOT add PHPDoc that just repeats the method signature.
- One docblock per method — never split into multiple `/** */` blocks.
- Tag order: `@param` → `@return` → `@throws`.
