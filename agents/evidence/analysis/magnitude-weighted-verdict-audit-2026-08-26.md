---
type: analysis
---

# Magnitude-weighted verdict audit — every scored path, 2026-08-26

> `road-to-skill-ecosystem-eval-integrity` Phase 2 Step 1: record the list
> BEFORE changing anything, so every affected prior result is named and a
> verdict that flips is a finding rather than a quiet restatement. Risk-register
> item 1 of that roadmap is exactly this obligation.

## Method

Every path in `src/scripts/` and `internal/` reaching a paired statistical
verdict, found by searching for the four test families this tree uses
(`wilcoxon`, `mcnemar`, `binomial`, `sign_test`) and reading each call site.
Classified by what DECIDES the verdict, not by what the report prints.

## The list

| # | Path | Test that decides | Magnitude-weighted? | Disposition |
|---|---|---|---|---|
| 1 | `_lib/bench_ab_size_claim.evaluateSizeClaim` — T1 added lines | **was** Wilcoxon signed-rank | **YES** | **CHANGED.** Exact one-sided sign test over non-tied pairs; the −10 % median bar stays independently binding. PREREG amendment v2. |
| 2 | `_lib/bench_ab_size_claim.evaluateSizeClaim` — T2 complexity (anti-golfing) | **was** Wilcoxon signed-rank | **YES** | **CHANGED**, with an asymmetry: the refusal fires on either signal so it cannot vanish on a report lacking direction counts. |
| 3 | `bench_ab_v2_stats` — capability axis | McNemar exact (binomial over discordant pairs) | no | unchanged; already the correct shape. Two-sided, which is a stricter bar than the claim needs — recorded, not changed. |
| 4 | `bench_ab_v2_stats` — discipline axis | Wilcoxon signed-rank | yes | **reported only.** No verdict reads `discipline.wilcoxon_p`; `gate_verdict` is an L4 exploratory OR across axes, not a claim. Left as triage. |
| 5 | `_lib/bench_ab_search_adherence` — T5 | Wilcoxon signed-rank | yes | **reported only**; the T5 verdict is rubric-judged and its own endpoint is absent on every existing report. |
| 6 | `bench_quality_rerun` | sign test | no | already directional. |
| 7 | `second_brain_retrieval`, `second_brain_run` | binomial | no | already directional. |
| 8 | `check_quality_regression` | Wilcoxon signed-rank | yes | **reported only** — the gate's decision is a threshold on a measured rate, not on the p. |
| 9 | `render_benchmark_composite` | renders `mcnemar_p` / `wilcoxon_p` | n/a | a renderer; decides nothing. |

**Two binding paths were magnitude-weighted; both are changed. Four further
paths compute a magnitude-weighted p and none of them decides a verdict** —
each is retained for triage, which is what Phase 2 Step 3 asks for, and the size
claim's own reason string now says "decides nothing" in as many words.

## What flipped

**Nothing, and the reason is worth stating rather than reading as luck.**
`internal/bench/reports/ab-v2/` is EMPTY: the Phase-3 run has never produced a
report, and the pre-registration itself records that preconditions 2–4 make the
run impossible today. So there is no recorded result to re-evaluate and no
locked conclusion resting on one. That is why this amendment could be made at
zero cost, and why making it later would not have been.

## The honest limit of this audit

It found what it searched for. A magnitude-weighted decision expressed without
any of the four test names — a raw mean compared against a threshold, say —
would not appear above. `passRate()` in `_lib/paired_verdict.ts` is the
structural half of the answer: it is exported as the only sanctioned way to
compute a pass rate precisely because an inline
`filter(v => v.kind === 'pass').length / all.length` reinstates the
underpowered-in-the-denominator defect without touching any of these paths.
