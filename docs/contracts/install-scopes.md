# Install Scopes — user-global vs project-local

**Status:** Active (locked 2026-05-25 via Phase B of `road-to-clean-skill-distribution-channels.md`)
**Owner:** maintainer-team
**Inputs:** [`docs/contracts/skill-distribution-channels.md`](skill-distribution-channels.md), [`agents/evidence/audits/2026-05-distribution-channels/03-installer-scope-flow.md`](../../agents/evidence/audits/2026-05-distribution-channels/03-installer-scope-flow.md)

## Rule

`event4u/agent-config` may be installed at **one** of two scopes per developer machine:

| Scope | Lives at | Default for | Rationale |
|---|---|---|---|
| **project-local** | `<project-root>/.augment/`, `<project-root>/.claude/skills/`, … | Application repos | The skills, rules, and personas are pinned alongside the code they serve. The install is reproducible from the repo. |
| **user-global** | `~/.augment/`, `~/.claude/skills/`, … | Tooling repos / dotfiles | The same skills follow the developer across every project they touch. Useful when no specific repo "owns" the install. |

Installing at **both** scopes simultaneously is the failure mode the canonical-channel contract prevents — the host harness loads both registrations, and any version drift surfaces as duplicate skills with stale frontmatter (the 2026-05-25 bug).

## The installer enforces this

`scripts/install.sh` runs `scripts/_lib/scope_guard.sh` before any file write:

1. **`OK`** — no install at the other scope. Proceed.
2. **`WARN`** — install at the other scope, same version. Same content; duplicate registration but no drift. Surface a warning, proceed.
3. **`DRIFT`** — install at the other scope, different version. Block with a numbered-options prompt:

```
  1. Abort install — fix drift first (recommended)
  2. Upgrade the OTHER scope first
  3. Force install at this scope — accept drift (set SCOPE_GUARD_BYPASS=1)
  4. Clean the other scope (bash scripts/cleanup_other_scope.sh --confirm)
```

Non-interactive shells default to **abort**. CI runs and the orchestrator set `SCOPE_GUARD_BYPASS=1` to skip the gate.

The `agent-config setup` wizard exposes the same check at `GET /api/v1/wizard/scope-guard` (extended-mode endpoint). The first wizard step renders the verdict before the user picks an install scope.

## How to clean a stale other-scope install

Use the companion script:

```bash
# Dry-run (default) — list what would be removed
bash scripts/cleanup_other_scope.sh --user

# Confirm and delete
bash scripts/cleanup_other_scope.sh --user --confirm

# Narrow to a single tool
bash scripts/cleanup_other_scope.sh --user --confirm --tools=claude-code

# Remove from a specific project root
bash scripts/cleanup_other_scope.sh --project /path/to/proj --confirm
```

The script refuses to delete anything without `--confirm` per `non-destructive-by-default`. It only touches the tool-scoped paths the contract names (`.claude/skills/`, `.augment/`, `.cursor/rules/`, `.clinerules/`, `.windsurf/rules/`, `.github/copilot-instructions.md`); the rest of the scope root is never modified.

## When to pick which scope

- **App repo** (Laravel, Next.js, monorepo) → project-local. The skills/rules ship with the code; CI installs them deterministically.
- **Tooling repo** (dotfiles, personal sandbox) → user-global. The install follows the developer.
- **Both apply** (a tooling repo that also has project-specific overrides) → project-local for the overrides, no user-global install. The override mechanism at `agents/overrides/` covers the divergence.

The scope guard does **not** make the picking decision; it enforces "one scope per machine at one version".

## Failure modes the guard catches

- A user installed `event4u/agent-config` globally a year ago, then `npx`d a recent project that pulled v3.x into `./.claude/skills/`. Same skill ID, different frontmatter on disk. Without the guard, the Claude session sees both registrations and the agent reasons against the wrong description.
- A maintainer ran `scripts/install.sh --target=$HOME` for a quick test and forgot to clean up. The next project install at the same scope spawns a drift the user has no easy way to debug.
- A CI run on a worker that previously cached `~/.claude/skills/` from a stale prior job. `CI=true` skips the gate, but the probe (Phase C) catches it post-install.

## See also

- [`docs/contracts/skill-distribution-channels.md`](skill-distribution-channels.md) — per-tool canonical channel.
- [`scripts/_lib/scope_guard.sh`](../../src/scripts/_lib/scope_guard.sh) — guard implementation.
- [`scripts/cleanup_other_scope.sh`](../../src/scripts/cleanup_other_scope.sh) — companion cleanup.
- [`tests/test_cleanup_other_scope.py`](../../tests/test_cleanup_other_scope.py) — safety regression.
- [`README.md` § Installation](../../README.md) — consumer-facing install path.
