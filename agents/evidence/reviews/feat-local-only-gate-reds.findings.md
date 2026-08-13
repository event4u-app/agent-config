# Findings: feat-local-only-gate-reds
<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: 839e94ed1c360ad85c0df49b9e619981da3729bb817b6acf03586a817d8d98dd | diff: c8ab04232e07c0bee1b976453c6abe1da7dc2a14 | reviewer: r2-fresh-subagent-feat-local-only-gate-reds | prompt_hash: 42e0d2d014b8436fb730c69f2579c1bebabdff20a7d303ad58f1391cf5722756 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c8ab04232e07c0bee1b976453c6abe1da7dc2a14
  scope_hash: 839e94ed1c360ad85c0df49b9e619981da3729bb817b6acf03586a817d8d98dd
  roadmap: agents/roadmaps/road-to-local-only-gate-reds.md
  roadmap_hash: a7b7503cb8d66155b77d64dfad854d4763840c4d5d9b9ff386d62e030b154deb
  ac_hash: 99a4182cd1c23b36c9dc0a8fe028aefe1acd50d6452ae6a227d1f0a2d0f5b43b
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-13T07:41:51Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-local-only-gate-reds.md:218 | The Phase 2 step-2 record describes a self-test suite that no longer exists: it states "five cases (2 rejecting, floor 5)", enumerates exactly those five, and cites the mutation evidence as "4/5 case(s) behaved". The shipped gate declares `minCases: 6, minRejectCases: 3` and runs six; `npx tsx src/scripts/lint_rule_skill_pack_reach.ts --self-test` prints "6/6 case(s) behaved (3 rejecting, floor 6)". The sixth case (`--root` with no value) is one of the three rejecting cases counted toward the floor, is absent from the record, and the mutation check was not re-run against the six-case suite — so the durable evidence for this phase's acceptance criterion is falsified by the code it describes, in the same section that opens by saying "a count is a claim". | open | Verified by running the gate: `--self-test` reports 6/6, floor 6, 3 rejecting; src/scripts/lint_rule_skill_pack_reach.ts:346-380. Roadmap line 228 quotes `4/5`. |
| 2 | medium | agents/roadmaps/road-to-local-only-gate-reds.md:461 | The live red this branch's own repair created has no closing criterion. § 5 (line 446) folds a second, distinct decision into `blocker: ci-reachability-decision` — re-anchor `check_ci_local_parity`'s `min_scanned: 380` floor, now unmet at scanned 357, and rewrite its `corpus:` line, which still reads "443 at baseline". But the blocker's "Resolved when" (line 461), Phase 4 step 2's *Verify* (line 345) and the acceptance criteria (line 365) were all left covering only the CI-reachability decision. Recording that one decision therefore closes the last open step and the blocker, letting the roadmap reach `count_open == 0` and archive while `check_gate_coverage` is still red on a floor nobody owns — the "red gate nobody sees" class this roadmap exists to close. | open | Verified: `check_ci_local_parity --quiet` emits `scanned: 357` (107 CI + 250 local, exit 0); src/config/gate-coverage.yml:308-309 still carries `min_scanned: 380` and the 443-at-baseline corpus line. |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 -->
