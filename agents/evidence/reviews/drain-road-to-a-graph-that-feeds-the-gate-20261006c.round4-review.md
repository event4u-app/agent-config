# Findings: drain-road-to-a-graph-that-feeds-the-gate-20261006c
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: 7cfa800838afd997e909fd325c9efd2545f149c07eade3270dbe3e0c18b8ff6d | diff: e3f13d33b218e7ef3e350866545377111e377336 | reviewer: r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c | prompt_hash: 54831d4f359e394467aa56607e144c94f71f3289c8a54b16b64d4e3833a28bd3 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e3f13d33b218e7ef3e350866545377111e377336
  scope_hash: 7cfa800838afd997e909fd325c9efd2545f149c07eade3270dbe3e0c18b8ff6d
  roadmap: agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
  roadmap_hash: 86d3147fcc4be6c5e2fe5a2583766d411ed2677297924f0bba1be464340ef783
  ac_hash: 416225dbcfd411c82d6adcce236de5dd8e2cc1c28f2c2527109a7786afb65d5f
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T23:06:24Z
-->

Round 4. Round 3 (`round3-review.md`) was closed by this reviewer: each of its ten
rows was re-verified against the code at `e3f13d33b` and given its status there
(nine `fixed`, row 6 `accepted-risk`), then archived per contract §2.7. Rows 1-10
below carry those verdicts; rows 11-15 are new. The prompt is recorded in
`<slug>.review-input/prompt.md`, including the caller's instructions verbatim.

