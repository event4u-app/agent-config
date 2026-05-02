---
name: optimize-rtk-filters
skills: [agent-docs-writing]
description: Create or optimize project-local rtk filters based on the actual toolchain
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Niche maintenance tool with no recurring NL trigger."
superseded_by: optimize rtk
deprecated_in: "1.15.0"
---

> ⚠️  /optimize-rtk-filters is deprecated; use /optimize rtk instead.
> This shim is retained for one release cycle (1.15.0 → next minor) and forwards to the same instructions below. See [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

# optimize-rtk-filters

## Instructions

### 1. Check rtk is installed

```bash
which rtk
```

- If **not installed** → stop. This command requires rtk. Suggest running the install flow from the `rtk-output-filtering` skill.

### 2. Detect the project toolchain

Scan the project to determine which CLI tools are used:

| Check | Tool detected |
|---|---|
| `composer.json` contains `phpstan` or `larastan` | PHPStan |
| `composer.json` contains `pestphp/pest` or `phpunit/phpunit` | Pest / PHPUnit |
| `composer.json` contains `symplify/easy-coding-standard` | ECS |
| `composer.json` contains `rector/rector` | Rector |
| `composer.json` contains scripts like `quality:phpstan` | Artisan quality commands |
| `package.json` contains `playwright` | Playwright |
| `package.json` contains `vitest` or `jest` | JS test runner |
| `package.json` contains `biome` or `eslint` | JS linter |
| `package.json` contains `typescript` | TypeScript compiler |
| `docker-compose.yml` or `docker-compose.yaml` exists | Docker Compose |
| `Makefile` exists | Make targets |
| `Cargo.toml` exists | Rust / Cargo |
| `go.mod` exists | Go |

### 3. Read existing filters

```bash
cat .rtk/filters.toml 2>/dev/null || echo "NO_FILTERS_FILE"
```

- If file exists → read it, preserve custom entries the user may have added.
- If file does not exist → create `.rtk/` directory.

### 4. Generate optimized filters

For each detected tool, create a filter entry following this template:

```toml
[filters.<tool-name>]
description = "<one-line description>"
match_command = "<regex matching the tool's command>"
strip_ansi = true
strip_lines_matching = [<patterns for noise lines>]
max_lines = <appropriate limit>
```

**Filter design rules:**

- `strip_ansi = true` — always, ANSI codes waste tokens.
- `strip_lines_matching` — target empty lines, progress bars, framework boilerplate, download indicators.
- `max_lines` — set based on typical output size:
  - Linters/static analysis: 80
  - Test runners: 60
  - Build tools: 40
  - Status commands: 30
- `match_command` — use regex that matches both direct invocation and artisan/npm wrappers.

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

### 5. Write the filters file

Save to `.rtk/filters.toml` in the project root.

- Always start with `schema_version = 1` and a header comment.
- Include a comment referencing the project name.
- Preserve any existing custom filters the user added manually.

### 6. Verify

Run a quick test to confirm rtk picks up the filters:

```bash
rtk config 2>&1 | tail -5
```

### 7. Present results

Show a summary table:

```
| # | Filter | Match | Max Lines |
|---|---|---|---|
| 1 | phpstan | phpstan\|quality:phpstan\|vendor/bin/phpstan | 80 |
| 2 | pest | pest\|phpunit\|artisan test | 60 |
| ... | ... | ... | ... |
```

### Rules

- **Do NOT delete** existing custom filter entries — only add or update.
- **Do NOT commit or push** — the user decides when to commit.
- Always set `strip_ansi = true` — there is no reason to keep ANSI in LLM context.
- If unsure about a tool's noise patterns, check recent command output or ask the user.
- The `.rtk/` directory should be versioned in Git (not in `.gitignore`).
