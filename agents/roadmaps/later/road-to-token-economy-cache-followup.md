---
complexity: lightweight
status: later
parent_roadmap: road-to-token-economy-cache
---

# Roadmap: Follow-up to road-to-token-economy-cache — the census-window remainder

> The repeat-injection census week runs, the top repeat-slot concerns get the
> idempotency gate, and the data-gated acceptance halves (advisory bypass
> rate, live turn/read metrics) are recorded against their registered
> thresholds — completing what the parent built the instruments for.

> **Parked in `later/` (2026-08-10, Iron Law 3 resolution — operator pick:
> follow-up ready + blocked).** Every open step below is gated on the same
> external trigger: one instrumented week of real sessions. **Resume when:**
> `agents/runtime/state/injection-census.jsonl` covers ≥ 7 days of real
> sessions (record mode: `./scripts-run src/scripts/bench_hook_injection --record`
> per session, or the equivalent standing wiring). The registered review date
> for all metric verdicts is **2026-11-10**
> (`src/config/hook-token-budget.json`).

## Goal

Close the census-gated remainder of the parent: idempotency gates on the
measured top repeat-slot concerns, plus the data-halves of the parent's
acceptance criteria, using the instruments the parent shipped — no new
mechanism.

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/road-to-token-economy-cache.md`](../archive/road-to-token-economy-cache.md)
(38 steps: 34 done, 4 deferred). The parent shipped: the per-slot injection
anatomy spike note (null invoked — injections ride the suffix, Phase 2
downgraded to the hygiene lint), `check_static_layer_stability` +
`bench_hook_injection` as CI gates, `hook-token-budget.json` (per-concern +
per-slot caps, census mode, advisory-adoption metric registrations), the
extended rtk corpus with published numbers, the cap advisory in
`rtk_wrap_hook.ts` (advisory-degraded per the resolved
`pretooluse-rewrite-semantics` blocker), the edit-shape and re-read-guard
advisories, and the batching fire/no-fire pair. What remains is exactly what
needs census DATA.

Blocker carried from the parent (verbatim status there):
`repeat-injection-census` — instrument shipped
(`bench_hook_injection --record` → `agents/runtime/state/injection-census.jsonl`);
awaiting one instrumented week of real sessions.

## Phase 1 — census week + idempotency gates (deferred parent 3.3)

- [ ] 1.1 (parent 3.3, verbatim) Idempotency discipline for repeat-slot
      concerns: a concern whose census-measured per-session fire count and
      byte volume rank it a top repeater gets a same-session byte-exact
      dedupe (fire once, stay silent on identical repeat payloads), each
      gated concern keeping its fire/no-fire test pair. Target list cites
      the census note — never a guessed set.
- [ ] 1.2 Publish the census note (per-concern fire frequency + byte volume
      over the instrumented week) next to the spike note under
      `agents/settings/contexts/`; the parent blocker resolves against it.

**Exit:** the census note exists; the named top repeaters carry the dedupe with passing test pairs.
**Rollback:** per-concern dedupe individually removable; the census file is gitignored state.

## Phase 2 — data-gated acceptance verdicts (deferred parent acceptance halves)

- [ ] 2.1 Advisory bypass/adoption verdict: read the
      `unbounded_output_advisory_rate` and `full_rewrite_small_diff_rate` /
      `duplicate_read_rate` warn counters over the window; commit thresholds
      in `hook-token-budget.json` from the measured baseline (the parent
      registered them deliberately baseline-first). Measurably ignored
      advisories get their trigger tightened or the line removed (the
      shipped kill standard).
- [ ] 2.2 `turns_per_task` first reading: record the per-SESSION baseline
      (the registration's stated honest gap — no task-envelope key exists
      yet); decide whether a task key is worth building or the metric stays
      per-session, by evidence in the registration file.

**Exit:** every parent metric registration carries either a committed threshold or a recorded honest-null verdict.
**Rollback:** n/a (readings + registration-file edits).

## Acceptance criteria

- [ ] The census note exists and the parent's `repeat-injection-census`
      blocker is cited as resolved against it.
- [ ] Top repeat-slot concerns carry the idempotency gate with passing
      fire/no-fire pairs — or the census-backed verdict that no concern
      clears the repeater bar (honest null).
- [ ] The advisory-adoption registrations in `hook-token-budget.json` carry
      measured baselines and thresholds (or recorded honest nulls) by the
      registered review date 2026-11-10.
