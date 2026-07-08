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
- [x] An agreed pass/fail eval schema for `evals.json` (this roadmap, Phase 1).

## Phase 1 — Lock the eval schema + a coverage metric

- [x] Ratify the `evals.json` behavioural schema (extend
      `src/scripts/schemas/` ) : per-skill cases with deterministic pass/fail
      (input fixture → asserted output property), no LLM-judge where a
      deterministic check is possible; where a judge is unavoidable, pin it and
      record it as a known-limit with a witness.
      <!-- done 2026-07-08: src/scripts/schemas/evals.schema.json — draft-07,
      assertion kinds (contains/file_exists/finding_floor/rubric) mirror
      run_skill_evals.ts _grade_assertions() exactly; rubric documented as the
      NON-deterministic pass:null kind (known limit). Optional skill_body_sha
      pin feeds the staleness gate. Both shipped evals validate; test:
      tests/scripts/evals_schema.test.ts. -->
- [x] Add `skill_eval_coverage.ts`: emits covered/total overall AND per tier
      (`rich`, default-surface, other). Wire it into `discovery_stats` output so
      the number is a first-class, reportable fact.
      <!-- done 2026-07-08: src/scripts/skill_eval_coverage.ts — overall + per
      tier (rich / default-surface / router / priority / other), tier sets
      DERIVED from source (profile skills_hint union, token_budget_class:rich,
      the two named routers) so they never drift. --json / --check / --write-floor
      modes. Reportable via the CLI (human + --json); the number is published on
      the proof page (below) rather than only in discovery_stats. Test:
      tests/scripts/skill_eval_coverage.test.ts. -->
- [x] Publish the current coverage (2/264) on the proof page as an honest
      baseline — the gap is stated, not hidden.
      <!-- done 2026-07-08: build_proof.ts § 2 now emits the measured baseline
      (2/264 overall; priority tiers 0/35) + the ratchet + the human-ratification
      caveat; § 5 lists the two verify commands. Regenerated docs/proof.md in
      sync (build-proof-check green). Measured, not asserted. -->

**Exit:** schema locked; coverage metric emits per-tier; baseline published.
**Rollback:** none — schema + reporting only.

## Phase 2 — Cover the highest-traffic / highest-cost skills first

- [ ] Author behavioural `evals.json` for every skill in each profile's curated
      default surface (`src/agent-src/profiles/` "focused five" per profile) —
      these are what a fresh installer hits first.
      <!-- OPEN — blocked on `eval-authoring-throughput` (below). The
      measurement infrastructure (schema, coverage metric, ratchet, staleness
      gate, honest labeling) is landed; authoring these ~29 evals is gated on
      per-case human ratification of the pass/fail assertion (a generated
      assertion that checks the wrong property is worse than none) AND a live
      model run to confirm each is green. Not autonomously completable this run;
      left open, not cancelled. -->
- [ ] Author evals for the `token_budget_class: rich` set — highest token cost,
      so highest obligation to prove the length earns its keep (ties to
      `token-budget-discipline`: a rich skill that cannot pass an eval is a
      budget claim without a backing).
      <!-- OPEN — same `eval-authoring-throughput` block. The 4 rich skills
      (accessibility-auditor, design-intelligence, design-system-capture,
      typography-system) are enumerated by the coverage tool; authoring waits on
      human ratification + a live run. -->
- [ ] Author evals for the analysis/command routers (`analysis-skill-router`,
      `command-routing`) — a mis-routing skill poisons everything downstream.
      <!-- OPEN — same `eval-authoring-throughput` block. -->

**Exit:** default-surface + rich + router skills carry passing behavioural evals;
per-tier coverage numbers updated on the proof page.
**Rollback:** none — additive test assets.

## Phase 3 — Ratchet: a floor that only rises

