# Roadmap: Shell-Based Installer

> Replace the PHP Composer Plugin with a portable shell script so agent-config works with any project type and package manager.

## Prerequisites

- [x] Read `src/AgentConfigPlugin.php` — current PHP implementation
- [x] Read `agents/roadmaps/plugin-symlink-strategy.md` — hybrid sync logic
- [x] Read existing `scripts/compress.py` — understand the generation pipeline

## Context

The agent-config package currently ships as a **Composer plugin** (`composer-plugin` type).
This limits it to PHP projects. Frontend projects (npm/bun), Python projects (pip/poetry),
Go projects, and others cannot use it without PHP installed.

A shell script (`install.sh`) is universally portable — every CI system and every developer
machine has `bash` or `sh`. Package managers can call it via post-install hooks:

| Package Manager | Hook |
|---|---|
| Composer | `scripts.post-install-cmd` / `post-update-cmd` |
| npm/bun | `postinstall` in package.json |
| pip | Not built-in — document manual invocation |
| Manual | `bash path/to/install.sh` |

- **Feature:** `agents/features/multi-agent-compatibility.md`
- **Jira:** none

## Phase 1: Create `install.sh`

Port all logic from `AgentConfigPlugin.php` to a self-contained bash script.

### Step 1.1: Script skeleton and argument parsing

