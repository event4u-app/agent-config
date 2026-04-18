# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.

## [Unreleased]

_No unreleased changes yet._

## [1.4.0] — 2026-04-18

### Added
- **`.agent-src/` replaces `.augment/` as the canonical compressed directory
  shipped in the package.** The new name is tool-agnostic. The installer on
  the consumer side still writes into `.augment/`, unchanged.
- `.augment/` is now a **local projection** of `.agent-src/` for Augment Code
  (gitignored in this repo, rebuilt by `task sync`). Rules are copied (Augment
  Code cannot load symlinked rules); everything else is symlinked to save
  space.
- `scripts/install.sh` and `scripts/install.py` now read from vendor's
  `.agent-src/` with automatic fallback to `.augment/` for pre-2.0 packages.
- `task project-augment` — rebuild the `.augment/` projection from `.agent-src/`.
- MIT License file in the repository root (previously `license: proprietary` in
  `composer.json` with no `LICENSE` file).
- Root-level package docs (`AGENTS.md`, `.github/copilot-instructions.md`) are
  now the package's own meta docs; consumer scaffolding comes from
  `.augment/templates/` via the installer or `/copilot-agents-init`.
- `scripts/install.py` is the canonical installer; `scripts/install.sh` and
  `bin/install.php` remain as thin compatibility wrappers.
- Portability checker (`scripts/check_portability.py`) now covers root-level
  files and supports an optional `AGENT_CONFIG_BLOCKLIST` env var for
  downstream forks that need to enforce legacy-identifier bans.
- `/copilot-agents-init` command to scaffold `AGENTS.md` +
  `.github/copilot-instructions.md` from scratch in consumer projects.
- `/copilot-agents-optimize` now scans for legacy identifiers from prior
  repo names, stack drift, and dead commands before deduplicating.

### Changed
- `composer.json` and `package.json` now declare `license: MIT` (previously
  `proprietary` / `UNLICENSED`).
- Experimental layers (runtime, tool adapters, observability) are now clearly
  labeled in `README.md` and the architecture docs.
- **Distribution slim-down.** Added `.gitattributes export-ignore` entries
  and an explicit `files` whitelist in `package.json`. Composer archives
  drop from 1221 to 433 files (4.45 MB → 1.79 MB); the npm tarball contains
  313 files (483 kB packed). Dev-only directories (`tests/`, `agents/`,
  `.agent-src.uncompressed/`, tool mirrors) no longer ship to consumers.
- **Architecture docs restructured.** Layer 4–6 (observability, feedback,
  lifecycle) moved out of `docs/architecture.md` into a dedicated opt-in
  `docs/observability.md`. The main architecture page now focuses on the
  stable Rules/Skills/Runtime layers.
- **`ide` default neutralized** in `config/agent-settings.template.ini`:
  was `ide=phpstorm`, now empty. Consumers fill it in if they want
  auto-open behavior; empty means the file-editor skill stays inert.

### CI
- Test matrix expanded: Python 3.10 / 3.11 / 3.12 / 3.13 on `ubuntu-latest`
  plus Python 3.12 on `macos-latest`. `install.sh` integration tests run on
  both OS. Matrix enforces the "Python 3.10+, stdlib only" guarantee from
  `CONTRIBUTING.md`. Documented under `docs/development.md#ci-test-matrix`.

### Community
- **Maintainer team documented.** `CONTRIBUTING.md` now lists the
  event4u team (@matze4u lead, @h3xa2, @php-jesus, @phpjob) instead of
  claiming "single author". Bus-factor is now 2 (Owner + Maintain role).
- **GitHub Discussions** referenced from `CONTRIBUTING.md` as the channel
  for scope questions; Issues remain for bugs and feature requests.

### Removed
- Hardcoded `galawork` references removed from installer and portability
  checker. No public release ever shipped the legacy `# galawork/agent-config`
  gitignore marker, so the in-place migration path was also removed.

## [1.3.3] — 2026-04-17

### Changed
- Plugin name renamed from `governed-agent-system` to `agent-config`.

### Fixed
- Plugin install commands corrected in README.

## [1.3.2] — 2026-04-17

### Fixed
- Resolved 10 broken cross-references in roadmap documents.

## [1.3.1] — 2026-04-17

### Added
- PHP installer (`bin/install.php`) and versioned profile presets.
- First-run experience script and `docs/getting-started.md`.
- Marketplace manifests for Augment CLI, Claude Code, and Copilot CLI.
- Quickstart-first README structure.
- Standalone documentation pages under `docs/`:
  `installation.md`, `architecture.md`, `development.md`, `customization.md`,
  `quality.md`.

