# Roadmap: Integrate caveman-compress into agent-config package

> Use `.agent-src.uncompressed/` as the human-readable source for all agent config files.
> Compress to `.augment/` using caveman-compress. Ship compressed `.augment/` to target projects
> via Composer plugin, with automatic cleanup of stale files.

## Prerequisites

- [x] Read `AGENTS.md` and `src/AgentConfigPlugin.php`
- [x] ~~Verify caveman-compress~~ — replaced with manual agent-driven compression (no external tool needed)
- [x] ~~Ensure Node.js~~ — not needed; compression is done by the agent via `compress` command

## Context

The `galawork/agent-config` Composer plugin syncs `.augment/` into every target project on
`composer install/update`. All `.md` files (rules, skills, commands, etc.) are loaded into the
agent's system prompt on **every request** — uncompressed prose wastes ~40-50% tokens.

**New directory layout:**

```
.agent-src.uncompressed/   ← human-readable source (edit here)
.augment/                ← compressed output (auto-generated, shipped to projects)
```

caveman-compress removes filler words, articles, and hedging from prose while preserving code blocks,
paths, URLs, headings, tables, and technical terms. Compression happens once at build time;
target projects receive pre-compressed files with zero extra dependencies.

Additionally, the current `syncDirectory()` only copies — it never deletes files that were removed
from the package. This causes stale rules/skills to persist in target projects.

- **Package:** `galawork/agent-config` (Composer plugin)
- **Entry point:** `src/AgentConfigPlugin.php`
- **Jira:** none

## Phase 1: Directory setup (done)

- [x] **Step 1:** Copy `.augment/` → `.agent-src.uncompressed/` (identical content, human-readable source)
- [x] **Step 2:** Both directories committed to git — `.agent-src.uncompressed/` is the source of truth

## Phase 2: Build infrastructure (done)

- [x] **Step 1:** Created `scripts/compress.py` — Python sync tool with `--sync`, `--list`, `--check`, `--changed`, `--mark-done`, `--mark-all-done` modes
  - `--sync`: copies non-.md files, cleans up stale files
  - `--list`: lists .md files needing agent compression
  - `--check`: verifies .augment/ is in sync with .agent-src.uncompressed/
  - `--changed`: lists only files whose source changed since last compression (SHA-256 hashes)
  - `--mark-done PATH`: registers hash for a single compressed file
  - `--mark-all-done`: registers hashes for all files (bulk)
- [x] **Step 2:** Created `scripts/compress.sh` — shell wrapper
- [x] **Step 3:** ~~Created `Makefile`~~ → migrated to `Taskfile.yml` (go-task): `task sync`, `task sync-list`, `task sync-check`, `task sync-changed`, `task sync-mark-done`, `task sync-mark-all-done`
- [x] **Step 4:** 22 unit tests in `tests/test_compress.py` — all passing
- [x] **Note:** No external API needed — Augment agent compresses .md files interactively

## Phase 3: Workflow definition (done)

- [x] **Step 1:** Editing workflow defined:
  1. Developer edits files in `.agent-src.uncompressed/` (the only place to make changes)
  2. Runs `task sync` to copy non-.md files + cleanup stale
  3. Asks Augment agent to compress .md files (agent reads source, writes compressed to `.augment/`)
  4. Both directories are committed
- [x] **Step 2:** Added "DO NOT EDIT" note to `.augment/README.md` and `.agent-src.uncompressed/README.md`
- [x] **Step 3:** Created Augment command `.agent-src.uncompressed/commands/compress.md` for agent-driven compression
- [x] **Step 4:** Created rule `.augment/rules/augment-source-of-truth.md` — auto-loaded, enforces source-of-truth workflow

## Phase 4: Plugin enhancement — cleanup stale files (done)

- [x] **Step 1:** `AgentConfigPlugin::syncDirectory()` collects manifest via `collectFiles()`
- [x] **Step 2:** After syncing, deletes stale files not in package manifest
- [x] **Step 3:** Logs deleted files via `$this->io->write()`
- [x] **Step 4:** `removeEmptyDirectories()` cleans up after stale deletion

## Phase 5: Exclude `.agent-src.uncompressed/` from distribution (done)

- [x] **Step 1:** Added `archive.exclude` to `composer.json`
  - Excludes: `.agent-src.uncompressed/`, `agents/`, `scripts/`, `tests/`, `Makefile`, `.github/`, `.idea/`

## Phase 6: Tests (done)

- [x] 22 Python unit tests in `tests/test_compress.py` covering:
  - `should_compress()`, `cleanup_stale()`, `copy_file()`, `sync_non_md()`, `list_md_files()`, `check_sync()`
- [x] PHP plugin tests deferred (no PHPUnit setup in this repo)

## Phase 7: CI pipeline + pre-push hook (done)

- [x] **Step 1:** GitHub Actions workflow `.github/workflows/sync-check.yml`
  - Runs `python3 scripts/compress.py --check` + unit tests on push/PR
- [x] **Step 2:** Taskfile targets: `task sync`, `task sync-list`, `task sync-check`, `task sync-changed`, `task install-hooks`
- [x] **Step 3:** Git pre-push hook via `scripts/install-hooks.sh` — blocks push if out of sync

## Phase 8: Initial compression run (mostly done)

- [x] **Step 1:** Run full compression on all files — 92 of 99 skills compressed
- [x] **Step 2:** Spot-check compressed files for quality — verified during compression
- [x] **Step 3:** Measure token savings: 83.705 → 45.052 words (**46.2% saved**)
- [x] **Step 4:** Committed both directories (4 commits)
- [-] **Step 5:** Tag new release of `galawork/agent-config` — deferred, not needed now
- [-] **Step 6:** Test in one target project — not applicable in this repo, will be verified on next `composer update` in a target project

## Acceptance Criteria

- [x] `.agent-src.uncompressed/` is the single source of truth for all agent config
- [x] `.augment/` is generated from `.agent-src.uncompressed/` via agent-driven compression (`task sync` + `/compress`)
- [x] Stale files in `.augment/` are deleted when they no longer exist in `.agent-src.uncompressed/`
- [x] `AgentConfigPlugin` syncs `.augment/` to target projects and cleans up stale files
- [x] Target projects receive ONLY `.augment/` (no `.agent-src.uncompressed/`)
- [x] CI fails if `.augment/` is out of sync
- [x] Target projects need NO extra dependencies (no Node.js, no caveman-compress)
- [x] Token savings of ~40-50% on prose-heavy files confirmed — **46.2% achieved**

## Notes

- **No breaking changes for target projects** — they still just run `composer update`
- **caveman-compress preserves:** code blocks, commands, file paths, URLs, headings, YAML frontmatter, tables, technical terms
- **caveman-compress compresses:** prose paragraphs, explanatory text, redundant phrasing
- **`.augment/` is fully package-owned** in target projects. Custom content goes in `agents/overrides/`.
- **`AGENTS.md` and `.github/copilot-instructions.md`:** also compress — they benefit from the same token savings on initial project setup (copy-once)
