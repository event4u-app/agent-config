# Eloquent Model Guidelines

> Project-specific Eloquent conventions. Getter/setter pattern, casts, fillable, defaults.

**Related Skills:** `eloquent`, `database`, `migration-creator`
**Related Guidelines:** [patterns/repositories.md](patterns/repositories.md)

## Core Rules

- Add `$attributes` array for all columns with database defaults
- Use `$casts` for type casting (encrypted, arrays, enums, dates, booleans)
- Every model attribute MUST have a **getter** and a **fluent setter**
- Fluent setters: prefer `static` as return type (preserves subclass types). Use `self` when the class is `final` or when `self` is intentionally more precise.

## Getter/Setter Architecture

There are **two layers** — inside the model vs. outside the model. Never mix them up.

### Inside the model (implementing getters/setters)

**ALWAYS** use `getAttribute()` / `setAttribute()` — these are the Eloquent internals
that respect `$casts`, accessors, and mutators. **NEVER** use `$this->column_name`
magic property access inside the model — not for attributes, not for relationships.

**Cast the return value** when the attribute is NOT in `$casts`:

```php
// ✅ Good — getAttribute() with explicit cast (attribute NOT in $casts)
public function isActive(): bool
{
    return (bool) $this->getAttribute('active');
}

// user_id is not in $casts, so cast explicitly
public function getUserId(): ?int
{
    $value = $this->getAttribute('user_id');

    return null === $value ? null : (int) $value;
}

// ✅ Good — NO manual cast needed (attribute IS in $casts)
// protected $casts = ['is_paused' => 'boolean'];
public function isPaused(): bool
{
    return $this->getAttribute('is_paused');
}

// ❌ Bad — magic property access
public function isActive(): bool
{
    return (bool) $this->active;
}
```

Fluent setter pattern:
```php
public function setUserId(?int $userId): static
{
    $this->setAttribute('user_id', $userId);
    return $this;
}
```

### Outside the model (calling code: services, controllers, jobs, tests, etc.)

**Always use getters and setters. Never use `getAttribute()` / `setAttribute()` directly.**

```php
// ✅ Good — use getters/setters
$config->isPaused();
$config->setIsPaused(true)->save();
$name = $customer->getName();

// ❌ Bad — calling getAttribute/setAttribute from outside the model
$config->getAttribute('is_paused');
$config->setAttribute('is_paused', true)->save();

// ❌ Bad — direct property access
$config->is_paused;
$config->is_paused = true;
```

**Why:** Getters/setters provide type safety, IDE autocompletion, and a stable API.
If the underlying column changes, only the model internals need updating.

## Relationship Getters

Every relationship MUST have a **typed getter method** placed directly **above** the relationship method.
Outside the model, always use the getter — never access the magic property.

```php
// ✅ Good — getter uses getAttribute(), placed above the relationship method
public function getEquipment(): ?Equipment
{
    return $this->getAttribute('equipment');
}

public function equipment(): BelongsTo
{
    return $this->belongsTo(Equipment::class, 'item_id', 'item_id');
}

// ✅ Good — calling code uses getter
$equipment = $repair->getEquipment();

// ❌ Bad — magic property inside getter
public function getEquipment(): ?Equipment
{
    return $this->equipment;  // NEVER do this
}

// ❌ Bad — accessing magic property from outside the model
$equipment = $repair->equipment;
```

When checking if a relationship result exists, use `instanceof` instead of `null ===`:

```php
// ✅ Good — type-safe check
if (!$equipment instanceof Equipment) {
    return;
}

// ❌ Bad — less type-safe
if (null === $equipment) {
    return;
}
```

## Relationships and their constraints

An Eloquent relationship is a query helper. It declares nothing to the database.
The integrity the relationship assumes exists only if the migration declares it.

