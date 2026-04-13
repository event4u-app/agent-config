# Roadmap: Integrate caveman-compress into agent-config package

> Use `.augment.uncompressed/` as the human-readable source for all agent config files.
> Compress to `.augment/` using caveman-compress. Ship compressed `.augment/` to target projects
> via Composer plugin, with automatic cleanup of stale files.

## Prerequisites

- [ ] Read `AGENTS.md` and `src/AgentConfigPlugin.php`
- [ ] Verify [caveman-compress](https://github.com/JuliusBrussee/caveman) works as expected on sample files
- [ ] Ensure Node.js is available in the CI/build environment (NOT required in target projects)

## Context

The `galawork/agent-config` Composer plugin syncs `.augment/` into every target project on
`composer install/update`. All `.md` files (rules, skills, commands, etc.) are loaded into the
agent's system prompt on **every request** — uncompressed prose wastes ~40-50% tokens.

**New directory layout:**

```
.augment.uncompressed/   ← human-readable source (edit here)
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

- [x] **Step 1:** Copy `.augment/` → `.augment.uncompressed/` (identical content, human-readable source)
- [ ] **Step 2:** Both directories committed to git — `.augment.uncompressed/` is the source of truth

## Phase 2: Build infrastructure (done)

- [x] **Step 1:** Created `scripts/compress.py` — Python sync tool with `--sync`, `--list`, `--check` modes
  - `--sync`: copies non-.md files, cleans up stale files
  - `--list`: lists .md files needing agent compression
  - `--check`: verifies .augment/ is in sync with .augment.uncompressed/
- [x] **Step 2:** Created `scripts/compress.sh` — shell wrapper
- [x] **Step 3:** Created `Makefile` with `make sync`, `make sync-list`, `make sync-check`
- [x] **Step 4:** 22 unit tests in `tests/test_compress.py` — all passing
- [x] **Note:** No external API needed — Augment agent compresses .md files interactively

## Phase 3: Workflow definition

- [ ] **Step 1:** Define the editing workflow:
  1. Developer edits files in `.augment.uncompressed/` (the only place to make changes)
  2. Runs `make sync` to copy non-.md files + cleanup stale
  3. Asks Augment agent to compress .md files (agent reads source, writes compressed to `.augment/`)
  4. Both directories are committed
- [ ] **Step 2:** Add a note to `.augment/README.md`: "DO NOT edit files here — edit in `.augment.uncompressed/`"
- [ ] **Step 3:** Create Augment command `.augment.uncompressed/commands/compress.md` for agent-driven compression

## Phase 4: Plugin enhancement — cleanup stale files (done)

- [x] **Step 1:** `AgentConfigPlugin::syncDirectory()` collects manifest via `collectFiles()`
- [x] **Step 2:** After syncing, deletes stale files not in package manifest
- [x] **Step 3:** Logs deleted files via `$this->io->write()`
- [x] **Step 4:** `removeEmptyDirectories()` cleans up after stale deletion

## Phase 5: Exclude `.augment.uncompressed/` from distribution (done)

- [x] **Step 1:** Added `archive.exclude` to `composer.json`
  - Excludes: `.augment.uncompressed/`, `agents/`, `scripts/`, `tests/`, `Makefile`, `.github/`, `.idea/`

## Phase 6: Tests (done)

- [x] 22 Python unit tests in `tests/test_compress.py` covering:
  - `should_compress()`, `cleanup_stale()`, `copy_file()`, `sync_non_md()`, `list_md_files()`, `check_sync()`
- [x] PHP plugin tests deferred (no PHPUnit setup in this repo)

## Phase 7: CI pipeline + pre-push hook (done)

- [x] **Step 1:** GitHub Actions workflow `.github/workflows/sync-check.yml`
  - Runs `python3 scripts/compress.py --check` + unit tests on push/PR
- [x] **Step 2:** Makefile targets: `make sync`, `make sync-list`, `make sync-check`, `make install-hooks`
- [x] **Step 3:** Git pre-push hook via `scripts/install-hooks.sh` — blocks push if out of sync

## Phase 8: Initial compression run

- [ ] **Step 1:** Run full compression on all files
- [ ] **Step 2:** Spot-check 5-10 compressed files for quality
- [ ] **Step 3:** Measure token savings (before/after token count)
- [ ] **Step 4:** Commit both directories
- [ ] **Step 5:** Tag new release of `galawork/agent-config`
- [ ] **Step 6:** Test in one target project: `composer update galawork/agent-config`
  - Verify: compressed files synced, stale files cleaned up, agent works correctly

## Acceptance Criteria

- [ ] `.augment.uncompressed/` is the single source of truth for all agent config
- [ ] `.augment/` is auto-generated from `.augment.uncompressed/` via `npm run compress`
- [ ] Stale files in `.augment/` are deleted when they no longer exist in `.augment.uncompressed/`
- [ ] `AgentConfigPlugin` syncs `.augment/` to target projects and cleans up stale files
- [ ] Target projects receive ONLY `.augment/` (no `.augment.uncompressed/`)
- [ ] CI fails if `.augment/` is out of sync
- [ ] Target projects need NO extra dependencies (no Node.js, no caveman-compress)
- [ ] Token savings of ~40-50% on prose-heavy files confirmed

## Notes

- **No breaking changes for target projects** — they still just run `composer update`
- **caveman-compress preserves:** code blocks, commands, file paths, URLs, headings, YAML frontmatter, tables, technical terms
- **caveman-compress compresses:** prose paragraphs, explanatory text, redundant phrasing
- **`.augment/` is fully package-owned** in target projects. Custom content goes in `agents/overrides/`.
- **`AGENTS.md` and `.github/copilot-instructions.md`:** also compress — they benefit from the same token savings on initial project setup (copy-once)
