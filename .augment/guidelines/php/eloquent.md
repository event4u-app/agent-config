# Eloquent Model Guidelines

**Skills:** `eloquent`, `database` | **Guidelines:** [patterns/repositories.md](patterns/repositories.md)

## Core Rules

- `$attributes` for all columns with DB defaults
- `$casts` for type casting
- Every attribute MUST have getter + fluent setter
- Fluent setters: `static` return (preserves subclass). `self` only for `final` or intentional

## Getter/Setter Architecture

Two layers — inside vs outside model. Never mix.

### Inside model

ALWAYS `getAttribute()`/`setAttribute()`. NEVER `$this->column_name`. Cast when NOT in `$casts`:

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

### Outside model — always getters/setters, never `getAttribute()`

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

## Relationship Getters — typed getter ABOVE relationship method, always use getter outside model

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

`instanceof` over `null ===`:

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

## Observers over `booted()` — Observer via `#[ObservedBy]`, no `booted()`/`boot()`

## Default Attributes

```php
protected $attributes = [
    'options' => [],
    'default_role' => 'staff',
    'verified' => false,
];
```

### Expressive Setters — prefer `activate()` over `setActive(true)`

```php
// ✅ Better — intent is clear
$model->activate();

// 🆗 OK but less expressive
$model->setActive(true);
```

## Model Updates — `$request->validated()`, never `$request->all()`

```php
// ✅ Good
$model->update($request->validated());

// ❌ Bad — passes unvalidated data
$model->update($request->all());
```

## No Redundant Casting — attribute in `$casts` → trust the cast, don't re-cast

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
