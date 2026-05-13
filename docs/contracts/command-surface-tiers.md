# Command Surface Tiers

> **Status:** Active. Defines the tiering contract for the two
> command surfaces this package ships:
>
> - **CLI commands** rendered by `./agent-config --help`.
> - **Slash commands** under `.agent-src.uncompressed/commands/**`.
>
> Per Phase 4 of `agents/roadmaps/road-to-distribution-maturity.md`.

## Why tiering

`./agent-config --help` currently prints 45 CLI commands; the slash
surface ships 106 files (52 root + 54 orchestrator children). A new
contributor running `--help` reads a wall of operational, hook, and
maintenance commands before they find `init / sync / validate / work`.
Tiering separates **the path a new contributor walks** (Tier-0) from
**power-user workflows** (Tier-1) from **hook / maintenance / internal**
(Tier-2).

## The three tiers

### Tier-0 — daily-driver

The path a new contributor walks on day one. Visible in
`./agent-config --help` by default. Visible at the top of any
`/agents audit` listing.

**Membership criteria — ALL must hold:**

1. **First-week need.** A solo contributor hitting the package for
   the first time will run this within their first five sessions
   without being told.
2. **Stable surface.** The command name + flag set has not changed
   in the last two minor releases (or is brand-new with a
   commitment to two-release stability).
3. **No prerequisite tooling beyond `bash` + `python3`.** Docker,
   GPG, jq, gh CLI, npm globals are all Tier-1+ territory.
4. **Cited in the `init → sync → validate → work` outcome path**
   OR cited by a Hard-Floor safety rule
   (`commit`, `keys:install-*`) OR is the AI-Council entry point
   that the daily workflow depends on (`council:*`).

**Canonical Tier-0 members (2026-05-13):**

- CLI: `init`, `sync`, `validate`, `work`, `first-run`,
  `keys:install-anthropic`, `keys:install-openai`,
  `council:estimate`, `council:run`, `council:render`,
  `implement-ticket`, `help`, `--version`.
- Slash: `/onboard`, `/commit`, `/work`, `/implement-ticket`,
  `/agent-status`, `/agent-handoff`.

### Tier-1 — power-user

Workflows a contributor reaches for in week two or beyond, or
release / review / audit paths the maintainer team uses. Visible in
`./agent-config --help --tier=1` and in `/agents audit`'s expanded
view. Documented in the same surface as Tier-0.

**Membership criteria — ANY suffices:**

1. **Repeat workflow, not first-week.** Used by every contributor
   eventually but not on day one (`/create-pr`, `/review-changes`,
   `/optimize`).
2. **Maintainer-team gate.** Release-shape commands, audits,
   migration helpers (`update`, `versions`, `prune`, `doctor`,
   `export`, `migrate`, `uninstall`).
3. **Orchestrator dispatch surface.** Top-level slash orchestrators
   whose children carry the actual work (`/roadmap`, `/feature`,
   `/fix`, `/judge`, `/memory`, `/optimize`, `/council`).

### Tier-2 — maintenance / internal

Default for new commands. Hidden from `./agent-config --help`
unless `--tier=all`. Reachable by full name; not advertised.

**Membership criteria — ANY suffices:**

1. **Hook entry point.** `*-hook` commands wired by the platform
   (`chat-history:hook`, `dispatch:hook`,
   `roadmap-progress:hook`, `onboarding-gate:hook`,
   `context-hygiene:hook`, `hooks:install`, `hooks:status`).
2. **Internal / programmatic.** Called by other scripts or by the
   work-engine, never typed by a human (`memory:*`,
   `proposal:check`, `refine-ticket:detect`, `migrate-state`,
   `telemetry:*`, `mcp:render`, `mcp:check`, `mcp:setup`,
   `mcp:run`, `roadmap:progress-check`).
3. **Sub-command of a slash orchestrator** — the orchestrator is
   Tier-1; the children are Tier-2 because they are invoked via
   the orchestrator's menu, not by name.
4. **Anything else.** Default for new commands; promotion is the
   harder direction.

## Promotion gate (Tier-2 → Tier-1, Tier-1 → Tier-0)

Promotion is **not implicit**. Each promotion requires:

1. A short ADR under `docs/decisions/` citing this contract and
   the specific criterion satisfied.
2. The frontmatter `tier:` change in the same commit as the ADR.
3. CI green (`tests/test_command_surface_tiers.py` + `task ci`).

Demotion is allowed without ADR (Tier-0 → Tier-1, Tier-1 → Tier-2)
but must update this contract's canonical list.

## Tagging shape

Slash commands carry tier in YAML frontmatter:

```yaml
---
name: commit
tier: 0
description: Stage and commit all uncommitted changes …
---
```

CLI commands carry tier in the `agent-config` heredoc, by section —
the help text groups commands under `## Tier 0`, `## Tier 1`,
`## Tier 2 (hidden by default)` headings rendered by
`./agent-config --help --tier=all`.

## Drift / lint

`scripts/lint_command_tiers.py` enforces:

1. Every file under `.agent-src.uncompressed/commands/**.md` has
   a `tier:` frontmatter key whose value is `0`, `1`, or `2`.
2. Every command listed under `## Tier 0` / `## Tier 1` /
   `## Tier 2` in this contract resolves to a real command file or
   a real CLI command name.
3. No command appears in two tier lists in this contract.

Hooked into `task lint-skills` so it runs in CI.

## See also

- `agents/roadmaps/road-to-distribution-maturity.md` — Phase 4.
- `docs/contracts/command-clusters.md` — orchestrator → child wiring.
- `docs/contracts/STABILITY.md` — surface-stability commitments.
