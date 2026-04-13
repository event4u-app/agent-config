# Roadmap: Remove Galawork-specific references from shared agent config

> Make all `.augment/` files project-agnostic by replacing hardcoded galawork commands with tool-detection logic, so the package works for any PHP/JS project.

## Prerequisites

- [ ] Read `src/AgentConfigPlugin.php` — understand what gets shipped
- [ ] Read `.augment/skills/quality-tools/SKILL.md` — current quality tool docs
- [ ] Read `.augment/rules/quality-workflow.md` — current workflow rules

## Context

The `event4u/agent-config` package ships `.augment/` to all target projects. Currently, 14+ files
contain references to `galawork/php-quality` commands (`quality:phpstan`, `quality:rector`, etc.),
galawork-specific config paths (`config-dev/php-quality/`), and project-specific commands
(`migrate:customers`, `local.galawork.de`).

These should be replaced with **tool-detection logic**: check what's installed in the target project
and use the appropriate native commands.

- **Feature:** `agents/features/multi-agent-compatibility.md`
- **Jira:** none

## Tool Detection Logic

The agent should detect which tools are available and use the correct commands:

```
composer.json has "galawork/php-quality"          → php artisan quality:* (wrapper)
composer.json has "phpstan/phpstan" or "larastan"  → vendor/bin/phpstan analyse
composer.json has "rector/rector"                  → vendor/bin/rector process
composer.json has "symplify/easy-coding-standard"  → vendor/bin/ecs check
none installed                                     → skip, inform user
```

**Priority:** galawork/php-quality wrapper wins if installed (it wraps all three with extras like
git-aware execution, caching, baseline management).

Config file locations:

| Tool | galawork/php-quality | Native |
|---|---|---|
| PHPStan | `config-dev/php-quality/phpstan.neon` or `phpstan.neon` (root) | `phpstan.neon` or `phpstan.neon.dist` |
| Rector | `config-dev/php-quality/rector.php` or `rector.php` (root) | `rector.php` |
| ECS | `config-dev/php-quality/ecs.php` or `ecs.php` (root) | `ecs.php` |

---

## Affected Files Inventory

### Category 1: Quality commands (14 files)

Files referencing `quality:phpstan`, `quality:rector`, `quality:ecs`, `quality:finalize`, `quality:refactor`:

| # | File (in `.augment.uncompressed/`) | References |
|---|---|---|
| 1 | `skills/quality-tools/SKILL.md` | **Primary source** — full command reference, config paths |
| 2 | `rules/quality-workflow.md` | Workflow steps, prerequisite, commands |
| 3 | `rules/verify-before-complete.md` | "Common verification commands" section |
| 4 | `rules/docker-commands.md` | Docker exec examples |
| 5 | `commands/bug-fix.md` | Quality check step |
| 6 | `commands/fix-ci.md` | CI failure fix commands |
| 7 | `commands/quality-fix.md` | Quality fix detection |
| 8 | `skills/code-review/SKILL.md` | "Before PR: quality:finalize" |
| 9 | `skills/git-workflow/SKILL.md` | PR checklist, pre-PR steps |
| 10 | `skills/dependency-upgrade/SKILL.md` | Post-upgrade quality check |
| 11 | `skills/merge-conflicts/SKILL.md` | Post-merge PHPStan check |
| 12 | `skills/refactorer/SKILL.md` | Quality verification step |
| 13 | `skills/copilot/SKILL.md` | Config paths (`config-dev/php-quality/`) |
| 14 | `templates/roadmaps.md` | Quality gates section |

### Category 2: Config paths (3 files)

Files referencing `config-dev/php-quality/`:

| # | File | References |
|---|---|---|
| 1 | `skills/quality-tools/SKILL.md` | Full config table with 8 files |
| 2 | `skills/copilot/SKILL.md` | Config path table |
| 3 | `rules/quality-workflow.md` | Config file table |

