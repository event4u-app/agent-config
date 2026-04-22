# Copilot Repository Instructions — event4u/agent-config

This repository is the **event4u/agent-config** package: shared agent configuration
(skills, rules, commands, guidelines, templates) for AI coding tools. It is a
distribution package, not a Laravel/PHP application.

> **For Copilot Chat users:** Rich context lives in `.augment/` (rules, skills,
> guidelines) and `AGENTS.md` at the repo root. Ask Copilot Chat to read those
> files. The instructions below are self-contained for Copilot Code Review,
> which cannot follow links.

## ✅ What this repo contains

- **Bash** scripts under `scripts/install.sh`, `scripts/compress.sh`, and the
  `postinstall.sh` wrapper.
- **Python 3.10+** tooling under `scripts/` — compression driver, linters
  (skills, references, portability, readme), installer bridge.
- **Markdown** content under `.agent-src.uncompressed/` (authoring layer) and
  `.augment/` (generated output). Edit the former, never the latter.
- **pytest** test suite under `tests/`.

No PHP source files, no Laravel code, no JavaScript runtime deps. If you see
Laravel-specific suggestions in a PR touching this repo, they are wrong.

## ✅ Scope Control

- Do not introduce architectural changes unless explicitly requested.
- Do not replace existing patterns with alternatives.
- Do not suggest new libraries unless explicitly requested.
- Stay within the established structure.

## ✅ Portability rules for this package

- **Never reference a specific consumer project** (project names, domains,
  internal tools, customers) in `.augment/`, `.agent-src.uncompressed/`, root
  `AGENTS.md`, or `.github/copilot-instructions.md`. Everything here must work
  in **any** consumer project.
- Project-specific behavior belongs in a consumer's own `.agent-settings.yml`,
  `AGENTS.md`, or `agents/` directory — not in this package.
- The portability checker (`scripts/check_portability.py`) enforces this in CI.

## ✅ Editing `.augment/` — source-of-truth rule

- **Never edit files under `.augment/` directly.** It is generated output.
- Edit `.agent-src.uncompressed/` and run `task sync` (or `task ci`).
- Never edit generated tool outputs: `.claude/`, `.cursor/`, `.clinerules/`,
  `.windsurfrules`, `GEMINI.md`.

## ✅ Python coding standards

- Python 3.10+ syntax. Use `from __future__ import annotations`, `|` unions,
  built-in generics (`list[str]`, `dict[str, Any]`).
- Type hints on public functions and dataclass fields.
- Prefer `dataclasses` or `typing.NamedTuple` over untyped dicts.
- Use `pathlib.Path`, not string paths.
- No third-party runtime dependencies in `scripts/` — stdlib only. Tests MAY
  use pytest; pytest is the only dev dependency.
- Keep linters exit-code driven (0 = clean, 1 = violations, 3 = internal error).

## ✅ Bash coding standards

- Start every script with `set -euo pipefail`.
- Quote variables: `"$var"`, not `$var`.
- Use `[[ … ]]` for tests (bash builtin), not `[ … ]`.
- Prefer functions with local variables over global state.
- Check for required tools up front and exit with an actionable hint if missing.

## ✅ Markdown / content standards

- Every `.md` file under `.agent-src.uncompressed/` authoring layer.
- Skills must declare YAML frontmatter (`name`, `description`, optionally
  `source`, `disable-model-invocation`, `skills`).
- Size budgets enforced by linter: skills compact, rules focused, commands
  step-by-step.
- Skill descriptions must use trigger words that help routing — "Use when …".
- All `.md` files in `.augment/` must be English.

## ✅ Testing

- `pytest tests/` for Python. Aim for fast, isolated tests — no network, no
  filesystem side effects outside `tmp_path`.
- `bash tests/test_install.sh` for installer end-to-end.
- Every new script under `scripts/` should come with a test file
  `tests/test_<name>.py`.

## ✅ CI checks (must all pass)

`task ci` runs: sync-check, sync-check-hashes, sync, generate-tools, consistency
(git clean), check-compression, check-refs, check-portability, lint-skills, test
(bash + pytest), lint-readme.

If Copilot reviews a PR that fails any of these, reference the specific task.

## ✅ Commit and PR behavior

- Conventional Commits: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.
- Squash-merge title must also follow Conventional Commits.
- Do NOT commit regenerated files (`.claude/`, `.cursor/`, `.windsurfrules`,
  `GEMINI.md`) as separate commits — they belong with the source change.

## ✅ Code Review Scope

- Review only the **actually modified lines** and their direct dependencies.
- Do NOT suggest improvements to unmodified code in the same file.
- Do NOT nitpick style issues that linters / formatters auto-fix.

## ✅ Comment Behavior

- Never create duplicate comments — one comment per concern per location.
- Never re-raise rejected suggestions.
- Answer questions concisely; do not argue.
- Resolve conversations once the issue is addressed.

## ✅ Language

- Code comments: English.
- Commit messages: English, Conventional Commits.
- User-facing prose in `.agent-src.uncompressed/` `.md` files: English.
- PR comments: English.

## ✅ Known non-issues

- `source: package` in skill frontmatter is required — do not remove.
- `disable-model-invocation: true` on commands is required — do not remove.
- Symlinks in `.claude/`, `.cursor/` etc. point to `.augment/` — that is
  intentional, do not "fix" broken-looking paths.
