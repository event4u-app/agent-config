---
name: eloquent
description: "Use when writing Eloquent models, relationships, scopes, queries, or database interactions. Covers eager loading, type safety, getter/setter conventions, and performance."
source: package
---

# eloquent

## When to use

Use this skill for all Eloquent and database interaction work, especially when working with:

- Models (properties, casts, relationships, scopes, accessors, mutators)
- Query Builder and Eloquent queries
- Eager loading and N+1 prevention
- Migrations and schema changes
- Transactions
- Pagination
- Mass assignment and fillable/guarded

This skill extends `coder` and `laravel`.

## Before writing code

1. **Read the base skills first** — apply `coder` and `laravel`.
2. **Inspect existing models** — match property declarations, cast patterns, relationship style, and scope naming.
3. **Check for repositories** — some projects use repository interfaces for data access. Check `./agents/` for conventions.
4. **Understand the database schema** — check migrations and existing models for column names, types, and constraints.
5. **Check for multi-tenancy** — some projects use multiple databases (API DB + customer DBs). Understand which connection to use.

## Model rules

- Models should contain: relationships, scopes, getters, setters, casts, and `$fillable`/`$guarded`.
- Models must NOT contain business logic, orchestration, or workflow decisions.
- Use `$casts` (or `casts()` method in Laravel 11) for date, boolean, JSON, enum, and custom types.
- Use typed properties where the project does so.
- Use `$fillable` or `$guarded` — never leave mass assignment unprotected.

## Attribute access style — read from `.agent-settings`

Read `eloquent_access_style` from `.agent-settings`. Default: `getters_setters`.

| Value | Inside model | Outside model |
|---|---|---|
| `getters_setters` | `$this->getAttribute()` / `$this->setAttribute()` | Typed getters/setters (`$model->getName()`, `$model->setName()`) |
| `get_attribute` | `$this->getAttribute()` / `$this->setAttribute()` | `$model->getAttribute()` / `$model->setAttribute()` |
| `magic_properties` | `$this->column_name` (Laravel default) | `$model->column_name` |

---

### Style: `getters_setters` (strict — recommended)

Every model attribute **must** have a typed getter and a fluent setter.

- **Inside the model:** ALWAYS use `$this->getAttribute('column_name')` / `$this->setAttribute('column_name', $value)`. NEVER use `$this->column_name` magic property access.
- **Inside getters:** cast the return value when the attribute is NOT in `$casts` (e.g. `(bool)`, `(int)`, `(string)`). If the attribute IS in `$casts`, trust the cast — do not re-cast.
- **Outside the model (services, controllers, jobs, Livewire, Filament, tests, etc.):** ALWAYS call getters/setters.
  **NEVER** call `getAttribute()` / `setAttribute()` from outside the model.
  **NEVER** use direct property access (`$model->column_name`).
- **If a getter/setter doesn't exist yet:** Create it in the model FIRST, then use it from outside.
  Do NOT use `getAttribute()` as a shortcut because the getter is missing — that defeats the purpose.

```php
// ✅ Calling code (service, controller, job, test, etc.)
$name = $customer->getName();
$customer->setName('Acme')->save();

// ❌ WRONG — getAttribute/setAttribute from outside the model
$name = $customer->getAttribute('name');
$customer->setAttribute('name', 'Acme')->save();

// ❌ WRONG — direct property access
$name = $customer->name;
$customer->name = 'Acme';
```

### Style: `get_attribute`

No getters/setters required. Use `getAttribute()` / `setAttribute()` everywhere.

```php
// ✅ Inside and outside the model
$name = $customer->getAttribute('name');
$customer->setAttribute('name', 'Acme')->save();

// ❌ WRONG — direct property access
$name = $customer->name;
```

### Style: `magic_properties`

Laravel default. Direct property access everywhere.

```php
// ✅ Inside and outside the model
$name = $customer->name;
$customer->name = 'Acme';
$customer->save();
```

---

See `.augment/guidelines/php/eloquent.md` for full details and examples.

## Relationship rules

- Define relationships with explicit return types.
- Name relationships clearly — match the related model or domain concept.
- Use relationship methods, not raw joins, for standard associations.
- Eager load relationships to prevent N+1 queries.
- Every relationship MUST have a **typed getter** placed directly **above** the relationship method.
- Outside the model: ALWAYS use the getter (`$model->getCustomer()`), NEVER the magic property (`$model->customer`).
- Use `instanceof` checks instead of `null ===` when checking relationship results.

