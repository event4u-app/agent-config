---
complexity: lightweight
status: ready
execution:
  mode: autonomous
parent_roadmap: road-to-feedback-9-29
---

# Road to carrier-layer convergence — 109 rules arrive twice, none identical

> The delivered-payload measurement found 109 rules present in BOTH carrier
> layers with **zero byte-identical duplicates — all 109 divergent**. That is two
> defects wearing one number: the largest immediately-removable share of the
> standing-delivery floor, and a correctness hole, because when two copies of a
> rule differ there is no defined answer to which text binds.

> Source: the loaded-token measurement in
> [`agents/evidence/analysis/loaded-rule-token-distribution.md`](../evidence/analysis/loaded-rule-token-distribution.md),
> produced by the parent roadmap and deliberately routed out of its blockers:
> the parent treated it as evidence-deciding-nothing, which is right for a diet
> verdict and wrong for a delivery defect.

## Goal

Converge the two rule-carrier layers so a session receives each governed rule
exactly once, with a defined binding text — measured as: overlap count 0 (or a
stated, reasoned remainder), `check_standing_rule_delivery` under its cap on a
maintainer machine, and no obligation lost in the process.

## Prerequisites

- [x] The divergence is measured, not assumed (109 shared / 0 duplicate / 109
      divergent, two instruments, recorded with their proxies)

## Context

- **Suppression alone is unsafe here, and the doctor already says so.** The
  `install --layer` path suppresses one layer without deleting it — correct for
  byte-identical copies, wrong for divergent ones: suppressing a copy drops
  whatever obligations only that copy carried. The savings line carries this
  caveat for exactly this reason.
- So the order is **converge, then deduplicate**. The global layer is a release
  snapshot; the project layer is generated from `src/` at the current commit and
  wins on precedence. A refresh makes the copies identical; only then is
  suppression a no-op on content.
- The 109 is not a token-diet line item. It is the answer to "which text binds
  when two differ", which is the question behind every report of an instruction
  being followed inconsistently.

## Phase 1 — Establish which layer is stale, per rule

- [ ] For each of the 109 divergent rules, classify the divergence: the global
      copy is an older release of the same rule (refresh closes it), the project
      copy is generated differently (the generator is the fix), or the two carry
      genuinely different obligations (a content decision, and the interesting
      case). Report counts per class — a single mixed bucket is not a finding. <!-- verify: report lists all 109 with a class and the per-class totals -->
- [ ] Name the precedence rule the host actually applies when both layers carry
      a rule of the same basename, from the host's own documentation or an
      observed load, never from inference — if it is unobservable, say so and
      treat every divergence as binding-undefined. <!-- verify: the precedence answer cites a doc section or an InstructionsLoaded observation -->

Exit criteria: every one of the 109 carries a class; the precedence question has
a cited answer or an explicit unobservable verdict.
Rollback: report-only phase, nothing to revert.

## Phase 2 — Converge

- [ ] Refresh the stale side for every rule in the refresh-closes-it class, so
      the two copies become byte-identical. <!-- verify: report_carrier_divergence shows those rules as duplicate rather than divergent -->
- [ ] For the generator-difference class, fix the generator so the projection is
      reproducible rather than patching the output. <!-- verify: task sync + generate-tools leaves no drift for those rules -->
- [ ] For any genuinely-different-obligation rule, surface it as a decision
      rather than picking a side — this is the class where a silent choice loses
      a governed obligation. <!-- verify: each such rule is listed with both texts and no edit applied -->

Exit criteria: `report_carrier_divergence` reports 0 divergent, or a stated
remainder whose every member is a surfaced decision.
Rollback: the refresh is regeneration from tracked sources, so revert is
regeneration at the previous commit.

## Phase 3 — Deduplicate, and prove the saving

- [ ] With the layers converged, apply the single-layer suppression and record
      the delivered-token reading before and after on the same machine and the
      same commit. <!-- verify: check_standing_rule_delivery under cap, with the before/after pair recorded -->
- [ ] Re-measure `report_carrier_divergence` afterwards to confirm suppression
      removed a duplicate rather than an obligation. <!-- verify: rule count per layer unchanged in content terms; no rule absent from the surviving layer -->

Exit criteria: the gate is green on the maintainer machine with both readings
recorded at a named commit.
Rollback: `install --layer` is suppression, not deletion — re-enabling the
suppressed layer restores the prior state.

## Blockers

### blocker: b-convergence-machine
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 only (Phases 1-2 are repo work)
- **What to do:** Phase 3's before/after pair needs the maintainer machine,
  since the two-layer topology is a property of the install rather than of the
  repo. Run the reading, apply `install --layer`, run it again.
- **Resolved when:** both readings exist at a named commit.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Suppressing before converging | implementation | Suppressing a divergent copy drops whatever obligations only that copy carried — a silent loss of governed text, which is worse than the duplication it removes | The phase order IS the mitigation: Phase 3 is gated on Phase 2's zero-divergent exit, and the doctor's own savings line already carries the refresh caveat | Phase 3 — Deduplicate, and prove the saving |
| 2 | A genuinely-different obligation resolved by picking the newer copy | product | The interesting class is exactly where two texts disagree on what is required; choosing silently is a governance decision made by whoever ran the script | That class is surface-only by construction — the step forbids an edit and requires both texts side by side | Phase 2 — Converge |
| 3 | The precedence answer is inferred rather than observed | implementation | The whole plan rests on which copy binds; an inferred answer would make every later step rest on a guess | Phase 1 step 2 requires a cited doc section or an observed load, and admits "unobservable" as a legal verdict that reclassifies all 109 as binding-undefined | Phase 1 — Establish which layer is stale, per rule |
| 4 | The before/after pair measured across a moving tree | implementation | The project carrier is generated from `src/`, so two readings at different commits differ for reasons unrelated to deduplication and would read as a saving that is not one | Same machine, same commit, both readings recorded — the pin-your-SHA lesson the parent roadmap's own report had to learn twice | Phase 3 — Deduplicate, and prove the saving |
| 5 | Convergence closes, then re-opens on the next release | product | The global layer is a release snapshot; refreshing it today says nothing about the next one, so the 109 could simply return | Out of scope here and named rather than hidden: a standing fix belongs to the install/release path, and this roadmap's exit criteria are point-in-time by design | Acceptance criteria |

## Acceptance criteria

- All 109 divergent rules are classified, with per-class totals.
- Divergence reaches 0, or every remaining member is a surfaced decision.
- The delivered-token before/after pair is recorded at one commit on one machine.
- No rule present before convergence is absent after deduplication.
