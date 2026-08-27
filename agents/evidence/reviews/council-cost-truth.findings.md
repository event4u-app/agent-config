# Findings: council-cost-truth
<!-- completion-review: v1 | reviewed: 2026-08-27 | scope: b6a8d44bc183675621fda54e89f69c04fa7772be4e42e25d09cc0244b6583d47 | diff: 80de6f69a5b99a4c05aa2ac5092539b15bf745ce | reviewer: council-2of2-cross-model | prompt_hash: fb596a15f47fbdeab4dcd0b6784a4ddf45a0df4ca63c5fe3a94820009f302945 -->
<!-- {"review-independence":{"review_independence":"cross-model","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["council-anthropic-claude-sonnet-4-5","council-openai-codex-default"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-27 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 80de6f69a5b99a4c05aa2ac5092539b15bf745ce
  scope_hash: b6a8d44bc183675621fda54e89f69c04fa7772be4e42e25d09cc0244b6583d47
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-27T07:51:25Z
-->

## Reviewer, and what it reviewed

AI council, **2 of 2 seats present and both answering** —
`anthropic/claude-sonnet-4-5` and `openai/codex-default`, artefact
`agents/runtime/council/responses/r2-council-cost-truth.md`, spent $0.0000, both
seats subscription-authed. Checked against each response's `error` field and
character count, not the stdout tally.

The prompt was the dispatcher's own `prompt.md` plus `diff.patch` verbatim. No
expectation of the outcome was stated in it and the scope was not narrowed, per
the evaluator-independence rule.

**The review ran against scope `561db04c` (head `333a18a9c`).** This artefact is
bound to `b6a8d44b` because every finding below was fixed in `80de6f69a`, which
moved the reviewed content. Both seats converged on the same two defects **in the
fix under review** and independently rated the display-logic one highest.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/council_cli.ts:2822 | `_all_subscription` inferred "all seats subscription-authed" from `actual_total === 0 && all_responses.some(r => !r.error)`. Zero spend does not prove zero billability: `estimate_cost` returns 0.0 when `lookup` finds no price row, so an unpriced BILLABLE model yields a zero total — as do a billable seat that errored and one reporting zero tokens. All three would have printed the subscription claim over real spend. | fixed | `80de6f69a` — replaced by the exported `allSeatsNonBillable`, which reads metadata (`answered.every(r => !isBillableResponse(r))`) and is vacuously false on an empty or all-errored set. The unpriced-model and zero-token cases are now executable tests. |
| 2 | medium | src/scripts/ai_council/pricing.ts:206 | `isBillableResponse` ended `return Boolean(raw)` while its own comment promised a conservative default. `Boolean(0)` and `Boolean([])` are `false`, so a numeric or empty-array value would have zeroed a billable seat, and the inconsistency covered every non-string, non-boolean type rather than only `0`. | fixed | `80de6f69a` — now `return true` for all unknown types. Sensitivity proven rather than asserted: restoring `Boolean(raw)` reds exactly the `numeric 0` case (1 failed / 21 passed); the fix greens it again. |
| 3 | low | tests/scripts/ai_council/billable_cost.test.ts | No coverage for numeric / array / object metadata values, nor for the label predicate the CLI prints. | fixed | `80de6f69a` — six parametrised type cases plus six `allSeatsNonBillable` cases. The label became an exported predicate instead of an inline expression, which is what made an assertion possible at all. 10 tests to 22. |
| 4 | low | agents/roadmaps/stubs/road-to-council-cost-truth.md | § 3 called the field name misleading and listed three fixes as if equally valid, without picking one. | fixed | `80de6f69a` — § 3 now recommends bumping `SCHEMA_VERSION` over renaming, and states plainly that the decision is the maintainer's rather than an agent's. |

## Verification at the bound scope

- `tests/scripts/ai_council/billable_cost.test.ts` — 22/22.
- Council suite (`tests/scripts/council_cli.test.ts` + `tests/scripts/ai_council/`) — **1066/1066**, airgap golden parity included, so no pinned CLI output string broke.
- `task typecheck-ts` and `eslint` on the three changed source files — clean.
- `check_source_size_budget` total excess **falls** 18446 → 18439.
- Live proof from the review run's own output: `spent $0.0000 — all seats subscription-authed, nothing billed`, where the same command previously printed `actual $0.1055`.
- Replayed against the two artefacts that produced the original defect: recorded `0.105525` / `0.10077`, billable-aware `0` / `0`, both seats `billable=false` including the persisted string form.

## Honest limits

**The reviewer saw the diff, not the repository.** Its tool allowlist is
branch-scoped by contract, so it could not check for other consumers of
`cost_usd_actual`. One exists — `cache_realization_report.ts:373`, summing the
field over historical artefacts that all predate the fix — and it is recorded in
the stub rather than fixed here.

**No second review ran against the fixes.** The findings above are dispositioned
by the author with fresh evidence per row, which is weaker than an independent
re-review and is stated as such rather than implied away.
