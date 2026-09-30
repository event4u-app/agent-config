# Findings: kernel-guards-plumbing Phase 3 (steps 3.1, 3.2)
<!-- completion-review: v1 | reviewed: 2026-09-30 | scope: 6cfb692d4ea1c071c098c1265e6f001e15e175d12a4350ef186a46ccfd3df5d8 | diff: a3d85f409659d818dd15217a6994c2e3a3c2ef0d | reviewer: ai-council-2of2-anthropic-openai | author: claude-code session 97f38eee | prompt_hash: 223c1db92435b33aef4369a93170e39cd7739b405f579c3e13f1303b0ae532a9 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-30 -->

<!-- context-manifest: v1
inputs:
  diff_sha: a3d85f409659d818dd15217a6994c2e3a3c2ef0d
  scope_hash: 6cfb692d4ea1c071c098c1265e6f001e15e175d12a4350ef186a46ccfd3df5d8
  roadmap: agents/roadmaps/road-to-a-kernel-that-guards-its-plumbing.md
  roadmap_hash: 06a248d762d230ba0cee02848d772c258c5a6d807b90221b0d10945aced57220
  ac_hash: c6faf4446ab8e030d0752ba765ef32eff93c7cfa84620705bb0fc1e3073587ab
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-30T18:24:00Z
-->

## Independence, stated rather than implied

`author` and the party that commissioned this review are the same session —
the shape [`evaluator-independence`](../../../src/rules/evaluator-independence.md)
forbids reviewing itself. `reviewed_by` is therefore the AI council: two seats,
two providers (`anthropic/claude-sonnet-4-5`, `openai/gpt-4o`), 2/2 present,
neither of them the party that wrote the diff. Spend $0.4779 estimated /
$0.1121 recorded.

**The prompt ships with the verdict**, per that rule's item 3. It is hashed in
the marker above. It is neutral by construction: it states no expected outcome
in either direction, it hands over the whole delta rather than a scope the
author chose, and its one scope exclusion (step 3.3, deliberately unimplemented)
is a statement of what the roadmap already records, not a filter over the code
under review. The verdict came back **REQUEST_CHANGES**, which is itself
evidence the prompt did not steer.

## Verdict

**REQUEST_CHANGES**, with three named blockers. All three are fixed in
`a3d85f4`, before this artifact was written.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/bench_hook_latency.ts:~600 | **Per-concern p95 pooled samples across events.** `readConcernTimings` keyed by concern alone, so a concern bound to several slots produced a p95 of the union — a number describing no slot in particular, biased by whichever slot the bench runs most. Step 3.3 derives ONE timeout per concern (`sla_ms × 3`) and the dispatcher applies it wherever the concern runs, so the bound must hold on the concern's WORST slot or it refuses there. Both seats converged on this independently. | fixed | a3d85f4 — keyed by (concern, event); the row reports the max of per-event p95s and names the event that set it. Regression test is deliberately lopsided (40 fast samples on one slot, 4 slow on another) so a pooled p95 drops the slow slot below the 95th percentile and vanishes. |
| 2 | high | src/scripts/write_bundle_digest.mjs | **The sidecar mitigation did not cover every path.** Both seats called a post-build verification the single highest-leverage addition: `prepack-check.mjs` covers the published tarball and nothing else, while a missing or unreadable sidecar is `unverifiable` at runtime and ALLOWS by design — so a degraded sidecar fails nothing. | fixed | a3d85f4 — the writer reads back what it wrote and exits 1 if it does not describe the bundle. Covers every path that produces a bundle, because it is part of producing one. |
| 3 | medium | src/scripts/bench_hook_latency.ts:~105 | **The skip count was claimed, not provided.** The header said a skipped line lowers `n` "so the reduction is visible rather than silent". A lower `n` shows the EFFECT of a skip and never its cause — 90 of 100 lines valid and 90 runs look identical. The claim in my own comment was false. | fixed | a3d85f4 — `readConcernTimings` returns `{ byConcernEvent, skipped }` and the report prints the count when non-zero. |
| 4 | medium | src/scripts/bench_hook_latency.ts:~635 | **A malformed budget value rendered as `not_measured`.** `typeof registered === 'number' ? registered : null` coerced a typo in `concern_sla_ms` into the same output as a concern the bench never timed, so the error was invisible. | fixed | a3d85f4 — renders `MALFORMED`; the three legal states (absent, explicit null, number) are pinned in the other direction. |
| 5 | low | src/scripts/hooks/dispatch_hook.ts:~501 | **`duration_ms` is now a float under an integer-sounding name.** One seat asked for a rename plus an integer accessor; the other called the risk real but low-probability. | accepted-risk | The field is internal to `RunResult` with two call sites, both in this diff, and both floor at the point of storage. A rename ripples through the feedback schema for a field no consumer outside this file reads. The header states the contract at the declaration. Recorded rather than silently declined. |
| 6 | low | src/scripts/bench_hook_latency.ts:~1026 | **`concernSlaPass` runs unconditionally, not only under `--gate`.** One seat called the ~20 extra runs per event pure cost for a developer running the bench locally. | accepted-risk | Gating the report behind `--gate` is the mistake the `per_turn_composite` row in `hook-latency-budget.json` documents having made once: a row that appears only under `--gate` is unavailable exactly where it is cheapest to read. The pass is capped at `min(runs, 20)`; the default `--runs` is what a caller already chose to pay. |

## Two claims checked and refuted

Kept out of the table above on purpose: the status enum is
`open|fixed|accepted-risk|deferred` and none of those words means "checked, and
it does not hold". Recording a refuted claim as `accepted-risk` would put a
risk in the ledger that the evidence says is not there.

**`AGENT_CONFIG_HOOK_TIMINGS` is not in the kill-switch table**
(`concern_timings.ts:32`). It is. The row was added to
`docs/contracts/hook-architecture-v1.md § Kill switches` in `4bd8345` — by the
pre-push gate refusing the first push over exactly this — and
`check_kill_switch_table` reports `30 switch(es) in 426 file(s), 30 table
row(s), sets equal`. The seat inferred a `src/config/dispatch-killswitches.json`
that does not exist in this tree.

**The stamp cache should be keyed by Node version**
(`bundle_integrity.ts:~153`). Raised by one seat and refuted by the other on
the code, which is why it is recorded rather than dropped: the cache compares
size AND mtime, so a rebuild that changes the digest changes one of them and
misses. The residual — a digest change with identical size and mtime — needs a
deliberate timestamp forge, and the module header already states that trade
explicitly.

## What the reviewers could not check

The **replay-versus-live delta** that motivated `concernSlaPass` is measured
(n=25 per cell, recorded in that function's header) and **not pinned by a
test**. Asserting it needs a spawn of the real bundle against a real state
root — slow and environment-dependent — and a mocked spawn would test the
mock. Neither seat raised it; it is declared here because the author knows it
and a reader of the test file would not.

The council bundle carried the source diff and **not** the test files or
`docs/contracts/hook-architecture-v1.md`, because the transport ceiling is
50 KB and the diff is 48 KB. So no independent party read the tests that pin
these fixes. That is a real gap in this record, not a formality.

## Fresh verification behind the fixes

- `npm run typecheck` → clean
- `tests/scripts/bench_hook_latency_per_concern.test.ts` (18) +
  `tests/scripts/hooks/bundle_integrity.test.ts` (21) → 39 passed
- `check_static_parity` locally → `present-but-off: 672, exit 0` /
  `absent: 672, exit 0`, verdicts identical
- `check_kill_switch_table` → 30 == 30
- `lint_exit_codes`, `lint_deny_text`, `lint_code_comments` → green
