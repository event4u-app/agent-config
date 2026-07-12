# Council-vs-solo baseline eval — design (pre-registered)

> Design artifact for `road-to-feedback-8.11` Phase 3. It fixes the
> methodology **before** the first billable call; the run itself is
> spend-gated (blocker `council-baseline-spend-authorization` — the user
> confirms the rendered estimate in-session). This document is the "design
> the baseline" step — not the run. Companion claim:
> `docs/CLAIMS.md § council-vs-solo-baseline` (status: unbacked until the run
> resolves).

## Why this exists

The council deliberation protocol (stance tally, chairman, debate gates,
anti-conformity) is well-built and default-off — but there is **no evidence
that convening the council beats a single strong model** on any decision
class. The 2026-07-12 feedback-disposition debate (claude-sonnet-4-5 +
gpt-4o) REJECTED adding a ≥2-of-5 admission gate for exactly this reason and
ADOPTED this baseline as the precondition for ANY further
deliberation-protocol expansion: admission criteria must be derived from
empirical decision characteristics, not a-priori heuristics.

Shadow-log status at design time (2026-07-12): `agents/runtime/council/
shadow-log.jsonl` is **absent/empty** on both the main checkout and the run
worktree — the shadow-dispatch agreement mechanism has produced zero
analyzable lines. That absence is itself the first finding: the only
council-vs-solo signal the package planned to collect has no data, so a
deliberate baseline run is the only path to a verdict.

## Arms

| Arm | What runs | Cost profile |
|---|---|---|
| A — solo | ONE strong model (the council's strongest configured member, single call, standard prompt) | 1 call/decision |
| B — council | The full configured council in `debate` mode (2 members × ≤2 rounds, current defaults; stance tally ON so dissent is recorded) | 4–5 calls/decision |

Same decision text, same context budget, both arms blind to each other.

## Corpus — ≥30 real decisions

- Source: real decision questions from the repo's own history — the
  council-labelled golden set (labels final per the 2026-07-11 amendment; no
  re-labelling) plus archived council question files whose ground-truth
  disposition is now KNOWN (the decision shipped and survived, was reverted,
  or was killed by later evidence). Minimum n = 30; pre-register the exact
  list in the run manifest BEFORE the first call.
- Class mix: at least 8 decisions per impact class {low, medium, high} so the
  per-class analysis (the whole point — which characteristics correlate with
  council lift) is not vacuous.

## Metrics — fixed before data

1. **Quality**: blind post-hoc grading of both arms' verdicts against the
   known ground-truth disposition — primary judge = strongest available
   model, blind second judge, report Cohen's κ (reuse `cohensKappa()` /
   `judgeKappa()` from `src/scripts/check_quality_regression.ts`); verdict
   admissible only at κ ≥ 0.60.
2. **Cost**: tokens + USD (from the council cost ledger) + wall-clock per
   decision, per arm.
3. **Characteristics capture**: per decision, record the five feedback-
   proposed dimensions (reversibility cost, material spend/risk,
   multi-perspective conflict, evidence tension, policy/governance change) as
   booleans AT PRE-REGISTRATION TIME (not after results) — so the ≥2-of-5
   hypothesis is testable as a POST-HOc correlate without having gated
   anything.

## Kill criterion (falsifiable, from the 2026-07-12 debate)

- **No lift anywhere**: if council decisions show no identifiable quality
  lift on ANY decision subset (overall AND per impact class AND per
  dimension-count stratum), further deliberation-protocol phases STOP and
  the protocol goes maintenance-only; `road-to-opt-council-deliberation`
  records the honest null.
- **Lift on a subset**: derive empirical admission criteria FROM that
  subset's recorded characteristics (which may or may not match the ≥2-of-5
  heuristic — the data decides), and only then design an admission gate.
- **Judge floor**: κ < 0.60 → record κ, withhold the win-rate, do not claim
  either direction.

## Spend gate

Execution requires in-session user confirmation of the rendered estimate
(existing council estimate machinery; ~30 decisions × (1 + ~4.5) calls —
estimate rendered by `council estimate` at run time). Authoring the corpus
manifest and this design is unblocked and free.

## Non-goals

- Not a cross-provider capability comparison (both arms use the configured
  members; provider identity is held constant per arm definition).
- Not a re-test of the deliberation features individually (stance tally,
  chairman) — arm B runs the current default debate shape; feature ablations
  are follow-ups only if B beats A at all.
