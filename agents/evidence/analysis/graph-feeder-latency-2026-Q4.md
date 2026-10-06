<!-- evidence-type: analysis -->

# Graph feeder latency — 2026 Q4

**The feeder's cost on the stop slot, measured 2026-10-06/07.** On a generated
fixture repository the shadow arm adds **p50 ≈ 34 ms, p95 ≈ 47 ms** (200
modules) and **p50 ≈ 52 ms, p95 ≈ 67 ms** (2,000 modules) to a stop hook whose
own work is under 1 ms. Over this repository's real graph the feeder's work
alone read **p95 ≈ 583 ms to ≈ 1,007 ms** across four readings on one machine,
all reported below. The generated fixture prices
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
- **A third reading**, the feeder's own work (`graphState` +
  `graphUntestedVerdict`) timed directly, because the difference of two noisy
  totals is a weaker number than a direct one. Every verdict it returns is
  recorded and printed: the function turns any throw into `null`, so a broken
  graph load would otherwise be timed as if it were the walk.
- **All three readings interleaved, each warmed once, the rounds cycling
  through all six orders of the three calls**, so machine drift and order
  effects (GC after the heavier arm, cache warmth) spread across them: over
  every six rounds each call runs first twice and has each other call as its
  direct predecessor twice. The first publication of this page ran the hook
  arms in a fixed order and the feeder-alone loop after them, unwarmed; the
  second rotated the start of one fixed cycle, which balances position but not
  predecessor. Three R2 review rounds flagged these, and every fixture figure
  below was re-taken on the balanced instrument with a round count that is a
  multiple of six.
- **`--repo P --edit F`** takes the feeder-alone reading over an existing
  repository's own graph, read-only, records every distinct verdict across the
  billed rounds, and notes when the graph state is not `edited` — a stop
  normally follows an uncommitted edit, and on a clean tree the git probes
  answer a different question.

Machine: Apple M5 Max ×18, darwin 25.6.0 arm64, node v26.7.0. One machine; the
risk register's rank 5 names why that matters.

## Readings

### Generated fixture, 200 modules, 60 rounds

| arm | n | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| stop hook, with feeder | 60 | 34.97 | 48.19 | 51.76 |
| stop hook, without feeder | 60 | 0.64 | 0.91 | 1.60 |
| feeder work alone | 60 | 33.96 | 43.10 | 52.02 |

Delta: p50 34.33 ms, p95 47.28 ms. Exit codes: `[1]` in both arms. Feeder
verdicts: `["untested"]`.

`./scripts-run src/scripts/bench_graph_feeder_latency --runs 60 --files 200`

### Generated fixture, 2,000 modules, 60 rounds

| arm | n | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| stop hook, with feeder | 60 | 52.37 | 68.05 | 83.16 |
| stop hook, without feeder | 60 | 0.76 | 1.43 | 2.19 |
| feeder work alone | 60 | 52.96 | 73.03 | 106.83 |

Delta: p50 51.61 ms, p95 66.62 ms. Exit codes: `[1]` in both arms. Feeder
verdicts: `["untested"]`.

`./scripts-run src/scripts/bench_graph_feeder_latency --runs 60 --files 2000`

**How closely feeder-alone tracks the delta.** At p50 the two agree to within
0.4 ms (200 modules) and 1.4 ms (2,000 modules). At p95 they do not: feeder-alone
reads 4.2 ms *below* the delta at 200 modules and 6.4 ms *above* it at 2,000
modules — where it also exceeds the whole with-feeder stop's p95 (73.03 against
68.05 ms), a part greater than its whole. A p95 over 60 samples is the 57th
sample, so it moves by several milliseconds between runs; the earlier 50-round
reading on the rotated instrument showed the same pattern (p95 gaps of 6.9 and
1.4 ms, p50 gaps of 0.8 and 1.2 ms). Feeder-alone is a good stand-in for the
increment's median and only an approximation of its tail, accurate to several
milliseconds in either direction.

### This repository's own graph, 30 rounds

Edit priced: `src/scripts/check_memory.ts`. The first three rows used a graph
built at `e3c30fc9d` (3,768 files, 46,630 nodes, 164,961 edges, a 59 MB native
cache) and recorded only the last round's verdict, `untested` in each; the
balanced-instrument rows used a graph built at `23ff05cde` (3,769 files, 46,638
nodes, 165,023 edges) and record every round's verdict, `["untested"]` in both.

