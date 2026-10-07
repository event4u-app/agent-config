# Findings: drain-road-to-a-graph-that-feeds-the-gate-20261006c
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: dc8e7c306a754e47c3b25ec7724f137384a12055b26a228351bdef66d4a8754c | diff: 2e9762f47e64247c33b94d2f2d8575fda4706ede | reviewer: r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c | prompt_hash: 6131ff1f7f8ab86f5ec296c9d1fc778f47fd737a9007b319bd7780358c27adad -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-road-to-a-graph-that-feeds-the-gate-20261006c"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 2e9762f47e64247c33b94d2f2d8575fda4706ede
  scope_hash: dc8e7c306a754e47c3b25ec7724f137384a12055b26a228351bdef66d4a8754c
  roadmap: agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
  roadmap_hash: b762a684ff3db562b79a3b82a3979d060c40698068f263477837d7c20944efb7
  ac_hash: 416225dbcfd411c82d6adcce236de5dd8e2cc1c28f2c2527109a7786afb65d5f
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T20:30:26Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/bench_graph_feeder_latency.ts:238 | Env restore is asymmetric: `EVENT4U_CONFIG_HOME` is deleted when it was unset, but `HOME` and `USERPROFILE` are assigned back unconditionally. On macOS/Linux `USERPROFILE` is normally unset, and Node coerces an assigned `undefined` to the string `"undefined"`, so after `bench()` (including the vitest test) the process carries `USERPROFILE=undefined` (and `HOME=undefined` wherever HOME was unset). Any later test in the same worker that resolves a home directory through USERPROFILE gets a relative path named `undefined`. | fixed | `restoreEnv` deletes a variable that was unset instead of assigning `undefined`. Test: bench_graph_feeder_latency.test.ts, 'leaves an unset home variable unset', seen red first. (`9535852b7`) |
| 2 | medium | agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md:167 | The 3.4 precondition (mirrored in the evidence page's last section) requires reporting "the feeder's stop-slot p95, measured by `bench_graph_feeder_latency` on the repository in question", but the only mode that runs against an existing repository (`--repo/--edit`, `benchRepo`) measures feeder work alone, not the stop slot; the stop-hook arms only run on a generated fixture. The baseline it is compared against (p95 ≈ 1,007 ms) is likewise a feeder-alone reading. The precondition names a metric the instrument cannot produce for the repository in question, so it is either unsatisfiable as written or will be satisfied with a different number than it names. | fixed | Precondition reworded to the number the instrument produces: feeder work alone via `--repo`, stated as the stop-slot increment and why; `--repo` does not run the hook over a real repo because that would write into the recall corpus. (`a35ba2f73`) |
| 3 | low | src/scripts/bench_graph_feeder_latency.ts:203 | "Interleaved" arms always run in the same order (`with` then `without`) every round, so order-dependent effects (GC from the heavier `with` arm's allocations, a 59 MB-class graph parse, file-cache warmth) land systematically on the `without` call rather than being spread across both. Interleaving cancels slow drift but not order bias; alternating or randomising the order per round would. The `without` floor (<1 ms) is the arm most exposed to this. | fixed | Arm order now alternates per round; fixture readings re-taken after the fix and republished. (`9535852b7`, `a35ba2f73`) |
| 4 | low | agents/evidence/analysis/graph-feeder-latency-2026-Q4.md:102 | The page cites `dispatch_hook.ts` as saying "a slow concern is bounded on neither route" in the same sentence it states the spawn route IS bounded by `SPAWN_TIMEOUT_MS` = 30,000 ms. As written, the quoted source and the page's own claim contradict each other; one of them is stale, and a reader cannot tell which bound actually governs the stop slot. | fixed | Page now separates the two routes: in-process has no kill-timeout, the spawn route keeps the 30 s kill, and neither has an SLA-derived bound, which is what the quoted line means. (`a35ba2f73`) |
