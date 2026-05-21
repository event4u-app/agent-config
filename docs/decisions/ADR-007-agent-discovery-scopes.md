---
adr: 007
status: accepted
date: 2026-05-12
decision: global-default-install-with-export-subcommand
supersedes: —
superseded_by: —
phase: post-v2.1.0 · simplicity-and-everywhere
---

# ADR-007 — Agent Discovery Scopes: Global-Default Install Model

> **Update (v2.4, 2026-05-13):** the user-scope dir was relocated from
> `~/.config/agent-config/` to `~/.event4u/agent-config/` by
> [`ADR-009`](ADR-009-event4u-namespace.md). The legacy path is still
> read as a back-compat fallback. The discovery-scope contract in this
> ADR is otherwise unchanged.
>
> **Note (post-acceptance):** the one-shot installer command was later
> renamed from `npx @event4u/create-agent-config init` to
> `npx @event4u/agent-config init` when the standalone wrapper package
> was retired. References to the old command name below are preserved
> for historical accuracy; the discovery-scope decision itself is
> unchanged. See `CHANGELOG.md` → `[Unreleased]` → "Package
> consolidation".

## Status

**Accepted** · 2026-05-12 · signed off by Matze after Council Round 3 convergence. Implementation tracked in `agents/roadmaps/road-to-global-first-install.md`.

Originates from user ask: "Es macht keinen Sinn, das paket nicht
global zu installieren." Validated through AI Council (2 + 1 rounds,
2026-05-12 · members claude-sonnet-4-5 + gpt-4o). Council session:
[`agents/runtime/council/sessions/2026-05-12-global-first-strategy/`](../../agents/runtime/council/sessions/2026-05-12-global-first-strategy/). <!-- council-ref-allowed: ADR decision trace -->

## Context

`event4u/agent-config` v2.1.0 ships strictly via
`npx @event4u/create-agent-config init`, project-scoped. The package
must serve **10 distinct AI agents**, each with its own discovery
rules — both user-scope (global) and project-scope (workspace) paths.
Today the CLI only installs project-locally; a `global` subcommand
in `scripts/agent-config` returns "reserved for Phase 3 of
road-to-simplicity-and-everywhere".

The user wants global to be the **default** path, not a special case.
Before flipping the default, we needed to answer four blocking
questions: (1) is global-default sound across all 10 agents? (2) how
do we detect user intent? (3) how do we handle tools that
project-scope wins? (4) how do we preserve version reproducibility
once `npx` resolves global state?

### Relationship to the retired `--global` (commit `5388de25`)

A previous `--global` flag existed in `scripts/install.py` and was
**retired** on 2026-05-12 alongside the composer/npm drop
(`road-to-portable-runtime-and-update-check` step P0.5,
[archived roadmap](../../agents/roadmaps/archive/road-to-portable-runtime-and-update-check.md)).
The retired design was an **in-project symlink scheme** driven by
`templates/global-install-manifest.yml` — it wrote symlinks *into the
project* pointing back at a curated set in the user's home. Pain that
killed it: gitignore drift, link breakage on rebase / worktree, and a
manifest separate from the main install set that drifted out of sync.

ADR-007's `--global` is a **different mechanism with the same flag
name**:

| Dimension | Retired `--global` (pre `5388de25`) | ADR-007 `--global` (this decision) |
|---|---|---|
| Files live in | Project repo (`.claude/`, …) as symlinks | User home (`~/.claude/`, …) as **real files** |
| Manifest | Separate curated `global-install-manifest.yml` | Same full set as project install (D4) |
| Project-side artefacts | Symlinks, gitignored | None by default; opt-in via `export` (D3) |
| Version-pin governance | None — drift via symlink target swap | `~/.config/agent-config/installed.lock` (D5) |
| In-project gitignore footprint | Required and brittle | Zero |

The retired pain is structurally absent from the new design: no
in-project symlinks, no manifest split, an explicit version lockfile.
The flag name is reused; the implementation is rebuilt.

### Verified per-agent discovery matrix (May 2026)

