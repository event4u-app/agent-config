---
complexity: structural
status: later
parent_roadmap: road-to-token-economy-dispatch
---

# Roadmap: Follow-up to road-to-token-economy-dispatch — the data-window and blocker-gated remainder

> The worker/reviewer thin projection ships from measured `rules_used` data,
> the reviewer tier default gets its quality-floor comparison, and the four
> review-window acceptance verdicts are recorded — completing what the parent
> built the machinery for.

> **Parked in `later/` (2026-08-10, Iron Law 3 resolution — operator pick:
> follow-up ready + blocked).** Every open step below is gated on something
> outside agent control: a ≥ 2-week telemetry window that started 2026-08-10,
> or a maintainer blocker. **Resume when EITHER:** (a) the `rules_used`
> window has data (earliest ~2026-08-24 — run
> `./scripts-run src/scripts/dispatch_economy_report` and check
> `rules_efficiency.envelopes_with_pair > 0` over ≥ 2 weeks), or (b) the
> `reviewer-tier-quality-floor` comparison note exists. The registered
> review date for all metric verdicts is **2026-11-10**
> (`src/config/dispatch-economy-metrics.json`).

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/road-to-token-economy-dispatch.md`](../archive/road-to-token-economy-dispatch.md)
(28/28 steps done, 8 deferred). The parent shipped: `dispatch_floor` /
`rules_efficiency` / `ask_economy` / `return_channel` / `projection_quality`
registered metrics with a first live reading (median init 251.0k, weighted
ratio 0.21), the role axis in the hook manifest (worker chains thinned,
pre_tool_use structurally undroppable), rung 0.5 (`ask_transport`, live-run
at 321 tokens vs the 251k spawn floor), the class-C subagent model ceiling,
and the envelope-only return channel with committed caps. What remains is
exactly what needs TIME (telemetry windows) or an open maintainer blocker.

Blockers carried from the parent (both still open there, verbatim below):
`fork-spawn-cache-verification` (live two-arm probe before any
stronger-than-ordering fork doctrine) and `reviewer-tier-quality-floor`
(verdict-agreement comparison before the reviewer small-tier default).

## Phase 3 (parent) — worker thin projection, cut where the data says

- [ ] 3.1 Role-marked worker spawns load the execution projection
      (`contexts/execution/` + the rule subset the parent's 1.3 metric shows
      workers actually use) instead of the full layer, via the existing
      thin-projection machinery (`project_thin_rules.ts`). Cut line
      committed as a manifest (reviewable, diffable), derived from ≥2 weeks
      of `rules_used` data — never hand-feel. <!-- carried from parent 3.1;
      host scope per the resolved worker-chain-host-delivery probe: binds on
      CLI-spawned sessions -->
- [ ] 3.2 The reviewer role gets its own projection (review contexts +
      safety floors); reviewer spawns are marked `role: reviewer` where a
      suite-owned spawn wrapper exists (Agent-tool spawns cannot be marked
      on this host — probe on record in the parent). <!-- carried from
      parent 3.2; the reviewer enum value is reserved and fail-open -->
- [ ] 3.3 Escape hatch, envelope-carried: a worker that hits a wall
      (`needs_context: <rule-id>`) records the miss in its CHECKPOINT
      envelope; the orchestrator may re-dispatch with the widened
      projection. Misses are telemetry (`projection_miss` lines) and feed
      the cut-line review — the projection widens by recorded evidence.
      <!-- carried from parent 3.3; builds WITH 3.1 -->

**Exit:** `dispatch_floor` for rung-1 workers drops measurably against the parent's registered target (< 0.15 weighted ratio); worker correctness monitored via the armed `projection_quality` kill criterion (+5pp margin, 2-week window).
**Rollback:** role resolves to full layer (parent 2.4 fail-open path); the cut-line manifest is one revert.

## Phase 5 (parent) — reviewer tier default

- [ ] 5.3 The end-review reviewer runs on the table's review tier by
      default; a reviewer that escalates records the criterion it invoked in
      the review artifact. <!-- carried from parent 5.3; gated on the
      reviewer-tier-quality-floor comparison (small-tier vs main-model
      verdict agreement + missed-defect count, pre-registered null:
      "small tier misses materially more" pins the reviewer to the main
      model with evidence attached) -->

**Exit:** the reviewer default cites the comparison note — whichever way it went.
**Rollback:** remove the tier default; `inherit` resumes.

## Acceptance criteria (review-window verdicts, carried from the parent)

- [ ] `dispatch_floor` and `rules_efficiency` have at least one
      review-window verdict recorded (including the honest-null path) —
      due at the registered review date 2026-11-10.
- [ ] A rung-1 worker dispatched post-projection shows median `init_tokens`
      reduced against the parent's baseline (251.0k) by the registered
      target, with verify-fail rate inside the +5pp margin.
- [ ] The end-review reviewer's default tier decision cites the
      `reviewer-tier-quality-floor` comparison note.
- [ ] Dispatching a two-worker rung-2 task grows the orchestrator context
      by two envelopes within the committed 12,000-char cap
      (`return_channel` metric on record).