### Category 3: galawork/php-quality wrapper internals (1 file)

| # | File | References |
|---|---|---|
| 1 | `skills/quality-tools/SKILL.md` | `galawork-quality` CLI, EcsPreset, RectorPreset |

### Category 4: Multi-tenant specifics (1 file)

| # | File | References |
|---|---|---|
| 1 | `skills/migration-creator/SKILL.md` | `migrate:customers`, `local.galawork.de`, FQDN routing |

### Category 5: Package name example (1 file)

| # | File | References |
|---|---|---|
| 1 | `commands/optimize-augmentignore.md` | `galawork/galawork-api` example |

### Category 6: Composer skill (1 file)

| # | File | References |
|---|---|---|
| 1 | `skills/composer/SKILL.md` | Example `quality:phpstan` composer script |

---


## Phase 1: Rewrite quality-tools skill (primary source)

This is the central file — all other files should reference it instead of duplicating commands.

Source: `.augment.uncompressed/skills/quality-tools/SKILL.md`

### Step 1.1: Replace prerequisite section

Current: `Requires galawork/php-quality in composer.json.`

New: Tool detection table — check `composer.json` for installed tools, use first matching style.
Priority: `galawork/php-quality` wrapper wins if installed (adds git-aware execution, caching, baseline mgmt).

- [ ] Replace prerequisite with tool detection table (galawork wrapper, phpstan, rector, ecs)
- [ ] Remove "NEVER call tools directly" rule — tools ARE called directly when no wrapper

### Step 1.2: Add dual command format for all commands

For every command, show both wrapper and native. Native first, wrapper as alternative:

```bash
# Native (default):
vendor/bin/phpstan analyse
# With galawork/php-quality wrapper:
php artisan quality:phpstan
```

- [ ] Update PHPStan section with dual commands
- [ ] Update Rector section with dual commands (`vendor/bin/rector process`)
- [ ] Update ECS section with dual commands (`vendor/bin/ecs check --fix`)
- [ ] Update combined commands:
  - `quality:refactor` → "Run Rector then ECS" (no native single command)
  - `quality:finalize` → "Run PHPStan → Rector → ECS → PHPStan" (describe steps)

### Step 1.3: Update config paths section

Current: assumes `config-dev/php-quality/` with 8 files.

New: detect config from project:
- Check project root first (`phpstan.neon`, `ecs.php`, `rector.php`)
- Fallback: `config-dev/php-quality/` if directory exists

- [ ] Replace hardcoded config path table with detection logic
- [ ] Remove `EcsPreset`, `RectorPreset` references (galawork wrapper classes)
- [ ] Remove `galawork-quality` CLI wrapper description (internal detail)
- [ ] Keep config file descriptions (phpstan.neon, ecs.php, rector.php) — universal

### Step 1.4: Update workflow section

Replace hardcoded `quality:*` commands with generic workflow:

```
1. Run PHPStan — fix all errors
2. Run Rector + ECS with auto-fix
3. Run PHPStan again — verify no new issues from step 2
Detect commands from project (see Tool Detection above).
```

- [ ] Replace hardcoded commands with generic "Run PHPStan" / "Run Rector + ECS"
- [ ] Add note: "See Tool Detection section for exact commands"

### Step 1.5: Split flags table

Current flags table is all galawork/php-quality specific. Split into:

- [ ] Native PHPStan flags: `--memory-limit`, `--debug`, `--pro`
- [ ] Native Rector flags: `--dry-run`, `--clear-cache`
- [ ] Native ECS flags: `--fix`, `--clear-cache`
- [ ] Wrapper-only flags: `--ignore-git`, `--clear-cache`, `--source-branch`, `--target-branch`, `--paths-to-scan` — marked as "Only with galawork/php-quality"

---

## Phase 2: Update quality-workflow rule

Source: `.augment.uncompressed/rules/quality-workflow.md`

### Step 2.1: Replace prerequisite

