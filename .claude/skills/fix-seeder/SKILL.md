---
name: fix-seeder
description: "Fix database seeder data files to use proper references"
disable-model-invocation: true
---

# fix-seeder

Scan `PhpDataSeeder` data files for raw seeder constants (should use `getReference()`). Raw constants = no lazy init = order-dependent errors.

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

Script auto: finds seeders + data files, scans for violations, distinguishes PHP (auto-fix) / JSON (manual).

**Violation** = `Seeder::CONSTANT` without `getReference()` where seeder ≠ data file owner. Correct usages not flagged.

**No exceptions** currently. Circular deps resolved via two-phase seeding (placeholders in data, real values in `run()`).

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

Default `->getId()`. Column suggests other attribute → use matching getter. Multiple refs → extract to variable:

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

`docker compose exec -T <php-service> php artisan db:seed --env=testing`

## Rules

- No commit/push. Only data files. No seeder class or framework changes.
