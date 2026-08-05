# Surface-consolidation restraint decisions (9.4.0 review)

Durable home for the restraint decisions from `road-to-surface-consolidation`
(the roadmap is transient; these locks must outlive it). The 9.4.0 review's
load-bearing rule: **"welcher bestehende Mechanismus wird dafür entfernt oder
ersetzt?"** — growth of the mental surface must be paid for by removal.

## Decisions (recorded 2026-07-20)

- **Harvest freeze — LIFTED 2026-08-05. Canonical records:
  [`ADR-211`](../../../docs/decisions/ADR-211-harvest-freeze-resume-conditions.md)
  (2026-08-03) as amended by
  [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
  (2026-08-05).** The original 2026-07-20 wording anchored the freeze on external
  adoption. **That anchoring was wrong and is struck.** External adoption is not a
  project goal and is not a valid gate anywhere in this tree (ADR-216 § D5). The
  restraint's real and only basis was **maintainer capacity**: harvest work waits
  while foundational work is open, because one maintainer cannot carry both.
  Those foundational conditions are met, so the freeze is lifted in full.
  What survives is the **two-slot concurrency cap** on concurrently-open
  `road-to-skill-ecosystem-*` roadmaps — capacity, mechanically enforced. The
  evidence-direction requirement (finding precedes borrow) and the
  red-test-first latent-risk door also survive; both are adoption-independent.
  Consult ADR-216, not this bullet, for the current rule.

- **No new council / review / verification modes before the pending
  benchmarks.** Team-mode Phase 5 landed an honest null; adversarial-council is
  UNBACKED (corpus-gated); council-vs-solo is open. No `/verify`, no Unified
  Verification Router, no new judge/council variant ships until those verdicts
  exist. **The condition is the pending benchmarks and nothing else** — an earlier
  reading of this bullet tied it to "pending the first external adopter", which
  ADR-216 strikes. Benchmarks are reachable; an adopter was not. A router that cannot *replace* the scattered modes (only sit above
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
