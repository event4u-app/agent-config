---
complexity: structural
review_by: 2027-03-31
---

# Stub: road to executing the council-topology benchmark

> **Stub — not active work.** Created 2026-09-01 (drain run 12) by the AI
> council's **Option A3** verdict on
> `road-to-inbox-harvest-2026-08-e-council-topology-evidence`,
> `blocker: phase-2-benchmark-cost`. Phase 2 and its 23 dependent steps are
> `[-]` in that roadmap and point here. `[-]` means **DEFERRED, not cancelled
> and not satisfied.** Nothing was descoped for cost — token spend was
> pre-authorised. It was descoped because the design needs capacity this
> environment does not have.

## The council verdict this stub exists to carry

AI council 2026-09-01, members **anthropic (claude-sonnet-4-5)** and
**openai (codex-default)**, 2 rounds, blind chairman, subscription transport
(`billable=0`, `$0.0000`), quorum `2/2 present, needed 1 — concluded`.
**Verdict: A3, convergent 2/2.** Both seats reached it independently and
neither recorded a dissent on it.

The reasoning both seats gave, in their own terms: the benchmark is executable
in a *procedural* sense and not in a sense that can license a claim. Spending
1,584–1,804 calls over 20 UTC days at `N=2` cannot satisfy the pre-registered
`n >= 5` / `n >= 10` promotion floors, so the schedule buys a number nobody may
act on. The parent roadmap already recorded that limit itself: *"at N=2 this
benchmark licenses no promotion claim at all"*.

## Why it is not executable today — the measured facts

Read at commit `af77709fd`; reproduce rather than quoting.

- **No runner exists.** `src/scripts/ai_council/topology_bench_manifest.ts:822`
  — `main()` handles only `--emit` and writes the manifest JSON. There is no
  provider dispatch anywhere in the file.
- **The frozen schedule.** `internal/bench/council-topology/call-manifest.json`
  `totals`: `minimum_calls {anthropic: 814, openai: 770}`, `worst_case_calls
  {anthropic: 924, openai: 880}`, `minimum_total: 1584`, `worst_case_total:
  1804`, `utc_days: 20`, `cap_per_provider_per_day: 50`.
- **Cell state.** 384 cells — 352 `pending`, 32 `not_eligible`, **0 complete**.
- **The schedule monopolises both seats.** `day_batches` books 46–50 calls per
  provider on each of days 1–19 and 15 on day 20.
- **Two seats are all there are.** `agent-config council:status` reports
  `2 enabled of 5` (anthropic, openai), and those same two seats are the
  repository's decision mechanism.

The constraint is **wall-clock and capacity, not budget**. Twenty consecutive
UTC days of exclusive provider capacity is not something an autonomous run can
reserve, and authorising spend does not create it.

## What must survive here — the council's enumerated list

Both seats specified what the stub has to carry for the work to be resumable.
All of it is already in the tree; this section is the index, not a copy.

- The frozen manifest, its digest, its version and its eligibility state —
  `internal/bench/council-topology/call-manifest.json`.
- The arm specification (3 axes x 4 membership-change modes) and the
  pre-registration it was generated from.
- Call counts, batching assumptions, provider caps and the 20-day schedule.
- **The missing production-runner requirement** — the single largest unbuilt
  piece.
- The `n >= 5` and `n >= 10` claim-licensing floors from step 2.6.
- All 23 dependent steps and their dependency relationships, listed below.
- The deferral reason: **insufficient configured seats plus unavailable
  continuous capacity — NOT token cost.**

## The 23 dependent steps deferred with Phase 2

Direct: 2.2, 2.3, 2.4, 2.5, 2.7.
By dependency: 5.2, 5.5, 7.2, 7.4, 7.5, 7.6, 8.5, 9.1, 9.4, 10.4, 11.2, 11.3,
11.5, 13.1, 13.2, 13.3, 13.4, 13.5.

## Resumption trigger — all three conjuncts, refined by the council

1. **`n >= 5` independent eligible seats configured** — enough to reach a
   pre-registered floor at all.
2. **A verified 20-consecutive-UTC-day reservation** of that capacity. The
   openai seat was explicit that *"sequence it later is not itself evidence of
   availability"*: the reservation must be established, not intended.
3. **No governed-estate headroom constraint** preventing those seats from being
   monopolised for the duration.

## Fresh-manifest trigger

If the corpus, the models, the prompts, the eligibility rules, or the provider
configuration change before resumption, **the frozen manifest is invalidated
and a fresh pre-registration cycle is required.** A manifest generated against
one configuration does not describe a benchmark run under another.

## Claims the parent roadmap may NOT make while these steps are `[-]`

Enumerated by the council and binding:

- that topology effects were benchmarked;
- that any topology is superior to another;
- that topology-driven promotion is supported;
- that the 23 dependent outcomes were empirically validated;
- **"we tested it at N=2"** — the design licenses no claim at N=2, so even the
  hedged form is forbidden.

**The single permitted claim:** the benchmark was **designed, pre-registered,
and deferred**.

## Floors carried forward unmoved

The `n >= 5` and `n >= 10` promotion floors stand. The council was asked
whether it wished to move them and declined.