- [ ] Replace `Requires galawork/php-quality` with: "Check `composer.json` for quality tools. See `quality-tools` skill for detection and commands."

### Step 2.2: Replace command examples

- [ ] Replace all `quality:*` commands with generic descriptions + skill reference
- [ ] Keep workflow order (PHPStan → Rector → ECS → PHPStan) — universal

### Step 2.3: Update config file table

- [ ] Remove `EcsPreset` and `RectorPreset` references
- [ ] Remove `config-dev/php-quality/` as assumed path
- [ ] Keep file names (`phpstan.neon`, `ecs.php`, `rector.php`) — standard

---

## Phase 3: Update all other referencing files (14 files)

Pattern for all: replace `quality:*` commands with generic + skill reference.

### Step 3.1: `rules/verify-before-complete.md`

- [ ] Line 30: `quality:finalize` → "full quality pipeline (PHPStan → Rector → ECS → PHPStan)"
- [ ] Lines 67-70: show native commands as default, wrapper as alternative comment

### Step 3.2: `rules/docker-commands.md`

- [ ] Lines 22-29, 36-37: replace Docker exec quality commands with native commands

### Step 3.3: `commands/bug-fix.md`

- [ ] Lines 81-83: replace `quality:phpstan` / `quality:rector` with native + comment

### Step 3.4: `commands/fix-ci.md`

- [ ] Lines 31-32: replace with "Run ECS/Rector with --fix" + skill reference

### Step 3.5: `commands/quality-fix.md`

- [ ] Lines 30-31: update detection to include native commands as primary option

### Step 3.6: `skills/code-review/SKILL.md`

- [ ] Line 96: `quality:finalize` → "full quality pipeline"

### Step 3.7: `skills/git-workflow/SKILL.md`

- [ ] Lines 94, 103, 137: replace `quality:finalize` with generic + skill reference

### Step 3.8: `skills/dependency-upgrade/SKILL.md`

- [ ] Lines 80-81: replace with native commands + skill reference

### Step 3.9: `skills/merge-conflicts/SKILL.md`

- [ ] Lines 58, 103: replace `quality:phpstan` with "Run PHPStan"

### Step 3.10: `skills/refactorer/SKILL.md`

- [ ] Lines 94, 96: replace with "Run PHPStan" / "Run Rector" + skill reference

### Step 3.11: `skills/copilot/SKILL.md`

- [ ] Lines 165-167: replace `config-dev/php-quality/ecs.php` → `ecs.php` (project root)

### Step 3.12: `skills/composer/SKILL.md`

- [ ] Lines 96-97: keep as example of setting up quality scripts, update to show both options

### Step 3.13: `templates/roadmaps.md`

- [ ] Lines 32-33: replace with native commands (`vendor/bin/phpstan`, etc.)

### Step 3.14: `commands/optimize-rtk-filters.md`

- [ ] Line 107: update rtk pattern to match both `quality:phpstan` AND `vendor/bin/phpstan`

---

## Phase 4: Multi-tenant migration

Source: `.augment.uncompressed/skills/migration-creator/SKILL.md`

### Step 4.1: Generalize multi-tenant section

Replace `migrate:customers`, `local.galawork.de`, FQDN examples with:

```
## Multi-tenant migrations

Some projects use separate databases per tenant. Check for:
- Custom migration commands (e.g. `migrate:customers`, `migrate:tenants`)
- Tenant identifiers (FQDN, subdomain, tenant ID)
- Separate migration directories per database connection

Read `AGENTS.md` or module docs for project-specific multi-tenant commands.
```

- [ ] Replace galawork-specific examples with generic guidance
- [ ] Remove `local.galawork.de` reference
- [ ] Keep concept (multi-tenant migrations exist), lose specifics

### Step 4.2: Generalize database connection table

- [ ] Replace `customer_database` with generic: "Check `config/database.php` for additional connections"

---

## Phase 5: Package name example

