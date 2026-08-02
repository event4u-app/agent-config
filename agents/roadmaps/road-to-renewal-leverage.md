---
complexity: structural
status: ready
parent: road-to-package-renewal.md
---

# Road to renewal — Leverage (execution flows + external borrows)

> Sub-roadmap of [`road-to-package-renewal.md`](road-to-package-renewal.md).
> Blocked until Foundation Phase 1 is green (council-locked: fix the oracle
> before shipping behavior changes it must validate). External mechanisms come
> from the four tree-level deep-dives (Sources R/E/S/W, provenance in the
> central roadmap); each borrow lands re-derived against house standards per
> code-provenance, never as a copy.

## Phase 1 — execution flows

- [ ] Work-engine batching: collapse the one-CLI-round-trip-per-step loop by
      batching directives per invocation (most steps are no-op precondition
      gates); respect the ADR-124 embedded-engine doctrine — this changes call
      granularity, not the engine's shape
- [ ] Opt-in parallel step dispatch in `/roadmap:process-full` for independent
      steps (subagent fan-out with verified returns; subagent locks from the
      A1 contract stay: verify every return, N=3 budget, no Hard-Floor
      delegation)
- [ ] Flip `roadmap.dashboard_regen_cadence` default from `per_step` to
      `every_5_steps` (file-shape touches still regen immediately per
      roadmap-progress-sync Iron Law 1)
- [ ] Park the dead-weight command tail (~1,900 lines with no plausible
      invocation path) behind default-off packs and out of the default
      projection; keep discovery metadata so they remain findable
- [ ] Generate cluster hub bodies from frontmatter (35 hub files ×
      ~80 lines of repeated dispatch ceremony)
- [ ] Trim `post_tool_use` hook fan-out: 7 concerns run on every tool call on
      5 platforms — gate concerns by event relevance

## Phase 2 — external borrows, hook layer (adopt/adapt verdicts recorded)

- [ ] `.worktreeinclude` manifest (adopt, Source W): committed
      gitignore-syntax manifest of gitignored-but-needed local state to copy
      into new worktrees; encode our documented worktree traps as explicit
      allow/deny entries (node_modules symlink, `.augment/` copy, NEVER
      `.agent-settings.yml`); consume it in worktree-creating flows
- [ ] PreCompact hook context re-injection (adopt, Source R): before host
      compaction, re-inject the load-bearing session state (active roadmap,
      current step, locks) so compaction cannot orphan the task
- [ ] Config-protection hook (adopt, Source E): PreToolUse guard that blocks
      edits weakening gates/thresholds/allowlists in config while a fix-loop
      is active — "fix the code, not the config"
- [ ] MCP server health gating (adopt, Source E): probe configured MCP servers
      at session start; surface dead servers instead of failing mid-task
- [ ] Session cost/token telemetry hooks (adapt, Source E): per-session token
      + spend readout via existing telemetry schema (ids + counters only, no
      free-form fields per PII-exclusion-by-construction)
- [ ] Fact-forcing edit gate spike (adapt, Source E): deterministic
      PreToolUse enforcement of source-discovery on structural edits —
      phase-gated behind a false-positive budget measured on a week of real
      sessions
- [ ] USD budget circuit-breaker for subagent fleets (adapt, Source S):
      hard cap per orchestrated run, cancel-pending on breach; integrates with
      the existing orchestration telemetry

## Phase 3 — roadmap/tracker upgrades (adapt, Source W)

- [ ] `awaiting-evidence` roadmap status: distinct glyph/state for "blocked on
      evidence only the human can produce" (today approximated by `[~]` or
      `later/`); wire into dashboard + `/roadmap:process-*` skip logic
- [ ] Inline-Brief fallback in orchestrating commands: 2-3-line essence of
      each dispatched skill so a missing skill degrades gracefully instead of
      breaking the flow (known failure: UI track dispatched to nonexistent
      skills)
- [ ] Forward-routing footers on the big orchestrators (`/work`,
      `/roadmap:process-*`): "when done, if X → route to Y" exit-condition
      table
- [ ] In-description cross-skill deflection on measured coin-flip clusters
      ("for X see sibling-skill" one-liners) — cheaper than dedicated routing
      rules for low-stakes clusters

## Verification

- Every behavior change re-runs the gates it touches; flow changes get a
  before/after on one real roadmap run (steps/hour, tokens/step from the
  orchestration telemetry).