### Changed
- Tool matrix in README differentiates native vs. reference-based command
  support (`☑️` for the latter).
- Installation default shifted to project-installed; plugin install is
  optional for global use.

## [1.3.0] — 2026-04-17

### Added
- Experimental layers: runtime execution pipeline, tool adapters (GitHub,
  Jira), observability (persistence, event schema, CLI reports), feedback
  collector, and skill lifecycle management.
- `cost_profile` setting (`minimal`, `balanced`, `full`, `custom`) as the
  primary knob for token/output control.
- Governance: `upstream-contribute` skill + command,
  `improve-before-implement` rule, `validate-feature-fit` skill.

### Changed
- README rewritten to describe the governed agent system.

## [1.2.2] — 2026-04-17

### Fixed
- `test_install.sh` updated for the `php-coder` skill name.

## [1.2.1] — 2026-04-17

### Added
- `package-ci-checks` rule + optimized CI task order.

### Fixed
- `test_install.sh` skill name fix (initial attempt).

## [1.2.0] — 2026-04-17

### Added
- Linter: execution quality checks, verification maturity mapping, type
  boundary enforcement, section-based detection, governance/packaging
  consistency checks.
- `upstream-contribute` skill + command.

### Fixed
- CI pipeline failures across multiple checks.
- Commands no longer overwrite same-name skill symlinks.
- Missing settings added to the `.agent-settings` template.

## [1.1.1] — 2026-04-16

### Fixed
- Trailing newlines in 36 command files.
- Linter bug causing false positives.

## [1.1.0] — 2026-04-16

### Added
- `readme-reviewer`, `readme-writing`, and `readme-writing-package` skills.
- README quality linter integrated into CI.
- Skill improvement pipeline (all 5 phases).
- Compression quality checker, cross-reference checker, portability checker.
- `size-and-scope` guideline, `size-enforcement` and `rule-type-governance`
  rules.
- `preservation-guard` rule for merges and compression.
- Phase 3 observability work + feedback category tags.
- `developer-like-execution` skill and `think-before-action` rule.

### Changed
- Major README rewrite: governed AI development layer positioning.
- Portability checker auto-detects project identifiers.

## [1.0.4] — 2026-04-15

### Fixed
- npm install (#1).
- Address PR bot feedback.
- Drop unnecessary `bash -c` wrapper for phpunit in `docker-commands`.

## [1.0.3] — 2026-04-14

### Fixed
- Address Copilot PR review feedback.

## [1.0.2] — 2026-04-14

### Fixed
- Handle `realpath` without `--relative-to` support (BusyBox/Alpine).

## [1.0.1] — 2026-04-14

### Added
- `setup.sh` for automatic post-install/update hook registration.
- `setup.sh` auto-detects JSON tool (`php → node → jq → python3`).

### Changed
- Install as dev dependency (documented).

## [1.0.0] — 2026-04-14

Initial public release.

### Added
- `.augment/` governance content: rules, skills, commands, guidelines,
  templates.
- `scripts/install.sh` with symlink strategy, stale symlink cleanup, and
  per-tool directory layout.
- `/package-test` and `/package-reset` commands.
- Initial README with installation instructions for all supported package
  managers.

[Unreleased]: https://github.com/event4u-app/agent-config/compare/1.3.3...HEAD
[1.3.3]: https://github.com/event4u-app/agent-config/compare/1.3.2...1.3.3
[1.3.2]: https://github.com/event4u-app/agent-config/compare/1.3.1...1.3.2
[1.3.1]: https://github.com/event4u-app/agent-config/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/event4u-app/agent-config/compare/1.2.2...1.3.0
[1.2.2]: https://github.com/event4u-app/agent-config/compare/1.2.1...1.2.2
[1.2.1]: https://github.com/event4u-app/agent-config/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/event4u-app/agent-config/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/event4u-app/agent-config/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/event4u-app/agent-config/compare/1.0.4...1.1.0
[1.0.4]: https://github.com/event4u-app/agent-config/compare/1.0.3...1.0.4
[1.0.3]: https://github.com/event4u-app/agent-config/compare/1.0.2...1.0.3
[1.0.2]: https://github.com/event4u-app/agent-config/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/event4u-app/agent-config/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/event4u-app/agent-config/releases/tag/1.0.0