| Agent | User-scope (global) | Project-scope | Precedence |
|---|---|---|---|
| Claude Code | `~/.claude/{skills,commands,rules,settings.json}` + `~/.claude/CLAUDE.md` | `.claude/…` + `CLAUDE.md` | managed > user > project (skills) |
| Claude Desktop | `~/.claude/` (shared) | — | user only |
| Cursor | User Rules (app settings) + `~/.cursor/` (MCP) | `.cursor/rules/*.mdc` | team > user > project |
| Windsurf | `~/.codeium/windsurf/global_rules.md` + `…/global_workflows/` | `.windsurfrules` + `.windsurf/{rules,workflows}/` | **workspace > global** |
| Cline | `~/Documents/Cline/Rules/` | `.clinerules` (file or dir) | **workspace > global** |
| Augment Code | `~/.augment/{rules,commands}/` | `.augment/{rules,commands}` + `.augment-guidelines` + `AGENTS.md` | workspace > user (cmds); user always-on (rules) |
| GitHub Copilot | `~/.copilot/copilot-instructions.md` (CLI) + Personal Instructions (settings) | `.github/copilot-instructions.md` + `.github/instructions/*` | personal > repo > org |
| Gemini CLI | `~/.gemini/GEMINI.md` + `~/.gemini/settings.json` | `GEMINI.md` (hierarchical) + `.gemini/settings.json` | **project > user > system** |
| Aider | `~/.aider.conf.yml` + `~/.aider.conventions.md` | `.aider.conf.yml` (git root) + `CONVENTIONS.md` | last loaded wins |
| OpenAI Codex | `~/.codex/AGENTS.md` (+ override) + `$HOME/.agents/skills` | `AGENTS.md` (repo + nested) + `.agents/skills` + `.codex/config.toml` | closer-to-cwd wins |

**Finding:** every supported agent has a user-scope path. Global
install is technically viable across the entire matrix.

**Asymmetry that bit the original strategy:** Windsurf and Cline are
`workspace > global` — a project-local override silently wins. Gemini
is `project > user > system`. Claude Code is `user > project` for
skills. A symlink-bridge approach (originally proposed) cannot give a
consistent cross-tool experience because per-tool precedence rules
differ.

## Council Process

| Round | Members | Cost (actual) | Verdict |
|---|---|---|---|
| 1 + 2 (interleaved) | claude-sonnet-4-5 + gpt-4o | $0.0443 | claude: **REJECT** · gpt-4o: **MODIFY** |
| 3 (targeted resolution) | same | $0.0252 | **3/4 convergence** |

Full responses:
[`responses.json`](../../agents/runtime/council/sessions/2026-05-12-global-first-strategy/responses.json), <!-- council-ref-allowed: ADR decision trace -->
[`responses-round3.json`](../../agents/runtime/council/sessions/2026-05-12-global-first-strategy/responses-round3.json). <!-- council-ref-allowed: ADR decision trace -->

## Decision

Adopt **Global-Default Install with Export-Subcommand** in five parts.

### D1 — Install scope: global is the default

`npx @event4u/create-agent-config init` defaults to **user-scope
install** (`~/.claude/`, `~/.cursor/`, `~/.codeium/windsurf/`,
`~/.augment/`, `~/Documents/Cline/Rules/`, `~/.copilot/`, `~/.gemini/`,
`~/.aider.conventions.md`, `~/.codex/`). Project-scope install is
**opt-in** via `--project[=<dir>]`. Global is no longer a flag — it
is the brand promise.

Rationale: one npx invocation = configured everywhere. Per-project
overrides remain available via existing `.agent-settings.yml` merge
chain (`~/.config/agent-config/agent-settings.yml` → project
`.agent-settings.yml` → CLI flags).

### D2 — Init UX: prompt only on ambiguity

| Signal | Behaviour |
|---|---|
| CWD has existing `.agent-settings.yml` | Install **project** (current behaviour preserved) |
| CWD has `package.json` / `composer.json` / `pyproject.toml` AND existing AI-tool config (`.claude/`, `.cursor/`, etc.) | Prompt: `Project (current dir) / User (~/) / Custom path` |
| CWD has existing `~/.claude/CLAUDE.md` and command would overwrite | Prompt: `Merge / Backup-and-replace / Abort` — **Hard Floor** |
| Anything else (incl. CWD = `~/`, empty dir, dotfile-git repos) | Install **global**, no prompt |

`.git/` presence is **explicitly not a signal** (monorepos, dotfile
managers, Hg/SVN workspaces all break it). Replaced by multi-signal
detection + collision-triggered prompt.

### D3 — Bridge → Export

