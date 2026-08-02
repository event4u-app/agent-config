---
complexity: structural
status: ready
parent: road-to-package-renewal.md
---

# Road to renewal — Leverage (execution flows + documented-failure fixes)

> Sub-roadmap of [`road-to-package-renewal.md`](road-to-package-renewal.md).
> Blocked until Foundation Phase 1 is green.
> (Council-locked ordering: fix the oracle before shipping behavior changes
> it must validate.)
>
> **Harvest-freeze lock note (council 2026-08-02, loop 1, unanimous):** the
> restraint decision of 2026-07-20 freezes capability-adoption until the first
> documented external adopter. Phase 2 below carries ONLY borrows that pass
> the return-prevention discriminator — each closes a RECORDED internal
> failure and cites its incident. The purely additive borrows are frozen and
> listed in the central roadmap under "Findings not carried forward". Each
> borrow lands re-derived against house standards per code-provenance.

## Phase 1 — execution flows

- [ ] Work-engine batching: collapse the one-CLI-round-trip-per-step loop by
      batching directives per invocation (most steps are no-op precondition
      gates); respect the ADR-124 embedded-engine doctrine — this changes call
      granularity, not the engine's shape; verify: one real roadmap run
      before/after (invocations per phase recorded in the PR description)
- [ ] Opt-in parallel step dispatch in `/roadmap:process-full` for independent
      steps (subagent fan-out with verified returns; subagent locks from the
      A1 contract stay: verify every return, N=3 budget, no Hard-Floor
      delegation)
- [ ] Flip `roadmap.dashboard_regen_cadence` default from `per_step` to
      `every_5_steps` (file-shape touches still regen immediately per
      roadmap-progress-sync Iron Law 1)
- [ ] Feed the ~1,900-line no-invocation-path finding (analysis estimate —
      enumerate first: file list + method) as input evidence into
      `road-to-surface-consolidation.md` Phase 3, which OWNS the
      utilization-window disposition sweep (window elapses ~2026-08-26;
      pre-window deletions forbidden by its verify). No parking action here
- [ ] Precondition gate for hub generation: name the measured cost the
      generator would remove (projection token footprint of hub bodies, or a
      concrete hub↔contract drift bug); no cost nameable → close the next
      step as `[-]` with that finding
- [ ] Generate cluster hub bodies from frontmatter (41 cluster-hub command
      files, ~87 lines avg of repeated dispatch ceremony); verify: generated
      output equals the current hand-written bodies or the intended diff is
      reviewed, with a regen assertion in CI
- [ ] Trim `post_tool_use` hook fan-out: 7 concerns run on every tool call on
      6 platforms — gate concerns by event relevance; verify: hook manifest
      shows per-event registration + a unit test asserting a non-matching
      event skips the gated concerns

## Phase 2 — documented-failure fixes with borrowed shape

> Discriminator (council loop 1): "would this borrow's absence cause a RETURN
> to a previously-documented failure state?" Every item cites its incident.
> Loop-2 audit note: the PreCompact re-injection borrow was moved to the
> frozen list — its incident citation did not verify (the hot-context cache
> was a capability ADOPT, not an incident fix) and the shipped
> `hot_context_hook.ts` already restores on SessionStart source=compact.

- [ ] Worktree seeding allow/deny list (adapted from Source W's committed
      manifest, re-scoped to the cheaper rung): encode the documented trap
      list — symlink `node_modules`, copy `.augment/`, NEVER copy
      `.agent-settings.yml` — directly in the existing worktree-creating
      flows; a committed manifest file only if flow-external tools need it.
      Incidents: the recorded worktree-trap family (partial node_modules
      fakes failures; pre-push projection trap; stale dist fakes generator
      drift)
- [ ] Config-protection hook (adapted from Source E): PreToolUse guard that
      blocks edits weakening gates/thresholds/allowlists in config while a
      fix-loop is active — "fix the code, not the config". Incident: the
      documented allowlist-growth antipattern (>20 entries in one session =
      the linter is wrong; recorded as a silent budget bypass)
- [ ] Inline-Brief fallback in orchestrating commands (adapted from Source W):
      2-3-line essence of each dispatched skill so a missing skill degrades
      gracefully instead of breaking the flow. Incident: the recorded UI-track
      failure dispatching to nonexistent skills

## Phase 3 — tracker clarification (docs-only)

- [ ] Document the existing `## Blockers` section convention
      (Status/Owner/Blocks/What to do/Resolved when) as the canonical
      "awaiting-evidence" signal in the roadmap-management skill — no new
      status glyph (the proposed `awaiting-evidence` state is frozen per the
      harvest-freeze split; the convention already carries the need)

## Verification

- Every behavior change re-runs the gates it touches; flow changes get a
  before/after on one real roadmap run (steps/hour, tokens/step). Measurement
  precondition: the run enables the orchestration/artifact-engagement
  telemetry for that session — it is default-off, so an unconfigured run has
  no data source (subagents themselves ship enabled per ADR-117).
