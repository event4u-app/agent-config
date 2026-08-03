# Surface-consolidation restraint decisions (9.4.0 review)

Durable home for the restraint decisions from `road-to-surface-consolidation`
(the roadmap is transient; these locks must outlive it). The 9.4.0 review's
load-bearing rule: **"welcher bestehende Mechanismus wird dafür entfernt oder
ersetzt?"** — growth of the mental surface must be paid for by removal.

## Decisions (recorded 2026-07-20)

- **Harvest freeze — canonical record is now
  [`ADR-206`](../../../docs/decisions/ADR-206-harvest-freeze-resume-conditions.md)
  (2026-08-03).** Original 2026-07-20 wording: no new competitive-harvest /
  capability-adoption roadmap opens until ≥1 real external adoption is
  documented; the binding constraint is adoption, not capability. ADR-206
  keeps the freeze and amends it: the resume condition becomes an OR
  (external adopter OR renewal-set closed + hook-latency repaired + council
  reconfirmation), adds a review cadence, requires failure findings to
  predate borrow proposals, and opens a red-test-first latent-risk door.
  Consult the ADR, not this bullet, for the current rule.

- **No new council / review / verification modes before the pending
  benchmarks.** Team-mode Phase 5 landed an honest null; adversarial-council is
  UNBACKED (corpus-gated); council-vs-solo is open. No `/verify`, no Unified
  Verification Router, no new judge/council variant ships until those verdicts
  exist. A router that cannot *replace* the scattered modes (only sit above
  them) is out of scope — it would add the seventh entry point to the six it
  "unifies."

- **`learning-tutor` is the named quarantine candidate.** The review names it
  farthest-from-core ("zahlt weder auf den Wedge noch auf die Evidenz-These
  ein"). Disposition: **measure first, do not delete now** — it carries no
  proactive command-suggestion surface (it is a skill, model-loaded on intent),
  so it is not part of the Phase-1 suggestion collapse. It enters the
  utilization sweep (repo-admin blocker); removal only on a data-backed
  low-utilization finding, per the review's own MERGE/DEMOTE/HIDE/REMOVE
  discipline.

- **Complexity budget is a checklist, not a gate.** The six questions
  (replaces / overlaps / discoverable / measurable / removable / who-debugs)
  live folded into
  [`artifact-drafting-protocol-mechanics`](../../../docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md)
  § Complexity budget — no new rule/lint was created (that would be the
  inflation it guards against).

## Council

2026-07-20 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds): the
consolidation lever is the proactive suggestion surface (cluster sub-commands
de-eligibled, heads keep routing), the complexity-budget folds into an existing
checklist, and the verification router is deferred (cannot replace without
inflation). Recorded inline per `no-roadmap-references`.
