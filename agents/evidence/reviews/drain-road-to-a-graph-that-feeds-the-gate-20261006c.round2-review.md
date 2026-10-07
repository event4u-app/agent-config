# Findings: drain-road-to-a-graph-that-feeds-the-gate-20261006c
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: e58f6d41c888941fc19ca319ba7beecd17f3ed08ea9d8165203780fbc2965b19 | diff: d5253057808b0eb0ef4c869cdf5f4a8848097294 | reviewer: r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c | prompt_hash: 47342ad91df70afb0e519bb95826e756522547b5c49d946225f4621678ffbfbc -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: d5253057808b0eb0ef4c869cdf5f4a8848097294
  scope_hash: e58f6d41c888941fc19ca319ba7beecd17f3ed08ea9d8165203780fbc2965b19
  roadmap: agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
  roadmap_hash: 74c2f0dfd6fe66ad00d933e303d4a7d39ad60261b0f660e95c7829cf00b55ea5
  ac_hash: 416225dbcfd411c82d6adcce236de5dd8e2cc1c28f2c2527109a7786afb65d5f
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T22:04:10Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/bench_graph_feeder_latency.ts:439 | The feeder-alone loop discards the return of `graphUntestedVerdict`, which swallows every throw (pickSource, loadGraph, untested) and returns verdict `null`. A broken graph open or walk would therefore be timed as the short-circuit and published as "feeder work"; the fixture report carries no verdict (only `benchRepo` reports one). The test at tests/scripts/bench_graph_feeder_latency.test.ts:615 (`feederOnly.p50 > 0`, commented "real work, not a no-op") cannot catch this, because the `graphState` freshness probes alone make p50 > 0. Asserting/reporting a non-null verdict (`untested` on this fixture) would close it. | fixed | Every timed feeder verdict is recorded in `feederVerdicts` and printed; the test asserts `['untested']`, so a swallowed load failure (`null`) reds it. (`e2f2a741b`) |
| 2 | low | src/scripts/bench_graph_feeder_latency.ts:435 | The feeder-alone reading is taken in a separate, non-interleaved block after all hook rounds, with no warm-up of its own — the drift/order bias the header says interleaving removes applies to exactly the reading the 3.4 precondition relies on. Visible in the published data: at 2,000 modules feeder-alone p50 57.71 ms exceeds the entire with-feeder stop p50 52.03 ms (part > whole), which undercuts the analysis claim (graph-feeder-latency-2026-Q4.md:136-137) that it "tracks the with-minus-without delta within a few milliseconds", the stated justification for using it as the stop-slot increment. | fixed | The feeder-alone call now runs inside the same per-round rotation as the two hook arms and is warmed once; re-taken figures track the with-minus-without delta within 2 ms and the page's claim was restated against them. (`e2f2a741b`, `b32b4328a`) |
| 3 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:96 | The published reproduction command for the real-repository baseline does not say that `src/scripts/check_memory.ts` was uncommitted at measurement time (state `edited`); on a clean checkout the same command reads state `fresh`, and `benchRepo` neither warns nor refuses when the state differs from the one priced, so the baseline the 3.4 precondition compares against is not reproducible as written. | fixed | `--repo` output now notes a non-`edited` state; the page states how each real-repository row reached `edited` and adds a clean-tree row. (`e2f2a741b`, `b32b4328a`) |
| 4 | low | src/scripts/bench_graph_feeder_latency.ts:539 | `parseArgs` accepts `--files` together with `--repo/--edit` and silently ignores it in repo mode, and `--repo`/`--edit` accept a following flag as their value (`--repo --edit x` takes `--edit` as the repo path). Both fail late or silently instead of at the usage line. | fixed | `parseArgs` refuses `--files` with `--repo` and a flag-shaped value for `--repo`/`--edit`; covered by a new test. (`e2f2a741b`) |