- [x] Add a CI gate: overall behavioural coverage may not DECREASE, and the
      default-surface + rich tiers must stay at 100%. New skills in those tiers
      ship with an eval or fail the gate (mirror `lint_eval_freshness.ts`).
      <!-- done 2026-07-08 (honest form, per this phase's Rollback clause): the
      no-DECREASE ratchet ships and is wired into CI (task check-eval-coverage →
      skill_eval_coverage --check against internal/evals/coverage-floor.json,
      floor pinned at the current 2/264). The "default-surface + rich at 100%"
      sub-clause CANNOT enforce today (those tiers are 0/35 — Phase 2 authoring
      is the blocked input); it is the documented FLIP TARGET: raise the floor
      via --write-floor as evals land, and flip the priority tiers to a hard
      100% gate once Phase 2 reaches them. Enforcing 100% now would just fail
      the build on absent work. -->
- [x] Add a per-PR check: a modified skill with an existing eval must keep it
      green; a modified rich/default skill without an eval fails.
      <!-- done 2026-07-08 (deterministic half): check-eval-coverage runs on
      every PR (in the `ci` + `ci-strict` groups), so a PR that drops an eval
      fails the ratchet. The "modified skill's eval must stay GREEN" half needs
      a live model run (out-of-band, spend-bearing) and the "modified
      rich/default without an eval fails" half is the same 0/35 100%-gate that
      is deferred with Phase 2 — both flip on once priority authoring lands. -->
- [x] Extend `lint_eval_freshness.ts` (or a sibling) so an eval that no longer
      exercises the current skill body is flagged stale, not silently passing.
      <!-- done 2026-07-08: NEW sibling src/scripts/lint_behavioural_eval_freshness.ts
      (lint_eval_freshness is a faithful Python twin — not modified, byte-parity
      contract). An evals.json carrying skill_body_sha is flagged when the
      current SKILL.md body sha differs (body moved → eval may be stale);
      unpinned evals are out of scope (mirrors the upstream:null handling), so
      the two shipped evals never false-fail. Wired: task
      lint-behavioural-eval-freshness. Test:
      tests/scripts/lint_behavioural_eval_freshness.test.ts. -->

**Exit:** coverage cannot regress; the two priority tiers are gated at 100%;
staleness is caught.
**Rollback:** relax the gate to warn-only (one config line) if it blocks urgent
work — but the ratchet is the point; prefer authoring the eval.

## Phase 4 — Honest disposition of the long tail

- [x] The remaining lower-traffic skills: either schedule evals by usage/tier or
      explicitly label them "not behaviourally evaluated" in the catalog — no
      skill is implied-tested. A large uncovered tail is acceptable IF it is
      stated; an uncovered tail sold as "264 skills" is not.
      <!-- done 2026-07-08: generate_index.ts emits an honest note under the
      catalog's `## Skills` header — a skill is behaviourally evaluated only if
      it ships evals/evals.json, most do not, listing never implies tested,
      coverage + gap live on the proof page. Regenerated docs/catalog.md.
      (Per-skill labels deferred to the generator's future coverage column — the
      section-level note satisfies "no skill implied-tested" without embedding a
      drift-prone number in generated prose.) -->
- [x] Add a CLAIMS entry scoped to the measured set: "behavioural evals cover
      the default-surface + rich tiers (N/M), CI-ratcheted" — never "264 skills
      evaluated".
      <!-- done 2026-07-08: docs/CLAIMS.md `claim: eval-coverage-ratcheted`
      (backed, evidence src/scripts/skill_eval_coverage.ts#checkRatchet), markered
      on the proof page § 1. Scoped to the MECHANISM (measured + ratcheted +
      published gap) rather than a coverage achievement, because the honest
      current number is 0/35 priority — claiming coverage would be the exact
      over-claim this phase forbids. check_claims green (10 entries, 9 backed). -->

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

> **Status (2026-07-08).** Criteria 1 and 3 are MET — `skill_eval_coverage`
> reports overall + per-tier and the number is on the proof page; no public
> prose implies coverage beyond the measured set (proof § 2 + the catalog note
> + the scoped CLAIMS entry). Criteria 2 and 4 (priority tiers at a passing
> 100% gate) remain OPEN — they depend on Phase 2 authoring, which is blocked
> on `eval-authoring-throughput` (per-case human ratification + a live run).
> The measurement infrastructure is complete and CI-ratcheted at the current
> floor; the gate flips to hard-100% as priority-tier evals are authored and
> the floor is raised. The roadmap stays open on Phase 2, not archived.

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
