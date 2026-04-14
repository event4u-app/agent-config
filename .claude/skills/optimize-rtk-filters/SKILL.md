---
name: optimize-rtk-filters
description: "Optimize Rtk Filters"
disable-model-invocation: true
---

# optimize-rtk-filters

## Instructions

### 1. Check rtk is installed

```bash
which rtk
```

- If **not installed** → stop. This command requires rtk. Suggest running the install flow from the `rtk` rule.

### 2. Detect toolchain

| Check | Tool detected |
|---|---|
| `composer.json` contains `phpstan` or `larastan` | PHPStan |
| `composer.json` contains `pestphp/pest` or `phpunit/phpunit` | Pest / PHPUnit |
| `composer.json` contains `symplify/easy-coding-standard` | ECS |
| `composer.json` contains `rector/rector` | Rector |
| `composer.json` contains `galawork/php-quality` or scripts like `quality:phpstan` | Artisan quality wrapper |
| `package.json` contains `playwright` | Playwright |
| `package.json` contains `vitest` or `jest` | JS test runner |
| `package.json` contains `biome` or `eslint` | JS linter |
| `package.json` contains `typescript` | TypeScript compiler |
| `docker-compose.yml` or `docker-compose.yaml` exists | Docker Compose |
| `Makefile` exists | Make targets |
| `Cargo.toml` exists | Rust / Cargo |
| `go.mod` exists | Go |

### 3. Read existing filters (preserve custom entries)

### 4. Generate filters per detected tool

```toml
[filters.<tool-name>]
description = "<one-line description>"
match_command = "<regex matching the tool's command>"
strip_ansi = true
strip_lines_matching = [<patterns for noise lines>]
max_lines = <appropriate limit>
```

Rules: `strip_ansi = true` always. `max_lines`: linters 80, tests 60, builds 40, status 30. `match_command`: match both direct + wrapper invocations.

**Common noise patterns per tool:**

| Tool | Noise to strip |
|---|---|
| PHPStan | Progress bars (`\d+/\d+`), separator lines (`━`), notes |
| Pest/PHPUnit | Empty lines, box-drawing chars (`│`, `⇂`) |
| ECS/Rector | Separator lines, empty lines |
| Composer | Download progress, "Loading composer" |
| Docker Compose | Build context lines, pull progress |
| npm/yarn | Audit warnings, funding messages |
| Playwright | Browser download progress |
| cargo | Compiling lines (keep errors), download progress |

### 5. Write `.rtk/filters.toml` — `schema_version = 1`, preserve custom entries

### 6. Verify: `rtk config 2>&1 | tail -5`

### 7. Summary table

```
| # | Filter | Match | Max Lines |
|---|---|---|---|
| 1 | phpstan | phpstan\|quality:phpstan\|vendor/bin/phpstan | 80 |
| 2 | pest | pest\|phpunit\|artisan test | 60 |
| ... | ... | ... | ... |
```

### Rules

- Don't delete custom entries. No commit/push. Always `strip_ansi = true`. `.rtk/` versioned in Git.
