---
name: test-performance
description: "Use when optimizing test suite performance — database setup, seeder optimization, parallel testing, CI pipeline efficiency, or RefreshDatabase alternatives."
---

# test-performance

## When to use

Use this skill when:

- Tests are running too slowly (locally or in CI)
- Database setup/teardown is a bottleneck
- Parallel testing needs optimization
- Seeders need performance analysis
- CI pipeline test jobs need to be faster
- Investigating flaky tests caused by database state

## Analysis Workflow

### 1. Measure baseline

Before optimizing, always measure:

```bash
# Count tests per suite
find tests/ app/Modules/*/Tests/ -name "*.php" | xargs grep -l "it(" | wc -l

# Count by suite type
grep -rh "it(" tests/Unit/ app/Modules/*/Tests/Unit/ --include="*.php" | wc -l
grep -rh "it(" tests/Component/ app/Modules/*/Tests/Component/ --include="*.php" | wc -l
grep -rh "it(" tests/Integration/ app/Modules/*/Tests/Integration/ --include="*.php" | wc -l

# Count migrations
ls database/migrations/*.php | wc -l

# Count seeders
find database/seeders database/seeder-data -name "*.php" -path "*/data/*" | wc -l
```

### 2. Identify bottlenecks

The typical test lifecycle is:

```
Process Start → Migrate → Seed → [Test → Rollback] × N → Process End
                 ↑ expensive (once per worker)
```

Check these areas in order of typical impact:

| Area | What to check | Typical impact |
|------|--------------|---------------|
| **Migration count** | How many CREATE TABLE statements? | High if >20 |
| **Schema dump** | Is `database/schema/` used? | High if missing |
| **Seeder INSERT method** | Individual `save()` vs bulk insert? | Medium |
| **Truncation** | Per-seeder truncate vs centralized? | Low (but causes correctness issues) |
| **Connection discovery** | Dynamic `getPdo()` probing? | Low |
| **Parallel worker setup** | Does each worker re-migrate? | High |

### 3. Optimization strategies (ordered by ROI)

#### A. Schema Dump (highest ROI)

Laravel's `schema:dump` consolidates all migrations into one SQL file.
Instead of running N individual CREATE TABLE migrations, it loads one SQL dump.

```bash
php artisan schema:dump --database=api_database
# Generates database/schema/api_database-schema.sql
```

**Savings:** 58 migrations → 1 SQL load = ~10-25s per worker.

#### B. Template DB Cloning (high ROI for parallel tests)

Instead of each parallel worker running migrate+seed independently:
1. Prepare ONE template database (migrate + seed)
2. Clone template for each worker via mysqldump

```bash
# Prepare template
php artisan migrate:fresh --database=template_db
php artisan db:seed --database=template_db

# Clone per worker
mysqldump template_db | mysql worker_db_test_1
```

**Savings:** Eliminate per-worker migrate+seed entirely.

#### C. Skip Migrate+Seed Flag (high ROI for local dev)

Add a config flag to skip database setup when DB is already prepared:

```php
// config/testing.php
'skip_migrate_seed' => EnvHelper::boolean('TESTING_SKIP_MIGRATE_SEED', false),
```

Developer workflow: `make migrate-testing` once, then `make test-quick` repeatedly.

#### D. Bulk Inserts in Seeders (medium ROI)

Replace individual `$model->save()` with bulk insert:

```php
// Before: N INSERT statements
foreach ($data as $row) {
    $model = new MyModel($row);
    $model->save();
}

// After: 1 INSERT statement
MyModel::insert($data);
$models = MyModel::whereIn('id', $ids)->get();
```

#### E. Centralize Truncation (correctness fix)

Per-seeder truncation is redundant after `migrate:fresh` and causes:
- Non-deterministic ordering (lazy init triggers truncate)
- Ghost data bugs (locally passes, CI fails)

Make truncation configurable, default off:

```php
// config/testing.php
'seed_truncate' => EnvHelper::boolean('DB_SEED_TRUNCATE', false),
```

#### F. Static Connection Discovery (cleanup)

Replace dynamic `getPdo()` probing with explicit config:

```php
// config/testing.php
'connections_to_transact' => ['api_database', 'customer_database'],
```

### 4. CI-specific optimizations

- **MariaDB tmpfs:** Mount data dir on RAM disk for zero I/O latency
- **Shared DB prep:** One CI job prepares DB, test jobs clone from it
- **Cache test DBs:** Skip re-migration if migration files haven't changed
- **Separate suites:** Run no-DB tests (Unit) on cheaper runners

## Related project docs

- `agents/roadmaps/test-performance-refactor.md` — active roadmap for this project
- `agents/docs/seeders.md` — seeder conventions (if exists)

## Gotcha

- Don't use RefreshDatabase when DatabaseTransactions suffices — full refresh is 10x slower.
- The model forgets that parallel tests share the database — use unique identifiers in test data.
- Seeder optimization has the highest ROI — a 2s seeder running 100 times = 200s wasted.
- Don't add indexes to test databases just for test performance — the real fix is better test design.
