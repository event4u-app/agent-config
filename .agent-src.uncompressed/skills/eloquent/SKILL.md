---
name: eloquent
description: "Use when writing Eloquent models, relationships, scopes, or queries via Model:: — 'fetch users with their orders'. NOT for PHPStan output, non-Eloquent services, or raw SQL questions."
source: package
---

# eloquent

## When to use

Use when creating/modifying Eloquent models, relationships, scopes, or writing database queries.

Do NOT use when:
- Schema design or query optimization (use `database` skill)
- Creating migrations only (use `migration-creator` skill)

## Procedure: Create or modify a model

### Step 0: Inspect

1. Check existing models — match property declarations, cast patterns, relationship style, scope naming.
2. Check for repositories — some projects use repository interfaces.
3. Understand the schema — check migrations for column names, types, constraints.
4. Check for multi-tenancy — which `$connection` to use?

### Step 1: Read attribute access style

Read `eloquent_access_style` from `.agent-settings`. Default: `getters_setters`.

| Value | Inside model | Outside model |
|---|---|---|
| `getters_setters` | `getAttribute()` / `setAttribute()` | Typed getters/setters |
| `get_attribute` | `getAttribute()` / `setAttribute()` | Same |
| `magic_properties` | `$this->column` | `$model->column` |

→ See guideline `php/eloquent.md` and `php-coding` rule for full conventions.

### Step 2: Build the model

1. Set `$connection`, `$table`, `$fillable`/`$guarded`, `$casts`, `$attributes` (defaults).
2. Add typed getters + fluent setters for each attribute (if `getters_setters` style).
3. Add relationship getter above each relationship method.
4. Add scopes for reusable query constraints.
5. Register Observer via `#[ObservedBy]` — never use `booted()`.

### Step 3: Write queries

- Always eager load relationships accessed in loops: `->with(['customer'])`.
- Always paginate list queries: `->paginate(15)`.
- Use `exists()` over `count() > 0`.
- Use `chunk()` / `lazy()` for large datasets.
- Constrain eager loads when only a subset is needed.

## Conventions

→ See guideline `php/eloquent.md` for getter/setter examples, relationship getters, observers, casts.
→ See guideline `php/database.md` for indexing, transactions, migrations.

### Validate

- Run PHPStan on model — must pass.
- Verify no N+1: check that all relationship access in loops uses eager loading.
- Confirm typed getters exist for every relationship.
- Run affected tests — must pass.

## Output format

1. Model class with typed getters/setters, relationships, and observer
2. Migration file if schema changes are needed

## Gotcha

- Never access relationships via magic properties — always use typed getter.
- N+1 queries are the #1 performance issue — always eager load.
- `getAttribute()` returns `mixed` — cast or type-check the result.
- `$model->save()` can silently fail without fillable/guarded config.

## Do NOT

- Do NOT put business logic in models — delegate to services.
- Do NOT access relationships in loops without eager loading.
- Do NOT use `Model::all()` without pagination on list endpoints.
- Do NOT use `booted()` for lifecycle hooks — use Observers with `#[ObservedBy]`.

## Auto-trigger keywords

- Eloquent
- model
- relationship
- scope
- accessor
- mutator