Disclosure of method, because §5's tool allowlist was not held exactly: besides the
branch diff and branch-touched files, this review read the round-1 to round-3
artefacts (the caller instructed it), `git log` of the branch range, two helper
modules the diff imports (`_lib/git_env.ts`, `code_graph/detect.ts`), and the PR's
CI check list (`gh pr checks`, all passing at this head), and it ran
`tests/scripts/bench_graph_feeder_latency.test.ts` (7/7 green).

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/bench_graph_feeder_latency.ts:105 | (round 3, #1) An inherited `GIT_DIR` overrode `git -C <fixture>`, so `makeFixture` committed the fixture onto the host repository. | fixed | `git()` builds its env from `gitEnv()`; the GIT_DIR test stubs it at a victim repo and asserts HEAD unmoved, green. (`5d0e58f8b`) |
| 2 | medium | src/scripts/bench_graph_feeder_latency.ts:230 | (round 2, #1 / round 3, #2) The feeder-alone loop discarded the verdict, so a swallowed load failure was timed as real work. | fixed | `feederCall` returns the verdict, `feederVerdicts` is printed and asserted `['untested']`. (`e2f2a741b`) |
| 3 | medium | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:93 | (round 3, #3) The restated "within 1 ms / 2 ms" tracking claim contradicted the page's own tables. | fixed | Lines 93-102 now state the measured gaps (p50 0.4 / 1.4 ms, p95 -4.2 / +6.4 ms), each re-derived from the tables; the 3.4 precondition rests on the median. (`e3f13d33b`) |
| 4 | low | src/scripts/bench_graph_feeder_latency.ts:330 | (round 2, #3 / round 3, #4) Real-repository reproduction did not state or warn on the priced graph state. | fixed | `renderRepo` notes a non-`edited` state. (`e2f2a741b`, `b32b4328a`) |
| 5 | low | src/scripts/bench_graph_feeder_latency.ts:361 | (round 2, #4 / round 3, #5) `parseArgs` accepted misread flag combinations. | fixed | Refused and covered by test. (`e2f2a741b`) |
| 6 | low | package-lock.json:1767 | (round 3, #6) `@modelcontextprotocol/sdk` 1.30.0 -> 1.32.1 rides a measurement PR. | accepted-risk | Lockfile-only, same major, for GHSA-6qxp-vccf-f47h; `60b92e5f6` records the runtime `npm audit` job reds every PR without it, and that job is green here. A CI prerequisite; duplicates #2238. |
| 7 | low | src/scripts/bench_graph_feeder_latency.ts:197 | (round 3, #7) Rotating the start of one fixed cycle did not balance predecessors. | fixed | Rounds cycle all six permutations; within a round each ordered pair occurs twice per six rounds, asserted by test. Round-boundary residual: row 11. (`23ff05cde`) |
| 8 | low | src/scripts/bench_graph_feeder_latency.ts:310 | (round 3, #8) `benchRepo` reported only the last round's verdict. | fixed | Every distinct billed-round verdict is collected and asserted. (`23ff05cde`) |
| 9 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:122 | (round 3, #9) The method-to-row mapping of the real-repository table was wrong. | fixed | Lines 122-125 match the table. (`e3f13d33b`) |
| 10 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:146 | (round 3, #10) The real-vs-fixture ratio understated the upper bound. | fixed | Now 10-25x p50 / 9-21x p95; re-derived 10.0-25.3 and 8.6-20.9. (`e3f13d33b`) |
| 11 | low | src/scripts/bench_graph_feeder_latency.ts:24 | The header (line 24-28) and the page (line 46-50) claim the six-order cycle balances "the direct predecessor of every call ... exactly so when the round count is a multiple of six", but only within a round. The first call of each round has the previous round's last call as its direct predecessor, and those six boundary transitions are 2>0, 1>1, 2>1, 0>2, 1>2, 0>0: per six rounds `with` (0) is preceded by the feeder-alone call 3 times, by `without` twice and by itself once; the feeder call is never preceded by itself. So `with` most often runs right after the call that just loaded the graph — the warm-cache effect row 7 named. The test (line 37-52) counts only intra-round pairs, so it cannot see this. Ordering rounds so boundaries are also balanced (or stating the claim as intra-round) closes it. | fixed | Verified by round 5 at `5062a9431`: header line 24-35, the `ORDERS` doc (line 195-200) and page line 47-54 state the balance as within-round and name the unbalanced boundary; test line 54-65 asserts the boundary imbalance. (`30843ea0b`, `5062a9431`) |
| 12 | low | agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md:162 | The step 3.5 STATE line still publishes the pre-re-take fixture figures "p50 ≈ 32 ms / p95 ≈ 39 ms (200 modules)", while the page it points at now reports p50 ≈ 34 ms / p95 ≈ 47 ms for 200 modules (delta 34.33 / 47.28, page line 6 and 75). The roadmap is where 3.4's reader starts, and its p95 is 8 ms (17 %) below the published one. | fixed | Verified by round 5 at `5062a9431`: the STATE line reads p50 ≈ 34 ms / p95 ≈ 47 ms (200 modules), matching the page's delta 34.33 / 47.28. (`5062a9431`) |
| 13 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:9 | "p95 ≈ 583 ms to ≈ 1,007 ms across four readings" — the table below (line 114-118) has five real-repository readings, all inside that range. A reader reconciling summary and table finds a reading unaccounted for. | fixed | Verified by round 5 at `5062a9431`: page line 9-11 says five readings, matching the five-row table at line 118-122. (`5062a9431`) |
| 14 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:142 | "The without-feeder stop is the floor and it is under 1 ms" (also line 7-8 and line 175-176, and the roadmap STATE line 163) holds at p50 only: at 2,000 modules the without-feeder p95 is 1.43 ms and max 2.19 ms (line 85). The precondition's justification ("the stop's own work is under 1 ms") should name the percentile. | fixed | Verified by round 5 at `5062a9431`: page line 8, 148-149 and 182-183 and the roadmap STATE line qualify the floor as p50 and name p95 1.43 ms / max 2.19 ms. (`5062a9431`) |
| 15 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:129 | The fourth real-repository row's tail (p95 966 ms, max 1,458 ms) is attributed to "the same machine-load signature" as fact, two sentences after the page says the first instrument's slowdown was "not isolated". No load measurement is recorded for that run, and it also used a different graph build (`23ff05cde`) than rows 1-3. The causal clause is an inference presented as a reading; it should be labelled as one or dropped. | fixed | Verified by round 5 at `5062a9431`: page line 132-137 calls the tail unexplained and names machine load and the build difference as unmeasured candidates. (`5062a9431`) |
