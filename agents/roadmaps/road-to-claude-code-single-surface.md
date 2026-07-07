---
complexity: standard
---

# Roadmap: Claude Code single distribution surface — retire the dual npx/marketplace overlap

> One authoritative content path into Claude Code, hooks preserved, duplicate
> skill/command listings and silent plugin-snapshot staleness structurally
> eliminated.

## Context

Two independent surfaces deliver content to Claude Code today: the npm file
projection (`agent-config global` → `~/.claude/`, ~735 files) and the optional
marketplace plugin (`agent-config@event4u-agent-config`, a git-SHA snapshot
raw-copied by Claude Code per ADR-089). Verified failure class (2026-07-07):

- **Duplicates** — with both installed, every skill/command lists twice
  (plain + `agent-config:`-prefixed). Token cost + noise.
- **Silent staleness** — the plugin snapshot was pinned to a 2026-06-12 SHA
  while the binary was current (8.2.0); new commands (`/optimize-project`)
  never arrived. The 8.2.0 upgrade→plugin-refresh chain broke twice in one
  day (`^C` at wizard; `Unknown argument: --no-ui`, fixed in PR #774).
- **Hooks are plugin-only** — `~/.claude/settings.json` and project settings
  carry zero `dispatch:hook` entries; removing the plugin silences
  hot-context, chat-history capture, context-hygiene, block-no-verify, and
  roadmap flip-guards. Hooks are a hard requirement (maintainer-confirmed).

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-07, 2 rounds,
$0.09): both members independently converged on **Option B — projection-
primary, plugin retired**, with hooks registered directly in
`~/.claude/settings.json` via a managed atomic-merge block. The round-2
challenge both members raised: B is only safe if `settings.json` hooks are
**functionally equivalent** to plugin `hooks/hooks.json` (firing semantics,
timeout, coexistence with user-owned hook entries) and if the
`agent-config:*` subagent types survive outside the plugin. That equivalence
check is the Phase 0 evidence gate; if it fails, the locked fallback is
**Option C — thin plugin** (plugin ships ONLY hooks + agents, all content via
projection; duplicates still eliminated because the plugin drops
skills/commands either way).