| reading | state | n | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|
| rotated instrument, `check_memory.ts` modified (one appended newline) | `edited` | 30 | 525.38 | 583.23 | 627.14 |
| rotated instrument, clean tree | `fresh` | 30 | 541.84 | 593.13 | 640.09 |
| first instrument, an unrelated new file uncommitted | `edited` | 30 | 884.02 | 1,007.47 | 1,051.26 |
| balanced instrument, `check_memory.ts` modified (one appended newline) | `edited` | 30 | 595.94 | 966.04 | 1,458.38 |
| balanced instrument, clean tree | `fresh` | 30 | 583.03 | 657.49 | 668.71 |

`./scripts-run src/scripts/bench_graph_feeder_latency --repo . --edit src/scripts/check_memory.ts --runs 30`

The `edited` state needs an uncommitted change to an indexed file; the first
and fourth rows were taken by appending a newline to `check_memory.ts` for the
run and restoring the file byte-for-byte afterwards, the third with the new
bench script itself uncommitted (the second and fifth are the clean tree). The
first instrument had no warm-up round and ran while other lanes of the same
drain were loading the machine; which of those two accounts for its factor of
1.7 over the first row was not isolated, so every row stands. The fourth row's
wide tail (p50 596 ms, max 1,458 ms) is the same machine-load signature: the
`--repo` mode times the feeder alone, so the instrument change cannot account
for it.

A one-off split, taken during the first reading with a scratch probe and not
shipped as an instrument (11 rounds, medians): `graphState` **≈ 195 ms** — the
git freshness probes over a 3,768-file tree — and source pick plus `loadGraph`
**≈ 634 ms**, which is parsing the 59 MB JSON cache. The `untested` walk itself
is the small remainder. The load term dominating is the finding; the absolute
figures belong to the slower of the two conditions above.

## What it means

- **The without-feeder stop is the floor and it is under 1 ms.** Everything a
  stop costs above that in a repository with a graph is the feeder.
- **The cost scales with the index, not with the edit.** The generated readings
  move little from 200 to 2,000 modules, because a small index loads fast; the
  real repository costs roughly 10–25× more at p50 (525–884 ms against the
  fixture's with-feeder 35–52 ms) and 9–21× at p95 (583–1,007 ms against
  48–68 ms), because its cache is 59 MB. A consumer with a
  larger graph pays more again, per stop, for a verdict nothing acts on yet.
- **No reading comes near a kill-bound this tree controls.** The two dispatch
  routes differ. The in-process route — the default — has no kill-timeout: a
  kill cannot preempt synchronous in-process code. The spawn route
  (`AGENT_CONFIG_HOOKS_ISOLATED=1`) keeps the historical kill-timeout
  `SPAWN_TIMEOUT_MS` = 30,000 ms (`concern_failure_policy.ts`). Neither route
  has an SLA-derived bound: the `sla_ms × 3` clause was tried and not landed,
  which is what `dispatch_hook.ts` means by "a slow concern is bounded on
  neither route". The highest real-repository p95 is about 3 % of the 30 s
  kill. The installer writes no per-hook `timeout`, so a host's own default
  applies; this page does not quote that number because it was not measured
  here. The risk the module header named is real in shape and, at these sizes,
  not close in magnitude.
- **It is still not free, and "nothing acts on it" is the reason to say so.**
  Roughly 0.5–1 s per stop in a repository of this size is a cost every turn
  end pays for a shadow measurement.

## The precondition this sets for step 3.4

Promoting the graph verdict into F (step 3.4) moves this cost from a shadow
measurement onto the gate's decision path. The stated precondition, carried
into that step's text: **the feeder's work alone, measured by this
instrument's `--repo P --edit F` mode on the repository in question, is
reported beside the promotion as its stop-slot increment, and the
real-repository readings here — p95 583–1,007 ms, the load term dominating —
are the baseline it is compared against.** Feeder work alone stands in for the
stop-slot increment because the fixture arms show the stop's own work is under
1 ms and the with-minus-without delta agrees with the feeder-alone reading to
within 1.4 ms at p50. At p95 the two differ by up to about 7 ms in either
direction, so the precondition's comparison rests on the median, and a p95 from
`--repo` is the increment's tail to within several milliseconds — immaterial
against a baseline in the hundreds. `--repo` deliberately does not run the whole hook
over a real repository: that would append rows to the repository's own feeder
record, which is the corpus `graph-feeder-recall-2026-Q4.md` labels. A promotion that
does not first cut the load term (a cached or incremental open) inherits half a
second to a second per stop.

This is a reading taken on a date on one machine, not a standing fact. Re-take
it before relying on it.