| Relationship | Constraint the schema owes it | Index half |
|---|---|---|
| `belongsTo` | foreign key on the child column, referencing the parent key | MySQL / MariaDB (InnoDB) create an index on the referencing columns when none leads with them ([MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html)); PostgreSQL does not ([PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK)) — add `->index()` there. Engine table and the Laravel `foreignId` caveat: [database.md § When to add indexes](database.md#when-to-add-indexes) |
| `hasOne` | foreign key on the child column **plus** `UNIQUE` on it — without the unique key, "one" is a convention a second insert breaks | the unique index serves as the foreign-key index on every engine |
| `belongsToMany` | pivot table with a composite primary key or `UNIQUE (a, b)`, and a foreign key on each side | the `(a, b)` key serves lookups from `a`; lookups from `b` need an index leading with `b`. InnoDB creates it for the `b` foreign key if none exists; on PostgreSQL declare `index(['b'])` yourself |
| `morphTo` / `morphMany` | **no foreign key is possible** — `*_id` points at a different table per `*_type` row | choose one: an **exclusive arc** (one nullable foreign key per parent type plus a CHECK that exactly one is set), **per-type tables** (`post_comments`, `video_comments`, each with a real foreign key), or a **recorded waiver** naming who cleans orphans and how |

Exclusive-arc CHECK, portable form:

```sql
CHECK ((CASE WHEN post_id  IS NULL THEN 0 ELSE 1 END)
     + (CASE WHEN video_id IS NULL THEN 0 ELSE 1 END) = 1)
```

MySQL enforces CHECK constraints from 8.0.16 and forbids `ON UPDATE` / `ON DELETE`
referential actions on columns a CHECK uses
([MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html)) —
an arc whose foreign keys need `cascade` or `set null` cannot carry this CHECK on
MySQL. Choose per-type tables there, or enforce the arc in the model and record it.

### A database cascade bypasses the model

`ON DELETE CASCADE` deletes child rows inside the database. Eloquent never loads
them, so no `deleting` / `deleted` model event fires, no Observer runs, and no
`SoftDeletes` or delete hook on the child executes. MySQL adds that cascaded
actions do not activate triggers either
([MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html)).
Eloquent's own mass delete has the same blind spot — `Model::where(...)->delete()`
dispatches no `deleting` / `deleted` events
([Laravel 12.x](https://laravel.com/docs/12.x/eloquent#events)).

| The child has | Delete it by |
|---|---|
| no model events, no Observer, no delete hook, no domain event | `->cascadeOnDelete()` — the database is faster and cannot forget |
| any of those | the model: load the children and delete each inside `DB::transaction()` on the parent's connection, then the parent; keep `restrict` on the foreign key so a forgotten path fails instead of orphaning |

Choosing the referential action itself:
[`laravel-migration`](../../skills/laravel-migration/SKILL.md)
§ Referential action is a decision. Why a SQLite test run does not prove this
holds on production: [database.md § Test-engine parity](database.md#test-engine-parity).

## Unique constraints under soft delete

`SoftDeletes` keeps the row, so a plain `UNIQUE (email)` blocks re-creating an
address whose previous owner was soft-deleted. The fix is a uniqueness that
covers live rows only, and its form depends on the engine:

| Engine | Form |
|---|---|
| **PostgreSQL** | partial unique index — `CREATE UNIQUE INDEX users_email_live ON users (email) WHERE deleted_at IS NULL` ([PostgreSQL 17](https://www.postgresql.org/docs/17/indexes-partial.html)) |
| **MySQL** | no partial indexes. Add a generated column that holds the key on live rows and `NULL` on deleted ones, and put `UNIQUE` on it — a `UNIQUE` index permits multiple `NULL` values ([MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-index.html)), and InnoDB indexes generated columns, virtual ones included ([MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-table-secondary-indexes.html)) |

```php
// PostgreSQL
DB::statement('CREATE UNIQUE INDEX users_email_live ON users (email) WHERE deleted_at IS NULL');

// MySQL
$table->string('email_live')->nullable()
    ->virtualAs('IF(deleted_at IS NULL, email, NULL)');
$table->unique('email_live');
```

For a scoped key — `UNIQUE (tenant_id, email)` — put `tenant_id` beside the
generated column (`UNIQUE (tenant_id, email_live)`) or into the partial index
column list; the `deleted_at` condition stays the same.

A soft delete never fires the foreign key's `onDelete` action — see
[`laravel-migration`](../../skills/laravel-migration/SKILL.md)
§ Referential action is a decision.

## Observers over `booted()`

Do NOT use `booted()` / `boot()` for model lifecycle hooks (`saving`, `saved`, `deleted`, etc.).
Use a dedicated **Observer** class registered via the `#[ObservedBy]` attribute.

```php
// ✅ Good — Observer registered via attribute
#[ObservedBy([RepairObserver::class])]
class Repair extends Model { /* ... */ }

// ❌ Bad — lifecycle logic in booted()
class Repair extends Model
{
    protected static function booted(): void
    {
        static::saving(static function (Repair $repair): void { /* ... */ });
    }
}
```

**Why:** Observers keep models slim, make lifecycle logic testable and discoverable,
and follow the established project pattern (all other models use `#[ObservedBy]`).

## Default Attributes

```php
protected $attributes = [
    'options' => [],
    'default_role' => 'staff',
    'verified' => false,
];
```

### Expressive Setters

Prefer expressive method names over generic setters when they improve readability:

```php
// ✅ Better — intent is clear
$model->activate();

// 🆗 OK but less expressive
$model->setActive(true);
```

## Model Updates

Always use validated data — never `$request->all()`:

```php
// ✅ Good
$model->update($request->validated());

// ❌ Bad — passes unvalidated data
$model->update($request->all());
```

## Prefer Model Casts — No Redundant Manual Casting

When an attribute is defined in `$casts` (or `casts()` method), do **not** manually cast it again
in getters. The model already handles the conversion.

```php
// ✅ Good — no manual cast needed, model handles it
public function isPaused(): bool
{
    return $this->getAttribute('is_paused');
}

// ❌ Bad — redundant (bool) cast when already in $casts
public function isPaused(): bool
{
    return (bool) $this->getAttribute('is_paused');
}
```

This applies to all cast types: `boolean`, `integer`, `float`, `array`, `datetime`, enums, etc.
If the attribute is cast, trust the cast — do not re-cast in PHP.
