---
stability: beta
keep-beta-until: 2026-08-14
---

# Condensation default — kill-criterion

> **Status:** v1-measured · criterion not met · default stays `off` · **Owner:** `step-16-telegraph-substance.md`
> Phase 1 closeout · **Sources:** [`internal/bench/reports/telegraph-v1.md`](../../bench/reports/telegraph-v1.md) ·
> [`council-synthesis.md` § 7](../../agents/evidence/audits/2026-05-14-north-star/council-synthesis.md) <!-- council-ref-allowed: ADR decision trace for v1 kill-criterion verdict --> ·
> [`telegraph-v1-kc-verdict.json`](../../agents/runtime/council/responses/telegraph-v1-kc-verdict.json) <!-- council-ref-allowed: ADR decision trace for v1 kill-criterion verdict -->

## Rule

```
DEFAULT STAYS OFF UNTIL `task bench -- --telegraph` PRODUCES A POSITIVE vs_terse MEDIAN.
DECISION OWNED BY THE NEXT BENCH CLOSEOUT, NOT BY THIS DOC.
```

1. **Current state.** `telegraph.speak_scope` defaults `off`. Carve-outs
   (security · destructive · multi-step · code blocks · paths · numbered
   options · Iron-Law markers) are documented in
   [`telegraph-speak`](../../.agent-src.uncondensed/rules/telegraph-speak.md)
   but the feature is non-promoted: no skill recommends turning it on,
   no preset enables it, no profile depends on it.
2. **Baselines.** Every published `internal/bench/reports/telegraph-v<N>.{json,md}`
   measures three arms (`condensed` · `terse-control` ·
   `uncondensed`) and reports two savings columns:
   - `vs_raw` — median savings against the uncondensed arm.
   - `vs_terse` — **load-bearing** median savings against the
     `Answer concisely.` terse-control arm. `vs_raw` is inflated by the
     carve-out-tax-free pure-prose case and is **not** the gate metric.
3. **Decision table.** Read the latest `internal/bench/reports/telegraph-v<N>.md`
   and apply exactly one of:

   | Measured `vs_terse` median | Quality regression on corpus | Verdict |
   |---|---|---|
   | < 0 % | any | **Criterion not met — defer.** Keep default `off`. No telemetry multiplier. Next move owned by the corpus-widening / methodology-revision step that produces `telegraph-v<N+1>`. |
   | 0 % – < 30 % | any | **Hold.** Keep default `off`. Authorised follow-up: widen corpus or tune carve-out share; no default flip. |
   | ≥ 30 % | < 5 % | **Flip default on** — `telegraph.speak_scope` defaults to a non-`off` value (separate roadmap), carve-outs stay, statusline surfaces lifetime tokens saved. |
   | ≥ 30 % | ≥ 5 % | **Hold** — repeat the window once with tuned intensity ladder; second hold → deprecate. |

   "Quality regression" = host-side rubric on the corpus per
   `benchmark-report-schema.md`. Numbers checked into the published
   `telegraph-v<N>.json` as the decision artefact.
4. **No interim flip.** The default does not move on anecdote,
   gut feeling, or a single positive prompt. Only a published
   `telegraph-v<N>` report with a `vs_terse` median in the "Flip" row
   above authorises a default change, under a follow-up roadmap.

## v1 verdict (2026-05-16)

[`internal/bench/reports/telegraph-v1.md`](../../bench/reports/telegraph-v1.md)
landed 30 calls · $0.0805 · 0 errors · `claude-sonnet-4-5`:

| Metric | Median | p10 | p90 |
|---|---:|---:|---:|
| `vs_raw` savings | +23.51 % | -18.29 % | +52.53 % |
| **`vs_terse` savings** | **−9.27 %** | **−109.85 %** | +51.32 % |
| Realised carve-out share (condensed arm) | 30.67 % | — | — |

Per row 1 of the table, the v1 verdict is **criterion not met — defer**.
Default stays `off`; no telemetry multiplier ships; no rule retirement
in this roadmap. Wins exist only on pure-prose prompts (telegraph-09
+50.5 %, telegraph-10 +58.4 %); carve-out-heavy prompts drag the median
negative (telegraph-04 path-list −108 %, telegraph-06 mode-marker −123 %).

### Council split (recorded, not decisive)

Council run [`telegraph-v1-kc-verdict.json`](../../agents/runtime/council/responses/telegraph-v1-kc-verdict.json) <!-- council-ref-allowed: ADR decision trace for v1 kill-criterion verdict -->
(2 members · 1 round · $0.0514 actual) split:

- **`claude-sonnet-4-5`** → Decision A.1 (deprecate now) + Decision B.3
  (suspend telemetry). Reasoning: the roadmap pinned `vs_terse` as
  load-bearing; the data falsified it; retreating to `vs_raw` is
  post-hoc rationalisation.
- **`gpt-4o`** → Decision A.3 (hold + re-bench with widened corpus +
  revised terse-control prompt) + Decision B.2 (per-category
  multipliers, suppress negatives). Reasoning: 10 prompts is a
  razor-thin sample; the terse-control prompt may under-condense; the
  carve-out validator (Phase 4) is not yet shipped, so we are
  measuring a half-implemented feature.

**Synthesis (criterion-not-met + defer).** Both members agreed `vs_terse`
is the right gate. Neither's strongest path is taken in full inside
step-16: deprecation is reserved for a follow-up roadmap once v2 confirms
v1; re-bench is reserved for a follow-up roadmap with the methodology
revision the council requested. Step-16 ships the infrastructure (corpus,
bench arm, validator), records the v1 verdict, suspends the telemetry
multiplier, and hands the deprecate-vs-rebench call to the v2 roadmap.

## Why this is parked, not decided

The 2026-05-14 council split (Opus = remove now, o1 = measure-then-decide)
predated v1 numbers. The 2026-05-16 council split (Sonnet = deprecate now,
GPT-4o = re-bench) is informed by v1 but disagrees on which methodological
weakness is decisive. The kill table above gives every future bench run a
deterministic resolution path and stops every downstream roadmap from
re-litigating condensation on every PR.

## Cross-references

- [`internal/bench/reports/telegraph-v1.md`](../../bench/reports/telegraph-v1.md)
  — v1 measurement; canonical baseline this doc cites.
- [`docs/benchmarks.md`](../benchmarks.md)
  — cadence + when the next bench run is mandatory.
- [`telegraph-telemetry`](telegraph-telemetry.md)
  — multiplier contract; records the suspended state v2 must lift.
- [`telegraph-speak`](../../.agent-src.uncondensed/rules/telegraph-speak.md)
  — runtime rule; reads `telegraph.speak_scope` from settings.

## Done

This doc reflects the v1 verdict. It is **not** an action item. The next
bench closeout (against `telegraph-v2` once a widened corpus or revised
methodology is shipped) closes the loop.
