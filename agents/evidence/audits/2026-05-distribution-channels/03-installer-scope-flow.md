# Installer scope flow — audit

**Audit:** 03 of 03 (Phase B, Step 1)
**Date:** 2026-05-25
**Status:** Current behaviour mapped. Cross-scope drift is **not currently detected** by the installer; the scope_guard built in Phase B Step 2 closes the gap.

## How the installer handles `--scope` today

`scripts/install.sh` does **not** carry a `--scope` flag. It writes to whatever `--target <dir>` resolves to:

```bash
bash scripts/install.sh --target /path/to/project   # project-local install
bash scripts/install.sh --target $HOME              # user-global install
bash scripts/install.sh                              # auto-detect from cwd / PROJECT_ROOT
```

`scripts/install.py` (the orchestrator that calls `install.sh`) has a `--user-type` flag for the developer profile (engineer / pm / founder), but it does **not** discriminate scope.

## What each invocation writes

For `--target=$PROJECT_ROOT`:

| Output | Path |
|---|---|
| Augment substrate (real + symlinks) | `$PROJECT_ROOT/.augment/{rules,skills,commands,…}` |
| Claude rules (symlinks → `.augment/rules`) | `$PROJECT_ROOT/.claude/rules/*.md` |
| Claude skills (symlinks → `.augment/skills`) | `$PROJECT_ROOT/.claude/skills/<id>/` |
| Cursor rules (symlinks → `.augment/rules`) | `$PROJECT_ROOT/.cursor/rules/*.md` |
| Cline rules (symlinks → `.augment/rules`) | `$PROJECT_ROOT/.clinerules/*.md` |
| Windsurf rules (generated) | `$PROJECT_ROOT/.windsurfrules` |
| GEMINI.md symlink → AGENTS.md | `$PROJECT_ROOT/GEMINI.md` |
| AGENTS.md (copy-if-missing) | `$PROJECT_ROOT/AGENTS.md` |
| copilot-instructions.md (copy-if-missing) | `$PROJECT_ROOT/.github/copilot-instructions.md` |
| `.claude-plugin/marketplace.json` | **not projected by default** — `--legacy-both` opts in (Phase A Step 4) |

For `--target=$HOME`:

The same set of files lands inside `$HOME/.augment/`, `$HOME/.claude/`, `$HOME/.cursor/`, etc. Claude's harness, Cursor, Cline, and others routinely scan **both** user-global (`~/.claude/skills/`) and project-local (`.claude/skills/`), so two installs at different versions register both.

## What the installer does NOT currently detect

1. **Existing install at the other scope.** No pre-flight probe checks `~/.claude/skills/` before writing `.claude/skills/`, or vice versa.
2. **Version mismatch.** The `.augment-plugin/plugin.json` carries the version, but the installer does not read the version of an existing install at the other scope.
3. **Frontmatter drift.** The 2026-05-25 bug — same skill ID, different `description:` — is invisible to the installer; both registrations look "valid" from the host's perspective.

## Current state on this machine

```
~/.claude/skills/        →  277 entries  (older install, stale description for copilot-config)
.claude/skills/          →  351 entries  (current checkout)
~/.augment/skills/       →  0 entries    (not installed at user scope)
.augment/skills          →  symlink → .agent-src/skills (real source: 351 skills)
```

The Claude trees show the live drift; Augment is clean only because nothing was installed at user scope.

## What Phase B Step 2 must implement

`scripts/_lib/scope_guard.sh` runs **before** any file write inside `install.sh`:

1. For each supported tool, check if the *other* scope already has an install.
2. If yes, read its version (from `.augment-plugin/plugin.json` or another canonical version source).
3. Compare against the version about to be installed.
4. Emit `OK` / `WARN` / `DRIFT`.

Step 3 wires that output into `install.sh`: on `DRIFT`, surface numbered-options instead of overwriting silently.

## Scope-resolution heuristic (for the guard)

- **Project scope** = `--target` resolves under a directory that contains a project marker (`.git/`, `package.json`, `composer.json`, `pyproject.toml`, `agents/`).
- **User scope** = `--target` resolves to `$HOME` (no project marker at the same level).

When ambiguous (e.g. installing into `~/projects/foo` which happens to be a git repo), the guard prefers the project-scope interpretation but still checks user-global for drift.

## See also

- [Audit 01](01-claude-same-install.md) · [Audit 02](02-augment-same-install.md) — same-install paths.
- [`docs/contracts/install-scopes.md`](../../../../docs/contracts/install-scopes.md) — Phase B Step 6 contract derived from this audit.
- [`scripts/_lib/scope_guard.sh`](../../../../scripts/_lib/scope_guard.sh) — Phase B Step 2 implementation.
