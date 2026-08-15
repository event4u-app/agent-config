---
complexity: lightweight
status: blocked-for-later
---

# Road to a measured answer on model-curated working memory

**Goal.** If the deterministic working-memory cache is ever shown insufficient,
the model-curated alternative enters through a pre-registered two-arm comparison
rather than through enthusiasm. Nothing here reopens the verdict that put the
deterministic cache in place; this exists so that a future reopening has a shape
waiting for it.

**Source:** a proposal roadmap that arrived in the inbox, pinned at `e44e87865`,
archived local-only at `agents/tmp.old/context-custodian/`. Triage:
`agents/evidence/analysis/inbox-harvest-2026-08-d-triage.md`.

**Parked on arrival, in `later/`.** It declared itself blocked, both of its
gates are unmet, and the same measure-then-build shape already sits in this
directory as precedent (`road-to-deferred-rule-retriever.md:41-46`). Parking it
is the disposition, not a deferral of a decision about it.

## Context

- **The deterministic cache is a locked verdict, not a default.**
  `src/scripts/hot_context_hook.ts:11-16` states the contract — deterministic
  extraction, never model summarization — and the reasoning is recorded in
  `agents/settings/contexts/second-brain-delta-verdict.md` (2026-07-07). This
  roadmap respects it and does not re-argue it.
- **The precedent for the ordering is expensive and recorded.**
  `docs/CLAIMS.md:387` carries the code-graph null: recall 0.365 against
  disciplined grep's 0.797, a 43.2-point deficit, an engine built before it was
  measured and permanently disabled after.
- **The signal that would justify reopening is registered and has no data.**
  `src/config/hook-token-budget.json:80-84` holds `envelope_resume_success` as
  an HONEST GAP with no committed threshold before a baseline exists. Until it
  carries readings, "the deterministic cache is insufficient" is an assertion.

## The two gates

Both must be true before this file leaves `later/`:

1. **Metering is live.** The tool-result byte counter and the capture-before-
   destruction work in `road-to-inbox-harvest-2026-08-d-context-ledger.md`
   Phases 1 and 2 have shipped, so context cost and envelope presence are
   observable rather than inferred.
2. **A re-ask problem is measured, not felt.** `envelope_resume_success` shows a
   re-ask rate at or above 25 % across at least 20 sessions. Below that, the
   deterministic cache is doing its job and there is nothing to compare against.

## Phase 1 — The comparison, if both gates open

- [ ] 1.1 Register the two arms and the win bar **before** either runs:
      deterministic cache versus model-curated distillation, win declared only
      on a re-ask-rate improvement of at least 10 points at a net cost no more
      than 1.5× the deterministic arm. The distiller pays for its own tokens in
      that accounting.
      <!-- verify: test -f agents/evidence/analysis/distillation-comparison-preregistration.md -->
- [ ] 1.2 Run the distiller arm at the lowest capability tier. A top-band
      distiller would consume the economy it exists to serve, which makes the
      cheap tier a condition of the comparison rather than a cost-saving.
      <!-- verify: grep -c 'lite' agents/evidence/analysis/distillation-comparison-preregistration.md -->
- [ ] 1.3 Publish the reading whichever way it falls. A null closes this
      question permanently, with numbers, and the deterministic cache keeps the
      slot on evidence rather than on precedent.
      <!-- verify: test -f agents/evidence/analysis/distillation-comparison-result.md -->

## Acceptance criteria

- [ ] Both gates are demonstrably open before any arm runs.
- [ ] The win bar was fixed before the first measurement, not after.
- [ ] The result is published in either direction, and a null is recorded as a
      permanent closure rather than a pause.
- [ ] The locked deterministic-cache verdict was never bypassed, only measured
      against.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The file is read as licence to build the distiller | product | A parked roadmap that describes a mechanism in detail invites someone to start it before its gates open, which is precisely the ordering the code-graph null cost this package once already | The two gates are stated as conditions on leaving `later/` rather than as a first phase, and both are checkable facts rather than judgements | The two gates |
| 2 | The win bar moves after the first disappointing reading | implementation | Pre-registration is only binding if the bar predates the data, and a close miss is the moment it feels reasonable to adjust | 1.1 writes the bar to a tracked artefact before either arm runs, and 1.3 requires the reading to be published in either direction | Phase 1 — The comparison, if both gates open |
| 3 | The gate metric never accumulates and the question stays open forever | product | `envelope_resume_success` has no readings today, so the trigger could sit unmet indefinitely while the underlying question stays live | The metric is registered with a review date under its own budget file, so an absence of readings by that date is itself the answer rather than a silence | Context |
