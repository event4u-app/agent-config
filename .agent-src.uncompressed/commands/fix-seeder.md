---
name: fix-seeder
skills: [eloquent]
description: Scan seeder data files for broken foreign key references — find constants used without getReference() and fix them
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "the seeder is broken, foreign key errors in seeders"
  trigger_context: "seeder error output or recent edits in database/seeders/"
---

<!-- F2-deprecation-banner -->
> **Deprecated — use `/fix seeder`.** This standalone command
> is kept as a deprecation shim for one release cycle and routes to
> the same instructions below. New invocations should go through the
> `/fix` orchestrator (`commands/fix.md`).
<!-- /F2-deprecation-banner -->

# fix-seeder

Scans all `PhpDataSeeder` data files for foreign key references that use raw seeder constants
instead of `getReference()`. Raw constants don't trigger lazy initialization of the referenced
seeder, causing "items not available" errors when seeders run in unpredictable order.

## The Rule

In a seeder data file loaded by `FooSeeder`:

- **Own seeder constants** are OK: `FooSeeder::REFERENCE_KEY_X` (these are primary keys, not foreign keys)
- **Other seeder constants** are WRONG: `BarSeeder::REFERENCE_KEY_Y` (foreign key — must use `getReference()`)

### ✅ Correct — triggers lazy initialization

```php
'cat_id' => MaterialDeliveryBillCategorySeeder::getReference(
    MaterialDeliveryBillCategorySeeder::REFERENCE_CATEGORY_A
)->getId(),
```

### ❌ Wrong — raw constant, no lazy initialization

```php
'cat_id' => MaterialDeliveryBillCategorySeeder::REFERENCE_CATEGORY_A,
```

## Step 1: Run the scanner script

Run the automated scanner inside the Docker container:

```bash
docker compose exec -T <php-service> php .augment/scripts/scan-seeder-violations.php
```

The script (``.augment/scripts/scan-seeder-violations.php``) automatically:
1. Finds all `PhpDataSeeder` / `JsonDataSeeder` classes and their `$dataFile` paths
2. Scans each data file for foreign seeder constants used without `getReference()`
3. Distinguishes PHP files (auto-fixable) from JSON files (manual fix needed)

### What the scanner flags

**Violation** = a `Seeder::CONSTANT` used directly (not via `getReference()`)
where the seeder class is NOT the owner of the data file.

**Not flagged:**
- `OtherSeeder::getReference(...)` — correct
- `OtherSeeder::getReferences()` — correct
- `OwnSeeder::CONSTANT` — own primary key, correct
- Known exceptions (circular dependencies) — configured in the scanner script

### Known Exceptions

Currently there are **no exceptions**. All circular dependencies have been resolved.

**Pattern for resolving circular dependencies:** Use two-phase seeding. The data file seeds
records with placeholder values (e.g., empty arrays). The Seeder's `run()` method then updates
records with the real values using `getReference()`. Since `run()` is called after all seeders
are initialized, the circular dependency is broken.

Example: `UserWageTypeRuleSeeder` seeds `lohnart_lv` as empty arrays in the data file,
then populates them with project numbers via `ProjectSeeder::getReference()` in `run()`.

If a new exception is truly needed, add it to `.augment/scripts/scan-seeder-violations.php`
in the `$exceptions` array. Format: `'OwnerSeeder' => ['AllowedForeignSeeder']`.

## Step 2: Report findings

Present a table of all violations:

```
| # | Data File | Line | Violation | Owning Seeder |
|---|-----------|------|-----------|---------------|
| 1 | material-delivery-bill-catalog-data.php:11 | CategorySeeder::REFERENCE_A | CatalogSeeder |
```

Then ask the user:

> 1. Fix all violations automatically
> 2. Fix interactively (ask for each)
> 3. Report only — don't fix

## Step 3: Fix violations

For each violation, replace the raw constant with a `getReference()` call:

**Before:**
```php
'foreign_key_column' => OtherSeeder::REFERENCE_CONSTANT,
```

**After:**
```php
'foreign_key_column' => OtherSeeder::getReference(
    OtherSeeder::REFERENCE_CONSTANT
)->getId(),
```

### Choosing the getter method

- Default: `->getId()` (most foreign keys are IDs)
- If the column name suggests a different attribute, use the appropriate getter
  (e.g., `'name' => ...` might need `->getName()`)
- If unsure, check the referenced model's primary key or the column definition

### Extract to variable when referenced multiple times

If the same `getReference()` call would appear multiple times in one data file,
extract it to a variable at the top of the file:

```php
$category = MaterialDeliveryBillCategorySeeder::getReference(
    MaterialDeliveryBillCategorySeeder::REFERENCE_CATEGORY_A
);

return [
    [
        'cat_id' => $category->getId(),
        'cat_name' => $category->getName(),
    ],
];
```

## Step 4: Verify

After fixing, run the seeder to verify:

```bash
docker compose exec -T <php-service> php artisan db:seed --env=testing
```

If it fails, investigate and fix the remaining issues.

## Rules

- **Do NOT commit or push.** Only apply local changes.
- **Do NOT change the seeder classes** — only the data files.
- **Do NOT change the DataSeeder framework** — only fix data file references.
- When in doubt about the getter method, check the model class.