```php
// ✅ Good — getter uses getAttribute(), placed above relationship
public function getCustomer(): ?Customer
{
    return $this->getAttribute('customer');
}

public function customer(): BelongsTo
{
    return $this->belongsTo(Customer::class);
}

// ❌ Bad — magic property inside getter
public function getCustomer(): ?Customer
{
    return $this->customer;  // NEVER do this
}

// Load with eager loading
$orders = Order::with(['customer', 'items'])->get();
```

## Observer rules — CRITICAL

- Do NOT use `booted()` / `boot()` for model lifecycle hooks (`saving`, `saved`, `deleted`, etc.).
- Use a dedicated **Observer** class registered via `#[ObservedBy]` attribute.
- This keeps models slim and lifecycle logic testable and discoverable.

```php
// ✅ Good — Observer via attribute
#[ObservedBy([RepairObserver::class])]
class Repair extends Model { /* ... */ }

// ❌ Bad — lifecycle logic in booted()
protected static function booted(): void
{
    static::saving(static function (Repair $repair): void { /* ... */ });
}
```

See `.augment/guidelines/php/eloquent.md` for full details and examples.

## Scope rules

- Use scopes for reusable query constraints.
- Name scopes clearly: `scopeActive`, `scopeForCustomer`.
- Keep scopes focused on one filtering concern.
- Prefer scopes over repeating `where()` clauses across the codebase.

```php
public function scopeActive(Builder $query): Builder
{
    return $query->where('status', Status::Active);
}
```

## Query rules

- Prefer Eloquent over raw SQL unless performance requires it.
- Use Query Builder for complex queries that don't map well to Eloquent.
- Always paginate large result sets — use `paginate()` or `cursorPaginate()`.
- Use `chunk()` or `lazy()` for processing large datasets to avoid memory issues.
- Select only needed columns when performance matters: `->select(['id', 'name'])`.
- Use `exists()` instead of `count() > 0` when checking existence.

## Eager loading rules

- Always eager load relationships that will be accessed — prevent N+1 queries.
- Use `with()` for upfront loading, `load()` for post-query loading.
- Use `withCount()` for counting related models without loading them.
- Constrain eager loads when only a subset is needed:
  ```php
  User::with(['posts' => fn ($q) => $q->where('published', true)])->get();
  ```

## Transaction rules

- Wrap multi-step write operations in transactions.
- Use `DB::transaction()` for simple cases.
- Handle transaction failures explicitly.
- Do not nest transactions without understanding savepoints.

```php
DB::transaction(function () use ($order, $items): void {
    $order->save();
    $order->items()->createMany($items);
});
```

## Migration rules

- Keep migrations focused — one logical change per migration.
- Always add proper constraints: foreign keys, indexes, not-null, defaults.
- Name columns in `snake_case`.
- Use proper column types (never `float` for money — use `decimal`).
- Make migrations reversible when possible (`down()` method).
- Follow existing naming conventions for table prefixes and column names.

## Performance rules

- Avoid loading entire tables — always filter or paginate.
- Use indexes for columns in `WHERE`, `ORDER BY`, and `JOIN` clauses.
- Use `explain()` to analyze slow queries.
- Prefer `pluck()` when only one column is needed.
- Use `insertOrIgnore()`, `upsert()` for bulk operations when appropriate.
- Avoid `$model->save()` in loops — use bulk operations.

## What NOT to do

- Do not put business logic in models.
- Do not use raw SQL when Eloquent/Query Builder is sufficient.
- Do not skip eager loading when relationships are accessed in loops.
- Do not use `get()` on unbounded queries — always filter or paginate.
- Do not use `float` columns for monetary values — use `decimal`.
- Do not create N+1 queries by accessing relationships in loops without eager loading.
- Do not mix model concerns with service/controller logic.


## Gotcha

- Never access relationships via magic properties (`$model->relation`) — always use the typed getter method.
- The model forgets eager loading on list queries — N+1 queries are the #1 performance issue.
- `getAttribute()` returns `mixed` — always cast or type-check the result.
- Don't use `booted()` for lifecycle hooks — use Observers with `#[ObservedBy]` attribute.
- `$model->save()` silently fails if the model has no fillable/guarded configuration — always check return value.

## Do NOT

- Do NOT put business logic in models — use services.
- Do NOT use $model->save() with unvalidated data.
- Do NOT access relationships in loops without eager loading.
- Do NOT use Model::all() without pagination on list endpoints.

## Auto-trigger keywords

- Eloquent
- model
- relationship
- scope
- accessor
- mutator
