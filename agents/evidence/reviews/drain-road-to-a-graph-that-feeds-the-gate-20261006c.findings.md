# Findings: drain-road-to-a-graph-that-feeds-the-gate-20261006c
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: 0ec6046ab9bc8d838539e6ee7d58014cbaed0b1f57f638f619a60a04f2af4454 | diff: 2933e7c4f42a899b6695cf4b265b9e16ee16721c | reviewer: r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c | prompt_hash: dcf811efd712bebf4ef9966a654db12c624522bbc76982452ed2621cf8c1ffed -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 2933e7c4f42a899b6695cf4b265b9e16ee16721c
  scope_hash: 0ec6046ab9bc8d838539e6ee7d58014cbaed0b1f57f638f619a60a04f2af4454
  roadmap: agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
  roadmap_hash: a6a00e87a36d5991d0756bcf9d42ab4f32dab413850004e52e04e688a93848d2
  ac_hash: 416225dbcfd411c82d6adcce236de5dd8e2cc1c28f2c2527109a7786afb65d5f
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T20:33:54Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/bench_graph_feeder_latency.ts:439 | The feeder-alone loop discards the return of `graphUntestedVerdict`, which swallows every throw (pickSource, loadGraph, untested) and returns verdict `null`. A broken graph open or walk would therefore be timed as the short-circuit and published as "feeder work"; the fixture report carries no verdict (only `benchRepo` reports one). The test at tests/scripts/bench_graph_feeder_latency.test.ts:615 (`feederOnly.p50 > 0`, commented "real work, not a no-op") cannot catch this, because the `graphState` freshness probes alone make p50 > 0. Asserting/reporting a non-null verdict (`untested` on this fixture) would close it. | open | |
| 2 | low | src/scripts/bench_graph_feeder_latency.ts:435 | The feeder-alone reading is taken in a separate, non-interleaved block after all hook rounds, with no warm-up of its own — the drift/order bias the header says interleaving removes applies to exactly the reading the 3.4 precondition relies on. Visible in the published data: at 2,000 modules feeder-alone p50 57.71 ms exceeds the entire with-feeder stop p50 52.03 ms (part > whole), which undercuts the analysis claim (graph-feeder-latency-2026-Q4.md:136-137) that it "tracks the with-minus-without delta within a few milliseconds", the stated justification for using it as the stop-slot increment. | open | |
| 3 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:96 | The published reproduction command for the real-repository baseline does not say that `src/scripts/check_memory.ts` was uncommitted at measurement time (state `edited`); on a clean checkout the same command reads state `fresh`, and `benchRepo` neither warns nor refuses when the state differs from the one priced, so the baseline the 3.4 precondition compares against is not reproducible as written. | open | |
| 4 | low | src/scripts/bench_graph_feeder_latency.ts:539 | `parseArgs` accepts `--files` together with `--repo/--edit` and silently ignores it in repo mode, and `--repo`/`--edit` accept a following flag as their value (`--repo --edit x` takes `--edit` as the repo path). Both fail late or silently instead of at the usage line. | open | |
