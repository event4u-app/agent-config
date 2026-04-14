# Roadmap: Shell-Based Installer

> Replace the PHP Composer Plugin with a portable shell script so agent-config works with any project type and package manager.

## Prerequisites

- [x] Read `src/AgentConfigPlugin.php` — current PHP implementation
- [x] Read `agents/roadmaps/plugin-symlink-strategy.md` — hybrid sync logic
- [ ] Read existing `scripts/compress.py` — understand the generation pipeline

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

- [ ] Create `scripts/install.sh` with shebang, `set -euo pipefail`
- [ ] Accept arguments: `--source <dir>` (package location), `--target <dir>` (project root)
- [ ] Auto-detect source: script's own directory (`dirname "$0"/..`)
- [ ] Auto-detect target: current working directory (or `$PROJECT_ROOT` env var)
- [ ] Add `--help` output
- [ ] Add `--dry-run` flag (show what would happen, don't execute)
- [ ] Add `--verbose` / `--quiet` flags

### Step 1.2: Hybrid sync function

Port `syncHybrid()` — copy rules, symlink everything else.

- [ ] `sync_hybrid <source_augment> <target_augment>` function
- [ ] `should_copy <relative_path>` — returns 0 for rules/, 1 for everything else
- [ ] Copy files in `COPY_DIRS` (rules/) — overwrite existing
- [ ] Create relative symlinks for all other files
- [ ] Handle existing symlinks: remove and recreate (idempotent)
- [ ] Handle existing real files in symlink dirs: replace with symlinks (migration)
- [ ] Copy fallback: if `ln -s` fails, copy instead + warn

### Step 1.3: Stale cleanup

Port `cleanStaleEntries()` and broken symlink detection.

- [ ] Find files in target that don't exist in source → remove
- [ ] Find broken symlinks → remove
- [ ] Remove empty directories after cleanup
- [ ] Log removed files (when verbose)

### Step 1.4: Tool symlinks

Port `createToolSymlinks()` — symlinks in .claude/rules/, .cursor/rules/, .clinerules/.

- [ ] Iterate all `*.md` files in `<target>/.augment/rules/`
- [ ] Create symlinks in `.claude/rules/`, `.cursor/rules/`, `.clinerules/`
- [ ] Relative paths: e.g. `../../.augment/rules/php-coding.md`
- [ ] Clean stale symlinks in tool dirs

### Step 1.5: Skill symlinks

Port `createSkillSymlinks()` — directory symlinks in .claude/skills/.

- [ ] Iterate all directories in `<target>/.augment/skills/`
- [ ] Create directory symlinks in `.claude/skills/`
- [ ] Relative paths: e.g. `../../.augment/skills/coder`
- [ ] Clean stale skill symlinks

### Step 1.6: Generated files

Port `.windsurfrules` generation and `GEMINI.md` symlink.

- [ ] `generate_windsurfrules` — concatenate all rules, strip YAML frontmatter
- [ ] Create `GEMINI.md` → `AGENTS.md` symlink
- [ ] `copy_if_missing` for `AGENTS.md` and `.github/copilot-instructions.md`

### Step 1.7: Gitignore management

Port `ensureGitignoreEntries()`.

- [ ] Check for `# galawork/agent-config` marker in `.gitignore`
- [ ] If missing and `.gitignore` exists: append symlinked dirs block
- [ ] Idempotent: don't duplicate on re-run
- [ ] Don't create `.gitignore` if it doesn't exist

---

## Phase 2: Package manager integration

### Step 2.1: Composer integration (without plugin)

- [ ] Change `composer.json` type from `composer-plugin` to `library`
- [ ] Remove `composer-plugin-api` from require
- [ ] Remove `extra.class` plugin registration
- [ ] Add `scripts.post-install-cmd`: `bash vendor/event4u/agent-config/scripts/install.sh`
- [ ] Add `scripts.post-update-cmd`: same
- [ ] Test: `composer install` triggers the script

### Step 2.2: npm integration

- [ ] Create `package.json` for npm distribution (or document manual install)
- [ ] Add `postinstall` script: `bash node_modules/event4u-agent-config/scripts/install.sh`
- [ ] Document npm installation in README

### Step 2.3: Manual / other package managers

- [ ] Document: `bash <path-to-package>/scripts/install.sh --target .`
- [ ] Document: `PROJECT_ROOT=. bash install.sh`
- [ ] Add `Makefile` / `Taskfile` target for manual invocation

---

## Phase 3: Tests

### Step 3.1: Bash integration tests

- [ ] Create `tests/test_install.sh` using simple bash assertions
- [ ] Test: rules are real copies (`! -L` and `-f`)
- [ ] Test: skills are symlinks (`-L`)
- [ ] Test: symlinks resolve correctly (content readable)
- [ ] Test: stale files removed on re-run
- [ ] Test: broken symlinks removed
- [ ] Test: idempotent (run twice, same result)
- [ ] Test: migration (real files → symlinks for non-rules)
- [ ] Test: gitignore marker added
- [ ] Test: gitignore idempotent
- [ ] Test: tool symlinks created (.claude/rules/, .cursor/rules/, .clinerules/)
- [ ] Test: windsurfrules generated
- [ ] Test: GEMINI.md symlink created
- [ ] Test: dry-run produces no changes

### Step 3.2: CI integration

- [ ] Update `.github/workflows/tests.yml`: replace PHP test job with bash test job
- [ ] Keep Python test job unchanged
- [ ] Tests run on `ubuntu-latest` (bash available)


---

## Phase 4: Cleanup

### Step 4.1: Remove PHP-specific files

- [ ] Remove `src/AgentConfigPlugin.php`
- [ ] Remove `tests/AgentConfigPluginTest.php`
- [ ] Remove `phpunit.xml`
- [ ] Remove `Dockerfile` (no longer needed for PHP tests)
- [ ] Remove `docker-compose.yml`
- [ ] Remove `phpunit/phpunit` from `composer.json` require-dev
- [ ] Remove `composer/composer` from `composer.json` require-dev
- [ ] Remove `autoload` and `autoload-dev` from `composer.json`
- [ ] Remove `src/` directory

### Step 4.2: Simplify composer.json

- [ ] Type: `library` (not `composer-plugin`)
- [ ] No `require` section (no PHP dependency)
- [ ] Only `scripts` section for Composer hook
- [ ] Keep `archive.exclude` for package distribution

---

## Phase 5: Distribution strategy

### Step 5.1: Decide distribution channels

- [ ] **Composer** (PHP): `composer require event4u/agent-config` — triggers `scripts.post-install-cmd`
- [ ] **npm** (JS/TS): `npm install event4u-agent-config` — triggers `postinstall`
- [ ] **Git submodule**: `git submodule add <url> .agent-config && bash .agent-config/scripts/install.sh`
- [ ] **curl one-liner**: `bash <(curl -s https://raw.githubusercontent.com/.../install.sh)`
- [ ] Document all options in README.md

### Step 5.2: Versioning across package managers

- [ ] Single source of truth for version: git tags
- [ ] Composer reads version from git tags automatically
- [ ] npm: sync version in `package.json` with git tags
- [ ] Document release process

---

## Phase 6: Documentation & Commit

### Step 6.1: Update documentation

- [ ] Update `AGENTS.md`: remove Composer plugin references, add shell script info
- [ ] Update `agents/features/multi-agent-compatibility.md`: reference new approach
- [ ] Create/update README.md with installation instructions for all package managers
- [ ] Mark `agents/roadmaps/plugin-symlink-strategy.md` as superseded

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

- [ ] `install.sh` performs identical sync to the old PHP plugin (hybrid: copy rules, symlink rest)
- [ ] `install.sh` works without PHP installed
- [ ] `composer install` in a PHP project triggers `install.sh` via scripts hook
- [ ] `npm install` in a JS project triggers `install.sh` via postinstall
- [ ] Manual `bash install.sh --target .` works standalone
- [ ] All tool directories created (.claude/, .cursor/, .clinerules/, .windsurfrules, GEMINI.md)
- [ ] Stale cleanup works (files, broken symlinks, empty dirs)
- [ ] `.gitignore` management works (marker block, idempotent)
- [ ] Migration from old PHP plugin is seamless (no manual steps)
- [ ] All bash integration tests pass
- [ ] All Python tests pass (compress.py unchanged)
- [ ] `--dry-run` shows actions without executing
- [ ] No PHP, Python, or other runtime dependency (pure bash/sh)

## Notes

- The `scripts/compress.py` pipeline stays as-is — it's a development tool for managing
  the `.augment.uncompressed/` → `.augment/` compression. Only runs in this repo, not in target projects.
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