Source: `.augment.uncompressed/commands/optimize-augmentignore.md`

- [ ] Replace `galawork/galawork-api` with `event4u/agent-config` or generic `your-org/project-name`

---

## Phase 6: Compress and verify

### Step 6.1: Compress all modified files

20 files to compress after source edits:

- [ ] `skills/quality-tools/SKILL.md`
- [ ] `rules/quality-workflow.md`
- [ ] `rules/verify-before-complete.md`
- [ ] `rules/docker-commands.md`
- [ ] `commands/bug-fix.md`
- [ ] `commands/fix-ci.md`
- [ ] `commands/quality-fix.md`
- [ ] `commands/optimize-rtk-filters.md`
- [ ] `commands/optimize-augmentignore.md`
- [ ] `skills/code-review/SKILL.md`
- [ ] `skills/git-workflow/SKILL.md`
- [ ] `skills/dependency-upgrade/SKILL.md`
- [ ] `skills/merge-conflicts/SKILL.md`
- [ ] `skills/refactorer/SKILL.md`
- [ ] `skills/copilot/SKILL.md`
- [ ] `skills/composer/SKILL.md`
- [ ] `skills/migration-creator/SKILL.md`
- [ ] `templates/roadmaps.md`

### Step 6.2: Update hashes

- [ ] `python3 scripts/compress.py --mark-all-done`

### Step 6.3: Verify no galawork references remain

```bash
grep -rn "galawork\|config-dev/php-quality\|EcsPreset\|RectorPreset\|galawork-quality\|migrate:customers\|local\.galawork" \
  .augment/ --include="*.md"
```

Acceptable remaining: `galawork/php-quality` as ONE option in quality-tools detection table.

- [ ] Verify grep returns only the detection table entry
- [ ] Verify `migrate:customers` and `local.galawork.de` are gone
- [ ] Verify `config-dev/php-quality/` as assumed default path is gone

### Step 6.4: Verify quality stays identical

**For galawork projects** (with `galawork/php-quality`):
- [ ] Wrapper commands still fully documented as preferred option
- [ ] All wrapper flags still documented
- [ ] Workflow sequence identical

**For non-galawork projects:**
- [ ] Native commands documented and correct
- [ ] Detection logic works (check composer.json)
- [ ] Workflow identical, just different commands

---

## Phase 7: Commit

| # | Scope | Commit message |
|---|---|---|
| 1 | Quality tools skill + workflow rule | `refactor: replace galawork-specific quality commands with tool detection` |
| 2 | All 14 referencing files | `refactor: update referencing files to use generic quality tool commands` |
| 3 | Migration + package ref | `refactor: generalize multi-tenant migration and package name examples` |
| 4 | Compression + hashes | `chore: compress all modified files and update hashes` |

---

## Acceptance Criteria

- [ ] No hardcoded `quality:*` as ONLY option in any file
- [ ] Every quality command reference shows native commands OR links to quality-tools skill
- [ ] `galawork/php-quality` documented as ONE option in detection table, not the sole default
- [ ] Native tools (`vendor/bin/phpstan`, `vendor/bin/rector`, `vendor/bin/ecs`) are primary examples
- [ ] Config paths default to project root, `config-dev/php-quality/` as detected alternative
- [ ] `migrate:customers` and `local.galawork.de` replaced with generic guidance
- [ ] `galawork/galawork-api` example replaced
- [ ] All `.augment/` files compressed and hashes updated
- [ ] Quality for galawork projects is identical (wrapper still documented and preferred)
- [ ] Quality for non-galawork projects is now fully supported

## Notes

- AGENTS.md is NOT modified — it's `copyIfMissing` and project-specific
- `quality:finalize` has no native equivalent — document as 4-step sequence
- The `composer` skill example showing `quality:phpstan` as a script is valid — illustrates setup, not runtime
- `optimize-rtk-filters.md` patterns should match both wrapper and native commands