# Early stop vs. fixed rounds — promotion gate (pre-registration)

Registered 2026-08-31 · owner: maintainer ·
`road-to-inbox-harvest-2026-08-e-council-topology-evidence` step **6.5**
("Pre-registered promotion gate against a fixed-round arm").

**This record is written before either arm has run, and that is the point.**
Neither arm can run today: `evaluateStop`
(`src/scripts/ai_council/argument_exhaustion.ts:82`) has **zero production
callers**, so no council round has ever stopped early, and the benchmark runner
Phase 2 would dispatch through does not exist — `blocker:
phase-2-benchmark-cost` records that `topology_bench_manifest.ts` `main()` only
`--emit`s JSON and contains no provider dispatch. Nothing here can have been
fitted to a result; the ordering is checkable in the git history rather than
asserted.

Scope: this file fixes **what the early-stop mechanism must clear before it is
enabled by default on any slice**. It does not fix the metric definitions (step
2.3), the eligible families (step 2.1), or the reporting statistics — those are
step 2.6's pre-registration
(`council-topology-promotion-stats-PREREG.md`), which this record **inherits
rather than restates**: trial-count floors, band requirement, paired
non-parametric tests and the attrition-asymmetry field all apply here unchanged.

## The arms

| Arm | Definition |
|---|---|
| **fixed** | Today's behaviour: every configured round executes. This is the control and its behaviour is not modified for the comparison. |
| **early-stop** | Identical configuration, with `evaluateStop` wired to end the run when all four of 6.2's conjuncts hold. |

Matched over the same artefacts, same seeds, same member set. An unmatched
comparison is inadmissible for the reason § Statistics of the stats
pre-registration already gives.

## The gate

```
ALL FOUR CONDITIONS MUST HOLD. THEY ARE CONJUNCTIVE, NOT A SCORE.
FAILING ONE IS FAILING THE GATE, WHATEVER THE OTHER THREE SHOW.
VERDICT EQUIVALENCE IS NOT ONE OF THEM AND NEVER SUBSTITUTES FOR ONE.
```

| # | Condition | How it is decided |
|---|---|---|
| 1 | **Quality non-inferiority on gradeable slices** | On slices with a deterministic oracle or a rubric score, the early-stop arm's quality does not regress. Decided by a one-sided non-inferiority test against a pre-declared margin (below), never by "the means look close". Non-gradeable slices are excluded from this condition and reported separately — an ungradeable slice is not a passing one. |
| 2 | **No meaningful minority-rescue regression** | Rate at which a correct minority position survives into the final synthesis, measured with the step-5.3 gate (`auditMinorityRetention` over `internal/bench/council-synthesis/majority-laundering.json` and its successors). Early stop must not cut the round in which a minority is rescued. |
| 3 | **Measurable call/cost reduction** | Calls saved and USD saved, reported **separately from quality** per step 10.6 — never as one blended number. A reduction whose band spans zero is not a reduction. |
| 4 | **No increased majority-corruption rate** | Rate at which the final synthesis adopts a plausible-but-wrong majority position. Same fixture family as condition 2, opposite label. This is the conformity-collapse failure 6.1's anti-conformity ordering exists to prevent, and stopping early is precisely the move that could reintroduce it. |

## Verdict equivalence is CONTEXT, never the gate

```
VERDICT EQUIVALENCE IS REPORTED AS CONTEXT AND MAY NEVER BE CITED AS
EVIDENCE THAT THE GATE PASSED. TWO WRONG VERDICTS CAN BE EQUIVALENT.
A ROUND THAT REPORTS EQUIVALENCE AND OMITS CONDITIONS 1-4 HAS REPORTED
NOTHING ABOUT PROMOTION.
```

Step 6.5 states the reason in one line — *"two wrong verdicts can be
equivalent"* — and it is the whole argument. If both arms reach the same wrong
answer, equivalence is 100 % and the mechanism has been proven to preserve a
failure rather than a capability. The figure is still worth reporting: a **low**
equivalence rate is a strong signal that something material changed and is worth
investigating. It is diagnostic, in one direction only, and the report says so
next to the number.

Rendering requirement: the equivalence figure appears in a section headed
`Context (not gate evidence)`, physically separated from the four conditions,
with the sentence *"Verdict equivalence is not a promotion condition; two wrong
verdicts can be equivalent"* adjacent to it.

## Declared margins and floors

Stated defaults, not derived optima, and declared here so they cannot be tuned
to a result later.

| Quantity | Value | Note |
|---|---|---|
| Quality non-inferiority margin (condition 1) | **2 % absolute** on the slice's own 0-1 quality scale | A margin, not a tolerance for a regression that is "small enough" — a point estimate below the control still fails if the band clears the margin. |
| Minority-rescue regression ceiling (condition 2) | **0 percentage points**, i.e. any statistically supported drop fails | Condition 2 protects the one capability early stop most plausibly destroys, so it carries no slack. |
| Minimum call reduction (condition 3) | **≥ 10 %** of the fixed arm's calls, band excluding zero | Below this the mechanism is not worth the risk surface it adds. |
| Majority-corruption ceiling (condition 4) | **0 percentage points** increase | Same reasoning as condition 2. |
| Trial-count floors | Inherited from `council-topology-promotion-stats-PREREG.md` § Minimum trial counts | n ≥ 5 deterministic, n ≥ 10 rubric-judged, n ≥ 5 cost/latency, per arm. |

*Revisit-if:* a completed arm shows the rerun-variance figure makes the 2 %
margin or the 10 % reduction floor unmeasurable at the declared trial counts —
in which case the numbers move **before** the next promotion round, never
during one, and the move is recorded here with its reason.

## Slice scope — promotion is per slice, never global

A pass promotes early stop **for the task family it was measured on**, matching
step 7.6's per-slice rule and step 13.3's holdout requirement. A family with no
gradeable oracle cannot clear condition 1 and therefore cannot be promoted, which
is the correct outcome rather than a gap: an ungradeable family is one where
nobody can tell whether stopping early cost anything.

## Failure modes this gate exists to stop

- **Equivalence laundering.** Reporting "97 % of verdicts matched" as the
  result. It is the one figure that is cheap to produce and says least, which is
  exactly why 6.5 names it and excludes it.
- **Blending cost into quality.** A single "efficiency" score that improves
  because calls fell. Condition 3 is reported separately per step 10.6, and the
  10.6 shape gate is what keeps the reporting surface honest.
- **The averaged minority.** Minority-rescue rate falling on hard slices and
  rising on easy ones, netting to zero. Condition 2 is evaluated per slice, not
  pooled.
- **Promoting on the cheap half.** Clearing conditions 3 and 4 (both easy for a
  mechanism that simply does less) and treating 1 and 2 as aspirational. The
  conditions are conjunctive and the Iron Law above says so first.
- **Retro-fitting the margin.** Seeing a 1.8 % quality drop and declaring the
  margin to be 2 %. The margin is registered here, before either arm exists.
