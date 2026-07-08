---
complexity: structural
status: ready
---

# Road to skill eval coverage — close the 2-of-264 behavioural-eval gap, tier-prioritised, ratcheted

> The eval harness exists (`run_skill_evals.ts`, `skill_trigger_eval.ts`,
> `check_trigger_evals.ts`, `eval_discrimination.ts`, `lint_eval_freshness.ts`),
> but only 2 of 264 skills carry a behavioural `evals.json`. Skill *quality*
> therefore rests on author care, not measurement — the one place the package's
> falsifiability posture does not yet reach its own core artifact. Close the gap
> where it matters first (default-surface + rich-tagged skills), set a coverage
> floor, and ratchet it — never claim "evaluated skills" beyond the measured set.

## Goal

Raise behavioural-eval coverage from 2/264 to a meaningful, tier-prioritised set
with a CI-enforced floor that can only rise, so that the skills users actually
hit on the default surfaces are measured against pass/fail criteria — and so the
uncovered remainder is honestly labeled, not implied-tested.

## Context (measured, do not relitigate)

- Coverage today: 264 skills carry `SKILL.md`; 2 carry `evals.json`
  (grep-verified on a fresh `main`; re-verified unchanged 2026-07-08 @ 8.3.0). `model_tier` / `token_budget_class` keys
  are present on all 264, so a prioritisation axis already exists.
- Harness is built, not the gap: `run_skill_evals.ts` (behavioural),
  `skill_trigger_eval.ts` + `check_trigger_evals.ts` (activation/routing),
  `eval_discrimination.ts`, `run_block_d_eval.ts`, `lint_eval_freshness.ts`.
  Trigger-evals (does the right skill fire) are a DIFFERENT axis from
  behavioural-evals (does the skill produce good output) — this roadmap targets
  the latter; do not conflate the two coverage numbers.
- Prioritisation signal already in the tree: each profile's curated "focused
  five" (`src/agent-src/profiles/`), the `token_budget_class: rich` set
  (deliberately detailed, highest cost, highest blast radius), and analysis
  routers. These are the highest-traffic / highest-cost skills — cover first.
- House lock: no "evaluated" / "measured-quality" wording for skills without a
  resolving eval, mirroring `check_claims.ts` discipline. Uncovered skills are
  labeled uncovered.

## Prerequisites

- [x] Behavioural + trigger eval harness exists.
- [x] Skill tiering keys present on all skills.
- [ ] An agreed pass/fail eval schema for `evals.json` (this roadmap, Phase 1).

## Phase 1 — Lock the eval schema + a coverage metric

- [ ] Ratify the `evals.json` behavioural schema (extend
      `src/scripts/schemas/` ) : per-skill cases with deterministic pass/fail
      (input fixture → asserted output property), no LLM-judge where a
      deterministic check is possible; where a judge is unavoidable, pin it and
      record it as a known-limit with a witness.
- [ ] Add `skill_eval_coverage.ts`: emits covered/total overall AND per tier
      (`rich`, default-surface, other). Wire it into `discovery_stats` output so
      the number is a first-class, reportable fact.
- [ ] Publish the current coverage (2/264) on the proof page as an honest
      baseline — the gap is stated, not hidden.

**Exit:** schema locked; coverage metric emits per-tier; baseline published.
**Rollback:** none — schema + reporting only.

## Phase 2 — Cover the highest-traffic / highest-cost skills first

- [ ] Author behavioural `evals.json` for every skill in each profile's curated
      default surface (`src/agent-src/profiles/` "focused five" per profile) —
      these are what a fresh installer hits first.
- [ ] Author evals for the `token_budget_class: rich` set — highest token cost,
      so highest obligation to prove the length earns its keep (ties to
      `token-budget-discipline`: a rich skill that cannot pass an eval is a
      budget claim without a backing).
- [ ] Author evals for the analysis/command routers (`analysis-skill-router`,
      `command-routing`) — a mis-routing skill poisons everything downstream.

**Exit:** default-surface + rich + router skills carry passing behavioural evals;
per-tier coverage numbers updated on the proof page.
**Rollback:** none — additive test assets.

## Phase 3 — Ratchet: a floor that only rises

- [ ] Add a CI gate: overall behavioural coverage may not DECREASE, and the
      default-surface + rich tiers must stay at 100%. New skills in those tiers
      ship with an eval or fail the gate (mirror `lint_eval_freshness.ts`).
- [ ] Add a per-PR check: a modified skill with an existing eval must keep it
      green; a modified rich/default skill without an eval fails.
- [ ] Extend `lint_eval_freshness.ts` (or a sibling) so an eval that no longer
      exercises the current skill body is flagged stale, not silently passing.

**Exit:** coverage cannot regress; the two priority tiers are gated at 100%;
staleness is caught.
**Rollback:** relax the gate to warn-only (one config line) if it blocks urgent
work — but the ratchet is the point; prefer authoring the eval.

## Phase 4 — Honest disposition of the long tail

- [ ] The remaining lower-traffic skills: either schedule evals by usage/tier or
      explicitly label them "not behaviourally evaluated" in the catalog — no
      skill is implied-tested. A large uncovered tail is acceptable IF it is
      stated; an uncovered tail sold as "264 skills" is not.
- [ ] Add a CLAIMS entry scoped to the measured set: "behavioural evals cover
      the default-surface + rich tiers (N/M), CI-ratcheted" — never "264 skills
      evaluated".

**Exit:** every skill is either covered or labeled uncovered; the public claim
matches the measured set exactly.
**Rollback:** none — labeling + claim scoping only.

## Acceptance criteria

- `skill_eval_coverage.ts` reports overall + per-tier coverage; the number is on
  the proof page.
- Default-surface + `rich` + router skills carry passing behavioural evals,
  gated at 100% and ratcheted.
- No public prose implies eval coverage beyond the measured set; the uncovered
  tail is labeled, not hidden.
- A modified priority-tier skill cannot merge without a green eval.

## Blockers

### blocker: eval-authoring-throughput
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 (bulk authoring)
- **What to do:** authoring N behavioural evals is the real cost. Use the
  package's own `skill-creator` / eval-scaffold tooling to draft cases, but each
  case's pass/fail assertion needs human ratification — a generated eval that
  asserts the wrong property is worse than none.
- **Resolved when:** the default-surface + rich tiers reach 100% passing
  coverage.
