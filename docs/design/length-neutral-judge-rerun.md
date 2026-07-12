# Length-neutral judge rerun — design

> Design artifact for `road-to-opt-measurement-unblock` Phase 1. It fixes the
> methodology **before** the first billable call; the run itself is a maintainer
> `/dev/tty`-gated, money-moving execution (disclose the estimate, confirm the
> budget in-session, then run). This document is the "design the rerun" step —
> not the run.

## Why a rerun

The 2026-07-09 discipline-lift judge run was **inconclusive** and now gates ~40%
of the active token-program portfolio. Three recorded failure modes made it
un-trustworthy; each has a concrete fix below. Nothing ships from the prior run —
its verdict is void, not "weakly positive".

| # | Failure mode (2026-07-09) | Magnitude | Fix in this design |
|---|---|---|---|
| a | **Length confound** — the preferred arm was systematically longer, so the judge rewarded length, not discipline | 69% of variance | Length-matched pairs **and** a length-partialed rubric (both, belt-and-braces) |
| b | **Judge inconsistency** — a single judge disagreed with itself / a second grader | 33% inconsistency | Stronger judge tier + a blind second judge, reported as Cohen's κ |
| c | **Underpowered comparison** | p = 0.196 (n too small) | Pre-registered sample size from the golden corpus, fixed before the first call |

## (a) Length confound — neutralise it two ways

1. **Length-matched pairing.** For each decision task, constrain the two arms
   (vanilla vs `essential` discipline) to within a **±15% token band** of each
   other before judging. Pairs that cannot be matched within the band are
   dropped from the primary analysis and reported separately (never silently
   discarded). This removes length as a *between-arm* signal.
2. **Length-partialed rubric.** The judge prompt scores **task quality only** and
   is explicitly instructed that response length is **not** a quality signal;
   the harness additionally records each response's token count and runs the
   verdict through a length-partialed check — if the win-rate correlates with the
   length delta (Spearman ρ over the surviving pairs), the run is flagged
   `length-confounded` and the verdict is withheld, exactly as the exit criterion
   demands ("no length confound flag").

Both, not either: matching removes the gross effect, partialing catches residual
leakage the band still admits.

## (b) Judge inconsistency — stronger tier + a second judge, reported as κ

- **Judge tier.** Use the strongest available judge model for the primary grade
  (not the cheapest); the grading cost is a fraction of the generation cost and
  judge quality is the binding constraint here.
- **Blind second judge + Cohen's κ — reuse, do not rebuild.** The second-judge
  agreement machinery already exists: `cohensKappa()` + `judgeKappa()` in
  [`src/scripts/check_quality_regression.ts`](../../src/scripts/check_quality_regression.ts)
  align two judges' per-pair winner labels by task id and return chance-corrected
  κ. Run both judges **blind to arm labels** and to each other; report κ
  **alongside every verdict**.
- **κ floor.** The verdict is admissible only when **κ ≥ 0.60** (substantial
  agreement). Below the floor, the win-rate rests on an unreliable grader — record
  the κ, do **not** report the win-rate as a finding, and stop (see disposition).

## (c) Underpowered — pre-register the sample size

- **Corpus.** Draw decision tasks from the council-labelled golden set landed by
  PR #885 (labels are final per the 2026-07-11 amendment — **no re-labelling**).
- **Power target.** Pre-register n for **80% power** at the smallest
  effect worth shipping (target: detect a **≥ 10pp** win-rate difference from 50%
  at α = 0.05). Fix n **before** the first billable call; do not grow n after
  seeing results (that is the p-hacking the prior run's `p = 0.196` invites).
- **Statistic.** Paired win/loss over matched pairs → the exact binomial
  sign-test (`signTestP` already in `second_brain_retrieval.ts`) or McNemar
  (`bench_ab_v2_stats.ts`); report the two-sided p and the effect size, never a
  bare "significant".

## Report schema (verdict artifact)

Written under `internal/bench/reports/` with, inline and non-optional:

- per-arm win/loss/tie counts over the **surviving matched pairs** (+ the dropped-pair count);
- **κ** (both judges) and the κ floor used;
- the length-confound diagnostic (Spearman ρ of win-rate vs length delta) and the
  pass/`length-confounded` flag;
- pre-registered n, achieved power, and the sign-test / McNemar p + effect size;
- a one-line **verdict**: `ships-lift` / `honest-null` / `inconclusive-<reason>`.

## Disposition (Phase 1 step 4)

- **Trustworthy verdict, either direction** (κ ≥ floor, no length flag, powered):
  update the token-program tracking table in `road-to-token-proof-and-story.md`
  and unblock/close the dependent gates.
- **Second inconclusive:** record *why* with the diagnostics above and **stop** —
  no third run without a further design change. The anti-pattern this roadmap
  kills is "gate pending" with no diagnosis.

## What this design does NOT decide

The **execution** — the cost estimate, the in-session budget confirmation, and the
paid paired run — is the maintainer's, disclosed and confirmed per the acceptance
criteria. This document only makes the run, when authorized, trustworthy.
