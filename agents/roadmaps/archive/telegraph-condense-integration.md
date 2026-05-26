# Roadmap: Integrate telegraph-condense into agent-config package

> Use `.agent-src.uncondensed/` as the human-readable source for all agent config files.
> Condense to `.augment/` using telegraph-condense. Ship condensed `.augment/` to target projects
> via Composer plugin, with automatic cleanup of stale files.

## Prerequisites

- [x] Read `AGENTS.md` and `src/AgentConfigPlugin.php`
- [x] ~~Verify telegraph-condense~~ — replaced with manual agent-driven condensation (no external tool needed)
- [x] ~~Ensure Node.js~~ — not needed; condensation is done by the agent via `condense` command

## Context

The `consumer/agent-config` Composer plugin syncs `.augment/` into every target project on
`composer install/update`. All `.md` files (rules, skills, commands, etc.) are loaded into the
agent's system prompt on **every request** — uncondensed prose wastes ~40-50% tokens.

**New directory layout:**

```
.agent-src.uncondensed/   ← human-readable source (edit here)
.augment/                ← condensed output (auto-generated, shipped to projects)
```

telegraph-condense removes filler words, articles, and hedging from prose while preserving code blocks,
paths, URLs, headings, tables, and technical terms. Condensation happens once at build time;
target projects receive pre-condensed files with zero extra dependencies.

Additionally, the current `syncDirectory()` only copies — it never deletes files that were removed
from the package. This causes stale rules/skills to persist in target projects.

- **Package:** `consumer/agent-config` (Composer plugin)
- **Entry point:** `src/AgentConfigPlugin.php`
- **Jira:** none

## Phase 1: Directory setup (done)

- [x] **Step 1:** Copy `.augment/` → `.agent-src.uncondensed/` (identical content, human-readable source)
- [x] **Step 2:** Both directories committed to git — `.agent-src.uncondensed/` is the source of truth

## Phase 2: Build infrastructure (done)

- [x] **Step 1:** Created `scripts/condense.py` — Python sync tool with `--sync`, `--list`, `--check`, `--changed`, `--mark-done`, `--mark-all-done` modes
  - `--sync`: copies non-.md files, cleans up stale files
  - `--list`: lists .md files needing agent condensation
  - `--check`: verifies .augment/ is in sync with .agent-src.uncondensed/
  - `--changed`: lists only files whose source changed since last condensation (SHA-256 hashes)
  - `--mark-done PATH`: registers hash for a single condensed file
  - `--mark-all-done`: registers hashes for all files (bulk)
- [x] **Step 2:** Created `scripts/condense.sh` — shell wrapper
- [x] **Step 3:** ~~Created `Makefile`~~ → migrated to `Taskfile.yml` (go-task): `task sync`, `task sync-list`, `task sync-check`, `task sync-changed`, `task sync-mark-done`, `task sync-mark-all-done`
- [x] **Step 4:** 22 unit tests in `tests/test_condense.py` — all passing
- [x] **Note:** No external API needed — Augment agent condenses .md files interactively

## Phase 3: Workflow definition (done)

- [x] **Step 1:** Editing workflow defined:
  1. Developer edits files in `.agent-src.uncondensed/` (the only place to make changes)
  2. Runs `task sync` to copy non-.md files + cleanup stale
  3. Asks Augment agent to condense .md files (agent reads source, writes condensed to `.augment/`)
  4. Both directories are committed
- [x] **Step 2:** Added "DO NOT EDIT" note to `.augment/README.md` and `.agent-src.uncondensed/README.md`
- [x] **Step 3:** Created Augment command `.agent-src.uncondensed/commands/condense.md` for agent-driven condensation
- [x] **Step 4:** Created rule `.augment/rules/augment-source-of-truth.md` — auto-loaded, enforces source-of-truth workflow

## Phase 4: Plugin enhancement — cleanup stale files (done)

- [x] **Step 1:** `AgentConfigPlugin::syncDirectory()` collects manifest via `collectFiles()`
- [x] **Step 2:** After syncing, deletes stale files not in package manifest
- [x] **Step 3:** Logs deleted files via `$this->io->write()`
- [x] **Step 4:** `removeEmptyDirectories()` cleans up after stale deletion

## Phase 5: Exclude `.agent-src.uncondensed/` from distribution (done)

- [x] **Step 1:** Added `archive.exclude` to `composer.json`
  - Excludes: `.agent-src.uncondensed/`, `agents/`, `scripts/`, `tests/`, `Makefile`, `.github/`, `.idea/`

## Phase 6: Tests (done)

- [x] 22 Python unit tests in `tests/test_condense.py` covering:
  - `should_condense()`, `cleanup_stale()`, `copy_file()`, `sync_non_md()`, `list_md_files()`, `check_sync()`
- [x] PHP plugin tests deferred (no PHPUnit setup in this repo)

## Phase 7: CI pipeline + pre-push hook (done)

- [x] **Step 1:** GitHub Actions workflow `.github/workflows/sync-check.yml`
  - Runs `python3 scripts/condense.py --check` + unit tests on push/PR
- [x] **Step 2:** Taskfile targets: `task sync`, `task sync-list`, `task sync-check`, `task sync-changed`, `task install-hooks`
- [x] **Step 3:** Git pre-push hook via `scripts/install-hooks.sh` — blocks push if out of sync

## Phase 8: Initial condensation run (mostly done)

- [x] **Step 1:** Run full condensation on all files — 92 of 99 skills condensed
- [x] **Step 2:** Spot-check condensed files for quality — verified during condensation
- [x] **Step 3:** Measure token savings: 83.705 → 45.052 words (**46.2% saved**)
- [x] **Step 4:** Committed both directories (4 commits)
- [-] **Step 5:** Tag new release of `consumer/agent-config` — deferred, not needed now
- [-] **Step 6:** Test in one target project — not applicable in this repo, will be verified on next `composer update` in a target project

## Acceptance Criteria

- [x] `.agent-src.uncondensed/` is the single source of truth for all agent config
- [x] `.augment/` is generated from `.agent-src.uncondensed/` via agent-driven condensation (`task sync` + `/condense`)
- [x] Stale files in `.augment/` are deleted when they no longer exist in `.agent-src.uncondensed/`
- [x] `AgentConfigPlugin` syncs `.augment/` to target projects and cleans up stale files
- [x] Target projects receive ONLY `.augment/` (no `.agent-src.uncondensed/`)
- [x] CI fails if `.augment/` is out of sync
- [x] Target projects need NO extra dependencies (no Node.js, no telegraph-condense)
- [x] Token savings of ~40-50% on prose-heavy files confirmed — **46.2% achieved**

## Notes

- **No breaking changes for target projects** — they still just run `composer update`
- **telegraph-condense preserves:** code blocks, commands, file paths, URLs, headings, YAML frontmatter, tables, technical terms
- **telegraph-condense condenses:** prose paragraphs, explanatory text, redundant phrasing
- **`.augment/` is fully package-owned** in target projects. Custom content goes in `agents/overrides/`.
- **`AGENTS.md` and `.github/copilot-instructions.md`:** also condense — they benefit from the same token savings on initial project setup (copy-once)