The originally proposed symlink-bridge subcommand is **rejected**.
Replaced by:

```
agent-config export --tool=<x> --output=<path> [--force]
```

Behaviour:
- Writes a **real file** (no symlink) with the resolved content for
  the named tool, into the user-specified path.
- Idempotent. `--force` overwrites; default refuses on existing file
  with non-matching content (Hard Floor).
- User decides path — no canonical defaults baked in (tool-specific
  paths drift upstream).
- Use cases: committing `.github/copilot-instructions.md` for team
  sharing, versioning `AGENTS.md` or `CLAUDE.md` in repo, exporting
  curated subsets to `docs/ai-context.md`.

Rejected: symlink-bridge. Reasons (council-converged):
- Tool-precedence asymmetry makes symlinks behave differently per
  tool (Windsurf ignores global-bridged file; Claude Code honors it).
- Symlinks under Git track the pointer path, not content — useless
  on team-mate machines where `~/` differs.
- Windows symlink privilege (`SeCreateSymbolicLinkPrivilege`) is
  developer-mode / admin-only; corporate Group Policy frequently
  blocks it.
- EDR tools quarantine symlinks in user-profile config directories
  as "unusual script activity".

### D4 — Manifest: single full set, no curation split

Global install ships **all** kernel + tier-1 + tier-2 + skills (same
manifest as project install). No `templates/global-install-manifest.yml`.

Council convergence is **3/4** here — anthropic strongly recommends
**(a) full** with the argument "10 MB is negligible on any dev
machine; curated subset creates drift + discovery problems + a second
command to unblock the rest". OpenAI prefers **(b) curated** but with
generic rationale.

**Residual debate:** the (b) curated camp can still be honored
post-implementation by adding an `agent-config install --minimal`
flag without changing the default, if real-world feedback shows the
full footprint hurts. The decision here is "ship full, narrow later
if needed" rather than "ship curated, broaden later".

### D5 — Version reproducibility: lockfile

```
~/.config/agent-config/installed.lock
```

Schema:
```json
{
  "version": "2.2.0",
  "installed_at": "2026-05-12T10:30:00Z",
  "tools": ["claude-code", "cursor", "windsurf"]
}
```

`init` on existing lock with matching version: **skip**.
`init` on existing lock with differing version: **fail loud** with
"Installed: v2.1.0. Current: v2.2.0. Run `agent-config update` or
`init --force`."

`update` is an explicit subcommand. Writes new lock atomically. No
silent updates ever.

### D6 — Source-repo guard stays

`AGENT_CONFIG_ALLOW_SELF_INSTALL=1` requirement when run from inside
the `agent-config` source repo applies to **both** global and
project modes (a stray `npx … init` from inside the source tree
would overwrite the maintainer's `~/.claude/` with package's own
maintainer manifest).

## Consequences

### Positive

- One command, every project: `npx @event4u/create-agent-config init` works
  in `~/`, in a fresh project, in an existing project with no config.
- Cross-tool consistency: every supported agent gets the same skill /
  rule set from one source of truth in `~/`.
- No symlink-related fragility (Windows, EDR, Git semantics).
- Version reproducibility via lockfile is auditable, inspectable, and
  explicit.

### Negative

- Behavioural change vs v2.1.0: existing project-installs continue to
  work, but new installs default to a different location. Ships as a
  v2.x release (v2.0.0 was the breaking npx-only cut; subsequent v2.x
  work refines that line — no v3.0.0 planned). Documented migration
  in the release notes is required.
- Tools with `workspace > global` precedence (Windsurf, Cline,
  Gemini) require user action to bridge: either `agent-config export`
  into the project or `--project` flag at install. Pure global-only
  users on those tools may not see the rules apply inside specific
  repos.
- A `~/.config/agent-config/installed.lock` introduces a new state
  surface. Uninstall must remove it cleanly; corrupted-lock recovery
  needs documenting.
- Curation decision is provisional. If `~/.claude/skills/` footprint
  causes complaints, post-launch we may need to add a `--minimal`
  install profile (revisits D4).

### Neutral

- The latent `--global` flag in `scripts/install.py` becomes the new
  default codepath — no longer hidden, fully exercised in CI.
- The `bridge` subcommand reserved for "Phase 3 of
  road-to-simplicity-and-everywhere" is **never built**. Roadmap
  entry should be updated to point at `export` instead.

