# Downshift versus cache — the trade-off `subagent-routing.md` declined to resolve

> `road-to-inbox-harvest-2026-08-d-top-band-model-economy` Step 4.2, run
> 2026-08-16. The step's contract is to publish the reading **whichever way it
> falls**, so the open trade-off stops being open indefinitely. It falls
> against the concern as stated, and the reason is a premise the concern
> carried rather than a number it got wrong.

## The question, as the tree posed it

`src/agent-src/contexts/execution/subagent-routing.md` has carried this since
road-to-cache-economy Phase 4:

> A tier downshift changes the sub-task's model, and the prompt cache is keyed
> by `(model, prefix)` — so a downshifted leg forfeits its model-scoped cache
> reads AND splits a cohort's shared prefix into two caches. […] which wins is
> a measured question, not a default this policy resolves.

Two distinct claims sit inside that. They are measured separately below,
because one is false and the other is true-but-small.

## Instrument and corpus

`./scripts-run src/scripts/cache_realization_report --format json`, the
existing instrument — not a new one. It reads local Claude Code transcripts
and computes every figure from

```
billable_input = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

never from `usage.input_tokens`, which excludes cache tokens.

| Property | Value |
|---|---|
| Root | `~/.claude/projects` (full tree, no per-project filter) |
| Window | last 14 days |
| Records | 58,231 unique of 116,056 (dedup 49.8 %) |
| Host | Claude Code 2.1.233 |
| Subagent legs | **611** |
| Subagent calls | **16,612** |

## Claim 1 — "a downshifted leg forfeits its model-scoped cache reads"

**False at the dispatch boundary, and the number is not close.**

| Measure | Value |
|---|---:|
| Subagent leg **first-call** cache-read share | **2.8 %** |
| Subagent **overall** cache-read share (all calls) | 96.9 % |
| Median first-call written-or-uncached tokens | 242,891 |
| Cold start as a share of subagent write volume | 64.6 % |

A subagent leg starts **cold**: its first call realizes 2.8 % cache read. It
does not inherit the orchestrator's cache, and it does not inherit it at the
session tier either. So at the moment the routing decision is taken, a
downshifted leg forfeits **the cache it does not have**. Nothing is given up
that the same-tier leg would have kept.

What downshifting actually changes is *which model* the leg's own fresh cache
gets created on. The cache is not forfeited; it **moves**. And it then gets
read — at the downshifted price — for the rest of the leg.

## Claim 2 — "splits a cohort's shared prefix into two caches"

**True, and bounded to roughly 2 % of billable input.**

| Measure | Share of subagent billable input |
|---|---:|
| Cache **read** | 96.9 % |
| Cache **write** (creation) | **3.1 %** |
| Uncached | 0.008 % |

Prefix splitting is a *write*-side cost: it makes a cohort pay for two cache
creations instead of one. Writes are 3.1 % of billable input, and cold starts
are 64.6 % of that — so the entire cost surface this concern names sits inside
about **2 %** of subagent spend. The per-call model saving a downshift buys
applies against the **96.9 %** read share.

The two effects are therefore roughly an order of magnitude apart, in the
direction that favours downshifting.

## Why leg length is the variable that matters, not tier

| Percentile | Calls per leg |
|---|---:|
| p25 | 10 |
| **median** | **18** |
| p75 | 33 |
| p90 | 55 |
| max | 382 |

Single-call legs are rare: **2.0 %** of legs make ≤1 call, 11.8 % make ≤5. The
typical leg pays one cold start and then amortizes it across ~17 further calls
reading at ~97 %.

That is the real shape of the economics, and it is not the shape the concern
assumed. The cost of a dispatch is dominated by its **cold start**, which is
paid per leg regardless of tier; the tier then prices every call after it. A
downshift therefore discounts the amortized 96.9 % while leaving the one cold
start it was already going to pay.

## The reading

**On this corpus, the cache side does not oppose downshifting — it is
structurally close to neutral, and what remains of it is ~2 % of billable
input against a ~97 % surface.** The trade-off `subagent-routing.md` declined
to resolve resolves in favour of the downshift, and the reason the question
felt open is that "forfeits its cache reads" implied a leg arrives warm. It
arrives at 2.8 %.

This does **not** license downshifting as a target. The non-escalation floor in
`subagent-routing.md` still binds: the dominant per-dispatch cost is the cold
start (median 242,891 written-or-uncached tokens), which is exactly why a slice
too small to carry its own reading should stay in-session. This page removes
one argument *against* downshifting a leg that was going to be dispatched
anyway; it adds no argument *for* dispatching more of them.

## Limits — stated, not glossed

- **Structural, not realized.** No dispatch in the record corpus can be
  classified as downshifted: over 327 `orchestration` records, `session_tier`
  is non-null **0** times and `tier_chosen` **1** time. So this measures the
  cache mechanics a downshift would meet, not savings a downshift produced.
  Realized savings remain unmeasurable for the reason
  `orchestration_savings_report.ts` already prints.
- **One machine, one operator, 14 days.** Not a fleet.
- **Model-agnostic.** The report does not split read share by model, so the
  2.8 % / 96.9 % figures are the leg-lifecycle shape, not a per-band
  comparison. A model-split would sharpen claim 2; it would not reverse
  claim 1, which rests on the first call being cold.
- **Cache pricing weights are not applied here.** The read/write shares are
  token shares. Weighted units (read 0.1×, 5 m write 1.25×, 1 h write 2.0×,
  per `_lib/cc_transcript.ts`) would move claim 2's ~2 % further **down**,
  since the surviving cost is write-side and reads are the discounted leg.

## Re-verification

```bash
./scripts-run src/scripts/cache_realization_report --format text
```

Re-run and restamp this page if the subagent **first-call** cache-read share
rises above 10 % (claim 1 would start to bite), or if write share of billable
input rises above 10 % (claim 2 would stop being negligible). Either condition
falsifies the reading above rather than merely aging it.
