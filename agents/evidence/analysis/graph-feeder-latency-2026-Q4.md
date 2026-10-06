<!-- evidence-type: analysis -->

# Graph feeder latency — 2026 Q4

**The feeder's cost on the stop slot, measured 2026-10-06 at `e3c30fc9d`.** On a
generated fixture repository the shadow arm adds **p50 ≈ 42 ms, p95 ≈ 50 ms**
(200 modules) and **p50 ≈ 51 ms, p95 ≈ 66 ms** (2,000 modules) to a stop hook
whose own work is under 1 ms. Over this repository's real graph the feeder's
work alone is **p50 ≈ 884 ms, p95 ≈ 1,007 ms** — the generated fixture prices
the walk, and the real index prices the load, which is the larger term by an
order of magnitude.

Companion to `graph-feeder-recall-2026-Q4.md`. That page decides whether the
graph verdict is any good; this one says what it costs to ask.

## Why it was measured

`src/scripts/_lib/graph_feeder_record.ts` withdrew an earlier "costs the turn
nothing" claim and left the latency unmeasured. The feeder runs inside
`turn-end-gate`, a `severity: blocking` concern on `stop`. A host that timed that
hook out would discard detector F's refusal, so a slow shadow arm can weaken the
gate it is meant to feed — and the existing comparative exit-code test cannot see
that, because both of its runs complete.

## Instrument

`src/scripts/bench_graph_feeder_latency.ts`, tested by
`tests/scripts/bench_graph_feeder_latency.test.ts`.

- **The hook's own `main()`, in-process**, fed through the same stdin override
  the in-process dispatcher uses. That is the route a host takes, so a process
  spawn or a `tsx` start-up is not billed to either arm and cannot drown the
  difference.
- **Two arms over the same generated tree and the same turn**: an absolute-path
  `Edit` to `src/service.ts` (the shape Claude Code emits), no test touched, a
  completion claim — so detector F fires in both. `with` has a native graph and
  the edit uncommitted (`graphState` = `edited`, the full feeder path: git
  freshness probes, graph open, `untested` walk, row append). `without` is the
  identical tree with no graph cache, where the feeder stops at `absent`.
- **Interleaved, order alternating per round**, so machine drift and order
  effects (GC after the heavier arm, cache warmth) land on both arms. The first
  publication of this page ran a fixed with-then-without order; the R2 review
  flagged the order bias and the fixture readings below were re-taken after the
  fix.
- **A third reading**, the feeder's own work (`graphState` +
  `graphUntestedVerdict`) timed directly, because the difference of two noisy
  totals is a weaker number than a direct one.
- **`--repo P --edit F`** takes that third reading over an existing repository's
  own graph, read-only.

Machine: Apple M5 Max ×18, darwin 25.6.0 arm64, node v26.7.0. One machine; the
risk register's rank 5 names why that matters.

## Readings

### Generated fixture, 200 modules, 50 rounds

| arm | n | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| stop hook, with feeder | 50 | 42.61 | 51.03 | 66.48 |
| stop hook, without feeder | 50 | 0.61 | 1.00 | 2.26 |
| feeder work alone | 50 | 40.64 | 45.35 | 46.66 |

Delta: p50 42.00 ms, p95 50.03 ms. Exit codes: `[1]` in both arms.

`./scripts-run src/scripts/bench_graph_feeder_latency --runs 50 --files 200`

### Generated fixture, 2,000 modules, 50 rounds

| arm | n | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| stop hook, with feeder | 50 | 52.03 | 66.73 | 67.75 |
| stop hook, without feeder | 50 | 0.58 | 0.88 | 2.00 |
| feeder work alone | 50 | 57.71 | 65.03 | 68.82 |

Delta: p50 51.45 ms, p95 65.85 ms. Exit codes: `[1]` in both arms.

`./scripts-run src/scripts/bench_graph_feeder_latency --runs 50 --files 2000`

### This repository's own graph, 30 rounds

Graph built in the measuring worktree at `e3c30fc9d`: 3,768 files, 46,630
nodes, 164,961 edges, a 59 MB native cache. Edit priced:
`src/scripts/check_memory.ts`; state `edited`, verdict `untested`.

| reading | n | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| feeder work alone | 30 | 884.02 | 1,007.47 | 1,051.26 |

`./scripts-run src/scripts/bench_graph_feeder_latency --repo . --edit src/scripts/check_memory.ts --runs 30`

A one-off split, taken with a scratch probe and not shipped as an instrument
(11 rounds, medians): `graphState` **≈ 195 ms** — the git freshness probes over a
3,768-file tree — and source pick plus `loadGraph` **≈ 634 ms**, which is parsing
the 59 MB JSON cache. The `untested` walk itself is the small remainder.

## What it means

- **The without-feeder stop is the floor and it is under 1 ms.** Everything a
  stop costs above that in a repository with a graph is the feeder.
- **The cost scales with the index, not with the edit.** The generated readings
  barely move from 200 to 2,000 modules, because a small index loads fast; the
  real repository costs ~20× more because its cache is 59 MB. A consumer with a
  larger graph pays more again, per stop, for a verdict nothing acts on yet.
- **No reading comes near a kill-bound this tree controls.** The two dispatch
  routes differ. The in-process route — the default — has no kill-timeout: a
  kill cannot preempt synchronous in-process code. The spawn route
  (`AGENT_CONFIG_HOOKS_ISOLATED=1`) keeps the historical kill-timeout
  `SPAWN_TIMEOUT_MS` = 30,000 ms (`concern_failure_policy.ts`). Neither route
  has an SLA-derived bound: the `sla_ms × 3` clause was tried and not landed,
  which is what `dispatch_hook.ts` means by "a slow concern is bounded on
  neither route". The real-repository p95 is about 3 % of the 30 s kill. The installer writes no per-hook `timeout`, so a host's own default
  applies; this page does not quote that number because it was not measured
  here. The risk the module header named is real in shape and, at these sizes,
  not close in magnitude.
- **It is still not free, and "nothing acts on it" is the reason to say so.**
  Roughly 0.9–1 s per stop in a repository of this size is a cost every turn
  end pays for a shadow measurement.

## The precondition this sets for step 3.4

Promoting the graph verdict into F (step 3.4) moves this cost from a shadow
measurement onto the gate's decision path. The stated precondition, carried
into that step's text: **the feeder's work alone, measured by this
instrument's `--repo P --edit F` mode on the repository in question, is
reported beside the promotion as its stop-slot increment, and the
real-repository reading here — p95 ≈ 1,007 ms, of which ≈ 634 ms is loading the
cache — is the baseline it is compared against.** Feeder work alone stands in
for the stop-slot increment because the fixture arms show the stop's own work
is under 1 ms and the with-minus-without delta tracks the feeder-alone reading
within a few milliseconds. `--repo` deliberately does not run the whole hook
over a real repository: that would append rows to the repository's own feeder
record, which is the corpus `graph-feeder-recall-2026-Q4.md` labels. A promotion that
does not first cut the load term (a cached or incremental open) inherits about
a second per stop.

This is a reading taken on a date on one machine, not a standing fact. Re-take
it before relying on it.