- [x] Create `scripts/install.sh` with shebang, `set -euo pipefail`
- [x] Accept arguments: `--source <dir>` (package location), `--target <dir>` (project root)
- [x] Auto-detect source: script's own directory (`dirname "$0"/..`)
- [x] Auto-detect target: current working directory (or `$PROJECT_ROOT` env var)
- [x] Add `--help` output
- [x] Add `--dry-run` flag (show what would happen, don't execute)
- [x] Add `--verbose` / `--quiet` flags

### Step 1.2: Hybrid sync function

Port `syncHybrid()` — copy rules, symlink everything else.

- [x] `sync_hybrid <source_augment> <target_augment>` function
- [x] `should_copy <relative_path>` — returns 0 for rules/, 1 for everything else
- [x] Copy files in `COPY_DIRS` (rules/) — overwrite existing
- [x] Create relative symlinks for all other files
- [x] Handle existing symlinks: remove and recreate (idempotent)
- [x] Handle existing real files in symlink dirs: replace with symlinks (migration)
- [x] Copy fallback: if `ln -s` fails, copy instead + warn

### Step 1.3: Stale cleanup

Port `cleanStaleEntries()` and broken symlink detection.

- [x] Find files in target that don't exist in source → remove
- [x] Find broken symlinks → remove
- [x] Remove empty directories after cleanup
- [x] Log removed files (when verbose)

### Step 1.4: Tool symlinks

Port `createToolSymlinks()` — symlinks in .claude/rules/, .cursor/rules/, .clinerules/.

- [x] Iterate all `*.md` files in `<target>/.augment/rules/`
- [x] Create symlinks in `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [x] Relative paths: e.g. `../../.augment/rules/php-coding.md`
- [x] Clean stale symlinks in tool dirs

### Step 1.5: Skill symlinks

Port `createSkillSymlinks()` — directory symlinks in .claude/skills/.

- [x] Iterate all directories in `<target>/.augment/skills/`
- [x] Create directory symlinks in `.claude/skills/`
- [x] Relative paths: e.g. `../../.augment/skills/coder`
- [x] Clean stale skill symlinks

### Step 1.6: Generated files

Port `.windsurfrules` generation and `GEMINI.md` symlink.

- [x] `generate_windsurfrules` — concatenate all rules, strip YAML frontmatter
- [x] Create `GEMINI.md` → `AGENTS.md` symlink
- [x] `copy_if_missing` for `AGENTS.md` and `.github/copilot-instructions.md`

### Step 1.7: Gitignore management

Port `ensureGitignoreEntries()`.

- [x] Check for `# galawork/agent-config` marker in `.gitignore`
- [x] If missing and `.gitignore` exists: append symlinked dirs block
- [x] Idempotent: don't duplicate on re-run
- [x] Don't create `.gitignore` if it doesn't exist

---

## Phase 2: Package manager integration

### Step 2.1: Composer integration (without plugin)

- [x] Change `composer.json` type from `composer-plugin` to `library`
- [x] Remove `composer-plugin-api` from require
- [x] Remove `extra.class` plugin registration
- [x] Add `scripts.post-install-cmd`: `bash vendor/event4u/agent-config/scripts/install.sh --quiet`
- [x] Add `scripts.post-update-cmd`: same
- [-] Test: `composer install` triggers the script (deferred: needs real project)

### Step 2.2: npm integration

- [x] Create `package.json` for npm distribution
- [x] Add `postinstall` script: `bash node_modules/@event4u/agent-config/scripts/install.sh --quiet`
- [x] Document npm installation in README

### Step 2.3: Manual / other package managers

- [x] Document: `bash <path-to-package>/scripts/install.sh --target .`
- [x] `PROJECT_ROOT` env var support built into script
- [x] Add Taskfile target: `task install -- --target /path/to/project`

---

## Phase 3: Tests

### Step 3.1: Bash integration tests

- [x] Create `tests/test_install.sh` using simple bash assertions
- [x] Test: rules are real copies (`! -L` and `-f`)
- [x] Test: skills are symlinks (`-L`)
- [x] Test: symlinks resolve correctly (content readable)
- [x] Test: stale files removed on re-run
- [x] Test: broken symlinks removed
- [x] Test: idempotent (run twice, same result)
- [x] Test: migration (real files → symlinks for non-rules)
- [x] Test: gitignore marker added
- [x] Test: gitignore idempotent
- [x] Test: tool symlinks created (.claude/rules/, .cursor/rules/, .clinerules/)
- [x] Test: windsurfrules generated
- [x] Test: GEMINI.md symlink created
- [x] Test: dry-run produces no file changes

### Step 3.2: CI integration

- [x] Update `.github/workflows/tests.yml`: replace PHP test job with bash test job
- [x] Keep Python test job unchanged
- [x] Tests run on `ubuntu-latest` (bash available)


---

## Phase 4: Cleanup

### Step 4.1: Remove PHP-specific files

- [x] Remove `src/AgentConfigPlugin.php`
- [x] Remove `tests/AgentConfigPluginTest.php`
- [x] Remove `phpunit.xml`
- [x] Remove `Dockerfile`
- [x] Remove `docker-compose.yml`
- [x] Remove `phpunit/phpunit` from `composer.json` require-dev
- [x] Remove `composer/composer` from `composer.json` require-dev
- [x] Remove `autoload` and `autoload-dev` from `composer.json`
- [x] Remove `src/` directory

### Step 4.2: Simplify composer.json

- [x] Type: `library` (not `composer-plugin`)
- [x] No `require` section (no PHP dependency)
- [x] Only `scripts` section for Composer hook
- [x] Keep `archive.exclude` for package distribution

---

## Phase 5: Distribution strategy

### Step 5.1: Decide distribution channels

- [x] **Composer** (PHP): `composer require event4u/agent-config` — triggers `scripts.post-install-cmd`
- [x] **npm** (JS/TS): `npm install @event4u/agent-config` — triggers `postinstall`
- [x] **Git submodule**: documented in README
- [x] **Manual**: `bash scripts/install.sh --target <project>` — documented in README
- [-] curl one-liner: deferred (needs public repo or CDN)

### Step 5.2: Versioning across package managers

- [x] Single source of truth for version: git tags
- [x] Composer reads version from git tags automatically
- [x] npm: version in `package.json` (manual sync with git tags for now)
- [-] Document release process (deferred to separate docs)

---

## Phase 6: Documentation & Commit

### Step 6.1: Update documentation

- [x] ~~Update `AGENTS.md`~~ — AGENTS.md is template for target projects, no plugin refs
- [x] Update `agents/features/multi-agent-compatibility.md`: reference install.sh
- [x] Create README.md with installation instructions for all package managers
- [x] Mark `agents/roadmaps/plugin-symlink-strategy.md` as superseded

### Step 6.2: Commit plan

| # | Scope | Commit message |
|---|---|---|
| 1 | Script | `feat: add portable install.sh replacing PHP Composer plugin` |
| 2 | Tests | `test: add bash integration tests for install.sh` |
| 3 | Composer | `refactor: convert composer-plugin to library with script hook` |
| 4 | Cleanup | `chore: remove PHP plugin, PHPUnit, Docker test setup` |
| 5 | CI | `ci: replace PHP test job with bash test job` |
| 6 | Docs | `docs: update installation docs for multi-package-manager support` |

---

## Acceptance Criteria

- [x] `install.sh` performs identical sync to the old PHP plugin (hybrid: copy rules, symlink rest)
- [x] `install.sh` works without PHP installed
- [x] `composer install` triggers `install.sh` via scripts hook (configured, needs real project test)
- [x] `npm install` triggers `install.sh` via postinstall (configured, needs real project test)
- [x] Manual `bash install.sh --target .` works standalone (tested)
- [x] All tool directories created (.claude/, .cursor/, .clinerules/, .windsurfrules, GEMINI.md)
- [x] Stale cleanup works (files, broken symlinks, empty dirs)
- [x] `.gitignore` management works (marker block, idempotent)
- [x] Migration from old PHP plugin is seamless (no manual steps)
- [x] All 32 bash integration tests pass
- [x] All 49 Python tests pass (compress.py unchanged)
- [x] `--dry-run` shows actions without executing (no files created)
- [x] Only bash + python3/realpath/perl for relative paths (available on all CI/dev machines)

## Notes

- The `scripts/compress.py` pipeline stays as-is — it's a development tool for managing
  the `.agent-src.uncompressed/` → `.augment/` compression. Only runs in this repo, not in target projects.
- `install.sh` is what runs in **target projects** — it syncs from the package to the project.
- Composer `scripts` hooks run from project root with `vendor/` accessible — the script
  auto-detects its own location via `dirname "$0"` to find the package source.
- npm `postinstall` runs from the package directory — the script needs to find project root
  via `$INIT_CWD` (npm) or walking up to find `package.json`.
- For git submodule users: `install.sh --source .agent-config --target .`
- Windows support: consider adding a `install.ps1` PowerShell equivalent later.
  For now, WSL/Git Bash covers most Windows dev setups.
- The `--dry-run` flag is important for debugging in CI and for users who want to verify
  before committing generated files.