Rejected alternatives (council, don't relitigate without new evidence):

- **A / marketplace-primary** (incl. "npx only triggers the marketplace
  install") — SHA staleness would become the ONLY content path for Claude
  Code with an update UX we don't own; offline/air-gap path lost; npm binary
  is required regardless (hooks dispatch target, MCP, 22 other tools).
- **D / status quo + dedup guards** — keeps two moving parts plus new
  conditional logic; complexity is where the 8.2.0 failures came from.

Revisit-if: Claude Code changes plugin/marketplace semantics (auto-update of
plugin snapshots, hooks no longer readable from settings.json), or
marketplace discoverability shows measurable adoption impact after
delisting.

## Phase 0 — Evidence gate: settings.json hook + agent parity

Goal: prove (or refute) the load-bearing equivalence assumption before any
retirement work. Output: a short findings note in
`agents/settings/contexts/claude-code-hook-parity.md`.

- [ ] Inventory the plugin's full hook matrix (`hooks/hooks.json` events,
      command shape, timeout fields) from the installed snapshot and from
      `src/` — document every event we must reproduce
- [ ] Register the same hook matrix in a test `~/.claude/settings.json`
      managed block (same `dispatch:hook` commands) and verify each event
      fires in a fresh Claude Code session (SessionStart/SessionEnd/Stop at
      minimum) with the plugin disabled
- [ ] Verify coexistence: a pre-existing user hook on the same event keeps
      firing alongside the managed block (no clobber, defined order is
      acceptable)
- [ ] Verify subagent parity: check whether `~/.claude/agents/` (or the
      documented user-scope agents dir) can carry the `agent-config:*` agent
      definitions the plugin ships today; document any gap
- [ ] Decision checkpoint: parity confirmed → proceed with plugin
      retirement (Phases 1–4 as written); parity refuted on hooks →
      switch Phases 3–4 to the thin-plugin fallback (plugin keeps ONLY
      `hooks/` + `agents/`, `.claude-plugin/skills/` is emptied) and record
      the pivot in the findings note

## Phase 1 — Managed settings-merge protocol

Goal: a deterministic, user-safe way to own a block inside
`~/.claude/settings.json`.

- [ ] Implement atomic read→merge→write for the hooks section in the
      installer lib (`src/`): managed entries carry an identifying marker;
      merge never touches non-managed entries; write is atomic
      (temp file + rename) with a lockfile guard
- [ ] `agent-config uninstall` / `global` removal path deletes exactly the
      managed entries and nothing else
- [ ] Idempotency: re-running `agent-config global` twice produces zero diff
      in `settings.json`
- [ ] Unit tests for merge, collision (user already has a hook on the same
      event), removal, and corrupted-settings recovery
      <!-- carve-out: new-gate-verification -->

## Phase 2 — Installer + upgrade chain hardening

Goal: one update path (`agent-config upgrade`) that cannot silently skip the
hook wiring; the sequential-fragility class from 8.2.0 is closed.

- [ ] `agent-config global` (claude-code anchor) registers the hook matrix
      via the Phase 1 protocol as part of the normal deploy
- [ ] Decouple upgrade steps: a failed/aborted non-essential step (wizard,
      doctor) no longer skips later essential steps — essential steps run
      first, cosmetic steps last; each step reports pass/fail in the summary
- [ ] Remove the plugin-refresh steps from `cmd_upgrade.ts` once Phase 3
      lands (or gate them on plugin-still-installed during the deprecation
      window)
- [ ] Regression tests: upgrade with simulated step failure still wires
      hooks; `--no-ui` path covered end-to-end
      <!-- carve-out: new-gate-verification -->

## Phase 3 — Plugin retirement + user migration

Goal: existing dual-installed users converge on the single surface without
losing hooks mid-migration.

- [ ] `agent-config doctor`: new `duplicate-surface` check — plugin
      installed AND projection present → fail with the exact uninstall
      command; `hook-wiring` check — managed hooks present in settings.json
      and binary resolvable on PATH
- [ ] Migration flow in `upgrade`: when the plugin is detected, wire
      settings-hooks FIRST, verify, then surface the one-line
      `claude plugin uninstall agent-config@event4u-agent-config` prompt
      (never uninstall autonomously — user-owned surface)
- [ ] Marketplace listing: mark deprecated (README of the plugin manifest
      points to the npx path); delist after the deprecation window decision
- [ ] Docs sweep: README (§ Plugin-installed, § Troubleshooting),
      docs/installation.md, docs/getting-started.md § Keeping current,
      MIGRATION.md entry for the transition
- [ ] Fallback branch (only if Phase 0 refuted hook parity): strip
      `.claude-plugin/skills/` content entries from the manifest instead of
      delisting; plugin ships hooks + agents only; doctor `stale-plugin`
      check downgraded to info (hooks.json is stable, staleness stops
      mattering)

## Phase 4 — Permanent guardrails

Goal: the June→July silent-staleness case becomes structurally impossible to
reintroduce.

- [ ] CI lint: the hook matrix has ONE source of truth in `src/`; the
      settings-template block and (during deprecation) the plugin
      `hooks/hooks.json` are generated from it — drift fails the build
      <!-- carve-out: new-gate-verification -->
- [ ] Golden smoke: fresh global install → managed hooks present, one skill
      surface only (no `agent-config:`-prefixed duplicates), doctor green
- [ ] `doctor` runs as the last upgrade step and its `duplicate-surface` /
      `hook-wiring` findings are surfaced in the upgrade summary
- [ ] Findings note + this roadmap's outcome promoted to
      `agents/settings/contexts/` (durable decision record; council
      convergence inlined, no council-file links from stable artifacts)

## Acceptance criteria

- Exactly one content surface for Claude Code; zero duplicate skill/command
  listings in a fresh session.
- All deterministic hooks fire without the marketplace plugin (or, in the
  fallback, via the thin hooks-only plugin) — verified by the golden smoke.
- `agent-config upgrade` is the single update path; an aborted cosmetic step
  can no longer skip hook wiring or content refresh.
- `agent-config doctor` detects and names every mixed/stale state with a
  copy-paste fix.
