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