## Amendment 2026-05-13 — Augment global-only

**Status:** Accepted · 2026-05-13 · signed off by Matze.

### Trigger

Real install measurement: the full body of every file in
`~/.augment/rules/` counts against Augment's **49,512-char
workspace-guidelines limit** (not just the description stubs that
`scripts/measure_augment_budget.py` assumes for `type: auto` rules).
A populated `~/.augment/rules/` deterministically exceeds the budget
on every workspace (~138k chars observed — ~89k over limit).

The competing pressure: a per-project deploy of the same content
would still overflow Augment's limit (the limit is per-workspace,
not per-scope) **and** would scatter the content across every repo
the developer opens, multiplying the maintenance surface.

### Decision

`augment` becomes **global-only** in `SCOPE_SUPPORT`:

- `npx @event4u/agent-config init --tools=augment --global` — supported.
- `npx @event4u/agent-config init --tools=augment` (project) — **rejected**
  with a directive error pointing at this amendment.
- `npx @event4u/agent-config init` (default `--tools=all` at project
  scope) — silently filters `augment` out (matching the
  `claude-desktop` / `jetbrains` pattern).

Project-scope `init` still writes `.augment/settings.json` as a
substrate bridge (plugin activation marker for the workspace) — but
**no** rules, skills, commands, contexts, personas, or templates are
written into `.augment/` at project scope.

### Trade-off accepted

The Augment workspace-guidelines overflow is a **known, surfaced
trade-off**, not a defect to fix. The package owner accepts that the
IDE will report the budget exceeded; the content shape is the
source of value, and chunking it to fit the limit would dilute that
value below the threshold that justifies the tool. The overflow
warning is documented in
[`docs/setup/per-ide/augment.md`](../setup/per-ide/augment.md#troubleshooting).

### Supersedes

The earlier `fix/augment-project-scope-only` branch (commit
`158f9912`, never merged) — which inverted the scope to
**project-only** — is hereby superseded. The project-only direction
solved the overflow at the cost of fragmenting content across every
repo; this amendment trades that cost for a single global surface
plus an explicit overflow tolerance.

### Consequences

- `GLOBAL_DEPLOY_SOURCES['augment']` carries the 6 source-to-dest
  mappings (rules, skills, commands, contexts, personas, templates)
  and remains the canonical Augment install surface.
- `_validate_scope` hard-rejects explicit `augment` at project scope
  and silently filters under `--tools=all --project`.
- Tests: `test_augment_rejects_project`,
  `test_all_silent_filters_augment_under_project`, and the existing
  `test_install_global_deploys_augment_content` pin the contract.
- The Supported Tools table in `README.md` moves Augment out of the
  project-installed category into the global-only (marker-in-project)
  category, alongside Claude Desktop.

## Implementation Plan (deferred to roadmap)

Out of scope for this ADR. Sequencing target for a separate roadmap:

1. Branch `feat/global-first-install` (requires user permission to
   create — not auto-spawned by this ADR).
2. Wire `scripts/install.py --global` through `create-agent-config`
   npx entry + `scripts/agent-config global` subcommand.
3. Implement multi-signal detection + collision prompt.
4. Implement `agent-config export --tool=<x> --output=<path>`.
5. Implement `~/.config/agent-config/installed.lock` + `update`
   subcommand.
6. Update `docs/installation.md`, per-IDE setup pages, `README.md`
   tagline.
7. Add CI matrix: global-install path on macOS, Linux, Windows
   (lockfile, prompt suppression, Hard Floor enforcement).
8. CHANGELOG entry + v2.x migration guide.

## References

- Council session:
  [`agents/runtime/council/sessions/2026-05-12-global-first-strategy/`](../../agents/runtime/council/sessions/2026-05-12-global-first-strategy/) <!-- council-ref-allowed: ADR decision trace -->
- User-scope discovery matrix sources: agent vendor official docs
  (Claude, Cursor, Windsurf, Cline, Augment, Copilot, Gemini, Aider,
  Codex) accessed 2026-05-12.
- Prior latent global code: `scripts/install.py` (~280 LOC, never
  reachable from npx entry).
- Related rule: [`non-destructive-by-default`](../../.augment/rules/non-destructive-by-default.md) — Hard Floor on overwrite of user's existing `~/.claude/CLAUDE.md`.
