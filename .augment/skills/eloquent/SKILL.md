---
name: eloquent
description: "Use when writing Eloquent models, relationships, scopes, queries, or database interactions. Covers eager loading, type safety, getter/setter conventions, and performance."
---

# eloquent

## When to use

Eloquent models, queries, relationships, scopes, migrations, transactions, eager loading, mass assignment.

Extends `coder` and `laravel`.

## Before: read base skills, inspect existing models, check for repositories, understand schema, check multi-tenancy.

## Model rules

Models contain: relationships, scopes, getters, setters, casts, `$fillable`/`$guarded`. NO business logic. Use `$casts`, typed properties, mass assignment protection.

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

## Scopes: reusable query constraints, clear names (`scopeActive`), focused, prefer over repeated `where()`.

## Queries: Eloquent over raw SQL, paginate large sets, `chunk()`/`lazy()` for bulk, `exists()` not `count() > 0`.

## Eager loading: always `with()` for accessed relations, `load()` post-query, `withCount()`, constrain with closure.

## Transactions: wrap multi-step writes, `DB::transaction()`, handle failures, understand savepoints.

## Migrations: focused, proper constraints (FK, index, not-null), `snake_case`, `decimal` not `float`, reversible.

## Performance: filter/paginate always, indexes on WHERE/ORDER/JOIN, `explain()`, `pluck()`, bulk ops not loops.

## Gotcha: never magic property for relations (use getter), N+1 = #1 issue, `getAttribute()` returns mixed, no `booted()` (use Observers), check save() return.

## Do NOT: business logic in models, raw SQL when Eloquent works, skip eager loading, unbounded `get()`, float for money, relations in loops without eager loading.
