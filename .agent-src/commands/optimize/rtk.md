---
name: optimize:rtk
tier: 2
cluster: optimize
sub: rtk
skills: [agent-docs-writing]
description: Create or optimize project-local rtk filters based on the actual toolchain
suggestion:
  eligible: false
  rationale: "Niche maintenance tool with no recurring NL trigger."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /optimize rtk
## Instructions

### 1. Check rtk is installed

```bash
which rtk
```

- If **not installed** → stop. This command requires rtk. Suggest running the install flow from the `rtk-output-filtering` skill.

### 2. Detect the project toolchain

Scan the project to determine which CLI tools are used:

| Detection                                                                                      | Tool                       |
|------------------------------------------------------------------------------------------------|----------------------------|
| `composer.json` contains `phpstan` or `larastan`                                               | PHPStan                    |
| `composer.json` contains `pestphp/pest` or `phpunit/phpunit`                                   | Pest / PHPUnit             |
| `composer.json` contains `symplify/easy-coding-standard`                                       | ECS                        |
| `composer.json` contains `rector/rector`                                                       | Rector                     |
| `composer.json` contains scripts like `quality:phpstan`                                        | Artisan / Composer quality wrappers |
| `package.json` contains `typescript`                                                            | tsc                        |
| `package.json` contains `eslint`                                                                | ESLint                     |
| `package.json` contains `prettier`                                                              | Prettier                   |
| `package.json` contains `@biomejs/biome`                                                        | Biome                      |
| `package.json` contains `vitest`                                                                | Vitest                     |
| `package.json` contains `jest`                                                                  | Jest                       |
| `package.json` contains `playwright` / `@playwright/test`                                       | Playwright                 |
| `pyproject.toml` / `requirements*.txt` contains `ruff`                                          | Ruff                       |
| `pyproject.toml` / `requirements*.txt` contains `mypy` / `pyright`                              | mypy / Pyright             |
| `pyproject.toml` / `requirements*.txt` contains `pytest`                                        | pytest                     |
| `.golangci.yml` exists OR `golangci-lint` in `go.mod` tool dependencies                         | golangci-lint              |
| `go.mod` exists                                                                                 | `go test` / `go vet`       |
| `Cargo.toml` exists                                                                             | cargo (build / test / clippy / fmt) |
| `Gemfile` contains `rubocop` / `standard`                                                       | RuboCop / Standard         |
| `docker-compose.yml` or `docker-compose.yaml` exists                                            | Docker Compose             |
| `Makefile` exists                                                                               | Make targets               |

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

| Tool           | Noise to strip                                                               |
|----------------|------------------------------------------------------------------------------|
| PHPStan        | Progress bars (`\d+/\d+`), separator lines (`━`), notes                      |
| Pest / PHPUnit | Empty lines, box-drawing chars (`│`, `⇂`)                                    |
| ECS / Rector   | Separator lines, empty lines                                                 |
| Composer       | Download progress, "Loading composer"                                        |
| tsc            | Progress dots, repeated cache-hit notes, watch-mode banners                  |
| ESLint         | Numeric prefix per line (`123:45`), summary divider, `0 errors / 0 warnings` |
| Prettier       | File-list output when only formatting (`✔ src/foo.ts`)                       |
| Vitest / Jest  | Spinner frames, watch banner, coverage summary table when not requested      |
| Playwright     | Browser launch banner, retry notices, trace-file paths repeated per run      |
| Ruff           | Progress (`Checking N files`), repeated file headers in `--watch`            |
| mypy / Pyright | `Daemon running` banners, success summary repeated per file                  |
| golangci-lint  | Progress (`linters`), divider lines between linters                          |
| `go test`      | `=== RUN` / `--- PASS` per sub-test (suppress in passing runs)               |
| Cargo          | `   Compiling …` lines for dependencies, `Finished release` banner           |
| npm / yarn     | Audit warnings, funding messages                                             |
| Docker Compose | Build-context lines, pull progress                                           |

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

### 7. Present results (verbosity-gated)

Read `verbosity.post_action_reports` from `.agent-settings.yml` (default
`minimal`).

- `off` → emit nothing on success; surface errors only.
- `minimal` (default) → one line: `→ N filters configured in .rtk/rtk.toml`.
- `full` → multi-line summary table:

  ```
  | #   | Filter       | Match                                                         | Max  |
  |-----|--------------|---------------------------------------------------------------|------|
  | 1   | phpstan      | phpstan\|quality:phpstan\|vendor/bin/phpstan                  | 80   |
  | 2   | pest         | pest\|phpunit\|artisan test                                   | 60   |
  | 3   | tsc          | tsc\|tsc --noEmit                                             | 60   |
  | 4   | eslint       | eslint\|next lint                                             | 50   |
  | 5   | vitest       | vitest\|jest                                                  | 50   |
  | 6   | playwright   | playwright\|@playwright/test                                  | 40   |
  | 7   | ruff         | ruff check\|ruff format                                       | 60   |
  | 8   | mypy         | mypy\|pyright                                                 | 50   |
  | 9   | pytest       | pytest\|python -m pytest                                      | 50   |
  | 10  | golangci     | golangci-lint\|go vet                                         | 50   |
  | 11  | gotest       | go test                                                       | 40   |
  | 12  | cargo        | cargo build\|cargo check\|cargo clippy\|cargo test\|cargo fmt | 50   |
  | ... | ...          | (add per project as the toolchain grows)                      | ...  |
  ```

### Rules

- **Do NOT delete** existing custom filter entries — only add or update.
- **Do NOT commit or push** — the user decides when to commit.
- Always set `strip_ansi = true` — there is no reason to keep ANSI in LLM context.
- If unsure about a tool's noise patterns, check recent command output or ask the user.
- The `.rtk/` directory should be versioned in Git (not in `.gitignore`).
