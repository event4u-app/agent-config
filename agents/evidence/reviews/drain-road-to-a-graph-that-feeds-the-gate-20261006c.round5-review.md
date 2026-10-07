# Findings: drain-road-to-a-graph-that-feeds-the-gate-20261006c
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: 9fc72f76422dcbdb91ebd2ddc2fb1b1c4b579b570fff4c9275d3e97a777c1a92 | diff: 5062a94313cbd8c56b0476fded1715e3d278144e | reviewer: r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c | prompt_hash: c75307e1155b3c8a8845782a2c68d7f3fbe6fc5304c232139bec648cc9dc84e6 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 5062a94313cbd8c56b0476fded1715e3d278144e
  scope_hash: 9fc72f76422dcbdb91ebd2ddc2fb1b1c4b579b570fff4c9275d3e97a777c1a92
  roadmap: agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
  roadmap_hash: 21959aab49b7ca9285a7547fc71e1287f6a3e82f38019a88eed35b9791ee2c78
  ac_hash: 416225dbcfd411c82d6adcce236de5dd8e2cc1c28f2c2527109a7786afb65d5f
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T00:17:02Z
-->

Round 5. Round 4 (`round4-review.md`) was closed by this reviewer: each of its five
open rows (#11-#15) was re-verified against the code at `5062a9431` and found
fixed, then archived per contract §2.7. Rows 1-5 below carry those verdicts; rows
6-8 are new. The prompt is recorded in `<slug>.review-input/prompt.md`, including
the caller's instructions verbatim; `prompt_hash` binds that file as committed.

Disclosure of method, because §5's tool allowlist was not held exactly: besides the
branch diff and branch-touched files, this review read the round-4 artefact (the
caller instructed it), `git log`/`git show --stat` of the branch range, the R2
contract and dispatcher, and the PR's CI check list (`gh pr checks`: 49 success,
12 skipped, none failing at this head), and it ran
`tests/scripts/bench_graph_feeder_latency.test.ts` (8/8 green). Arithmetic on the
page (p50/p95 gaps, the 10-25x / 9-21x ratios, the 3 % of 30 s) was re-derived from
its tables and holds.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/bench_graph_feeder_latency.ts:24 | (round 4, #11) The six-order cycle was claimed to balance every call's direct predecessor, which holds only within a round. | fixed | Verified at `5062a9431`: header line 24-35, the `ORDERS` doc (line 195-200) and page line 47-54 state the claim as within-round and name the boundary imbalance; test line 54-65 asserts it. (`30843ea0b`, `5062a9431`) |
| 2 | low | agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md:162 | (round 4, #12) The step 3.5 STATE line published the pre-re-take fixture figures. | fixed | Verified at `5062a9431`: STATE reads p50 ≈ 34 / p95 ≈ 47 ms (200 modules), matching delta 34.33 / 47.28. (`5062a9431`) |
| 3 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:9 | (round 4, #13) The summary said four real-repository readings against a five-row table. | fixed | Verified at `5062a9431`: line 9-11 says five, table line 118-122 has five. (`5062a9431`) |
| 4 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:148 | (round 4, #14) "Under 1 ms" for the without-feeder floor held at p50 only. | fixed | Verified at `5062a9431`: page line 8, 148-149, 182-183 and the roadmap STATE line name p50 and give p95 1.43 / max 2.19 ms. (`5062a9431`) |
| 5 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:132 | (round 4, #15) The fourth real-repository row's tail was attributed to machine load as fact. | fixed | Verified at `5062a9431`: line 132-137 calls it unexplained and names load and the build difference as unmeasured candidates. (`5062a9431`) |
| 6 | low | tests/scripts/bench_graph_feeder_latency.test.ts:24 | Nothing checks that the `without` arm's feeder actually stops at `absent`. `bench` records `graphState` for `withDir` only (src line 231, 277) and the test asserts that one (`edited`), the exit codes and the feeder-alone verdict. If graph detection ever resolved an index for the cache-less tree (a fallback source, a stray cache), both arms would take the full feeder path, the with-minus-without delta (the page's headline 34 / 47 ms) would collapse toward zero and read as "the feeder is nearly free", and every assertion in the test would still pass. Recording `graphState(withoutDir)` in the report and asserting `absent` closes it. | fixed | Verified at `fbadafa48`: `bench` records `graphStateWithout = graphState(withoutDir)` (src line 76-77, 234, 281), the same `graphState(workspaceRoot)` the hook's feeder calls (`turn_end_gate_hook.ts:1314`); test line 25-26 asserts `absent`; suite 8/8 green on rerun. (`72c585b49`) |
| 7 | low | agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md:164 | The STATE line says the real-repository feeder work "read p95 ≈ 583 ms and, on an earlier run, ≈ 1,007 ms", presenting 583 ms as the current reading. The page (line 116-122) records five readings; 583 ms is from the rotated instrument, and the later balanced-instrument `edited` reading (line 121) is p95 966 ms. A reader of the roadmap, where step 3.4's reader starts, takes the lowest of five as the latest. Quoting the page's range across five readings (as the 3.4 precondition text already does) closes it. | fixed | Verified at `fbadafa48`: roadmap line 164-167 states p95 583-1,007 ms across five readings and lists each with its instrument, matching page table line 118-122 (966 ms named as the newest `edited`). (`f1e91459c`) |
| 8 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:139 | The one-off split is "taken during the first reading", but the table's first row (line 118, p50 525 ms) is not the first instrument's reading, which sits third (line 120, p50 884 ms). The split's medians, 195 + 634 ≈ 829 ms, exceed row 1's p50 entirely, so a reader mapping "first reading" to the first row finds an impossible decomposition; line 144's "the slower of the two conditions above" refers to the two candidate causes in the previous paragraph, not to a row. Naming the row ("the first-instrument reading, third row") closes it. | fixed | Verified at `fbadafa48`: page line 139-145 names "the first-instrument reading (the third table row, p50 884 ms)" and attributes the absolute figures to that row; 195 + 634 = 829 ms is below that row's p50. (`fbadafa48`) |
