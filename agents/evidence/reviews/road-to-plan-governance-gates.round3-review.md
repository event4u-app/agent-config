# Findings: road-to-plan-governance-gates (round 3)
<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: 57965c9ddd55e2af10e763edb835c9d74fb388feed2fdd5955087b561837634b | diff: 6f0934c561223a8dd4424fa109b4c8b5701d38a7 | reviewer: r2-fresh-subagent-round3 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 6f0934c561223a8dd4424fa109b4c8b5701d38a7
  scope_hash: 57965c9ddd55e2af10e763edb835c9d74fb388feed2fdd5955087b561837634b
  roadmap: agents/roadmaps/archive/road-to-plan-governance-gates.md
  roadmap_hash: 5b087b623a17d4019701ae24a8c0c5d6d5b7e8a01065277499bb017b208a3c92
  ac_hash: 547d6024c1af2654c850bd4193e15c008919a686583db09fa8d8adc1d77a8a36
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-04T10:06:28Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/dispatch_r2_reviewer.ts:101 | The review scope excluded only `agents/evidence/reviews`, but contract §7 MANDATES appending the R2 outcome event to the tracked `agents/evidence/metrics/gate-metrics.jsonl` — so committing that mandated event changed `scope_hash` and turned the artifact that just recorded the review into a `stale-review` block: the self-invalidation class §2.0 exists to eliminate, re-entering through a sibling path. | open | |
| 2 | medium | src/scripts/lint_plan_risk_register.ts:810 | `scanned:` was written only after the whole `checkFile` loop, so a throw inside it (unreadable roadmap, permission denied) exited 2 having emitted no count — contradicting contract §6 ("emitted on every exit path, exit 2 included") and reproducing the coverage-guard blind spot already fixed for `check_completion_review`. | open | |
| 3 | medium | src/scripts/lint_plan_risk_register.ts:211 | `_splitRow` split on every `\|` with no handling for the markdown-escaped `\\\|`, so a register row copied from the contract's OWN §1.2 example shifted every column: `Risk type` became `product \\` (spurious `bad_risk_type`) and `Anchored under` became the description cell (spurious `dangling_anchor`). | open | |
| 4 | medium | src/scripts/check_completion_review.ts:294 | `splitTableRow` carried the same escaped-pipe defect: a findings row whose text contains `text\\\|json` shifted `Status` and `Reason/Ref` one cell right, so `Status` parsed as a fragment of the finding text (`bad-value`) and a `fixed` row lost its commit ref (`unresolvable-fix-ref`) — blocking in enforced mode with no fix except rewording the prose. | open | |
| 5 | medium | src/scripts/dispatch_r2_reviewer.ts:497 | `runVerify` mixes snapshots: `scope_hash` derives from committed state while `roadmap_hash` / `ac_hash` are read from the working tree, so an uncommitted roadmap edit makes `--verify-current` report a manifest mismatch and exit 1 on a non-advisory step. | open | |
| 6 | medium | docs/contracts/plan-review-gates.md:147 | The merge-commit invariance claim was stated unconditionally, but three-dot diff is `merge-base(base,HEAD)..HEAD`: with an overlapping base advance the local hash and CI's differ, so CI reports `stale-review` on a locally valid review. | open | |
| 7 | medium | src/scripts/dispatch_r2_reviewer.ts:105 | The scope exclusion was hardcoded while the artefact location is a CLI parameter (`--out-dir` / `--artifact-dir`), so a non-default directory put the findings artifact back inside the reviewed scope and committing it — which §2.5 requires — silently invalidated the review it records. | open | |
| 8 | low | src/scripts/lint_plan_risk_register.ts:489 | `fileHistory` passed the raw `path.relative()` result to git as a pathspec while its two sibling helpers normalize separators, so on Windows the backslash pathspec matched nothing, history came back empty, and the grandfather clause read that as "no baseline" → every pre-activation roadmap failed `missing_register`. | open | |
| 9 | low | src/scripts/check_completion_review.ts:725 | Same un-normalized pathspec in `checkFindingsBeforeFixes`: on Windows `git log --diff-filter=A` returned nothing, `addSha` was null, and a properly committed findings artifact was reported `artifact-not-committed`. | open | |
| 10 | low | src/scripts/dispatch_r2_reviewer.ts:553 | `runVerifyCurrent` / `runVerify` never read `.agent-settings.yml`, so the documented `planning.completion_review: false` escape hatch did not disable the second, blocking R2 enforcement step — CI could exit 1 with the gate nominally switched off. | open | |
| 11 | low | src/scripts/annotate_r1_outcomes.ts:131 | The `while (!OUTCOMES.has(answer))` loop awaited `rl.question`, whose callback never fires on EOF, so a non-interactive invocation without `--list` hung forever instead of exiting. | open | |
| 12 | low | docs/contracts/plan-review-gates.md:345 | The write-path rule claimed "generic write operations on that glob are a lint violation" for `agents/runtime/state/gate-c-*.json`, but the change shipped no linter implementing it and named none — an enforcement path that cannot fire. | open | |

## Provenance

Third blind review round on this branch, dispatched by
`dispatch_r2_reviewer.ts` and answered by a fresh subagent with no
implementation context (contract § 5). Bound to scope `57965c9d…`
(head `6f0934c56`) — the content as of the round-2 closure.

Created directly under the `*.roundN-review.md` name rather than
`*.findings.md`: the fixes for these rows move the content past this scope, so
per contract § 2.1 this artefact is a historical record and the binding
artefact is the final round, reviewed on frozen content. Statuses are `open`
here on purpose — this file is committed BEFORE the fix commits so the
§ 2.5 findings-before-fixes ancestry holds, and the terminal statuses land in
a follow-up commit that cites each fix.
