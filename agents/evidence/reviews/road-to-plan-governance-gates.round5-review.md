# Findings: road-to-plan-governance-gates (round 5)
<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: c7a76c7e9943053f5d831726715db98a9fa948b33e13f0213ca9a5d5d883128f | diff: ba202e2dd261ea3d194799946a2dc1924024bef3 | reviewer: r2-fresh-subagent-round5 -->

<!-- context-manifest: v1
inputs:
  diff_sha: ba202e2dd261ea3d194799946a2dc1924024bef3
  scope_hash: c7a76c7e9943053f5d831726715db98a9fa948b33e13f0213ca9a5d5d883128f
  roadmap: agents/roadmaps/archive/road-to-plan-governance-gates.md
  roadmap_hash: 7be2dc5ef4ca9bbda0e022e39a2a62c55c5fb9823dbcac734a0bbe2756cd7241
  ac_hash: 1c3cd7678aacae91ea045d13cde1f09e0bd97738d2f5a63857a2da04efc48dca
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-04T11:02:06Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | docs/contracts/plan-review-gates.md:399 | The newly added § 2.7 shipped a normative obligation ("Every finding in a superseded round must already be terminal before it is renamed") with no non-enforcement label, while every sibling unenforced obligation in the same contract carries one (§ 1 table "obligation stated, **not enforced**", § 4.1 `enforced_by: none`). The rename moves the file out of the `*.findings.md` glob, so § 2.2's "any `open` row → block" stops seeing it — renaming an artifact that still holds an `open` row escapes the gate, and no validator, hook, or test detects it. A reader had no signal that this one is agent-carried. | fixed | § 2.7 now carries an explicit `enforced_by: none` block naming the escape, why nothing detects it, and the CI-check option that was deliberately not built |

## Provenance

Fifth blind round, dispatched by `dispatch_r2_reviewer.ts` and answered by a
fresh subagent with no implementation context (contract § 5). Bound to scope
`c7a76c7e…` (head `ba202e2dd`).

One low finding, and a fitting one to close the branch on: the § 2.7 section
added in the immediately preceding commit was itself an unlabelled
claim-without-a-mechanism — the exact defect class this roadmap exists to
eliminate, reproduced in the contract that defines it. Fixed by labelling it
rather than by building the checker, with the checker named as an open option
and the reason it was skipped stated.

An earlier round on the preceding scope (`fa8f4d32…`, head `022f3819b`)
returned NO-FINDINGS; this round covers the one documentation commit added
after it.

