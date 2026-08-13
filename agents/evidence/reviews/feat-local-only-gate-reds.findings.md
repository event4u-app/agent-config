# Findings: feat-local-only-gate-reds
<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: f9df026f6d9cb436c8c34f83460ec5281ddb326e971693c9f3db75118a706bd4 | diff: f98d9d52998c016ad865334ffdf3964b4e01a8e3 | reviewer: r2-fresh-subagent-feat-local-only-gate-reds | prompt_hash: ecef204405ce6628de3a6007eaee9f5787efe9e348b63cebaf7fea867a556048 -->

<!-- context-manifest: v1
inputs:
  diff_sha: f98d9d52998c016ad865334ffdf3964b4e01a8e3
  scope_hash: f9df026f6d9cb436c8c34f83460ec5281ddb326e971693c9f3db75118a706bd4
  roadmap: agents/roadmaps/road-to-local-only-gate-reds.md
  roadmap_hash: d848a0223b258a4616505f5ed4d030579a0c54f4791de639eaef1375f09a89a8
  ac_hash: de998dd970f8c9472bef83f7b005f56ae03d0a3be931632d2e629bdefea17a21
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-13T07:51:42Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-local-only-gate-reds.md:218 | The Phase 2 step-2 record describes a self-test suite that no longer exists: it states "five cases (2 rejecting, floor 5)", enumerates exactly those five, and cites the mutation evidence as "4/5 case(s) behaved". The shipped gate declares `minCases: 6, minRejectCases: 3` and runs six; `npx tsx src/scripts/lint_rule_skill_pack_reach.ts --self-test` prints "6/6 case(s) behaved (3 rejecting, floor 6)". The sixth case (`--root` with no value) is one of the three rejecting cases counted toward the floor, is absent from the record, and the mutation check was not re-run against the six-case suite — so the durable evidence for this phase's acceptance criterion is falsified by the code it describes, in the same section that opens by saying "a count is a claim". | fixed | Repaired in f98d9d529: the record now states six cases / three rejecting, documents the sixth, and records its mutation check including the first attempt that passed for the wrong reason. |
| 2 | medium | agents/roadmaps/road-to-local-only-gate-reds.md:461 | The live red this branch's own repair created has no closing criterion. § 5 (line 446) folds a second, distinct decision into `blocker: ci-reachability-decision` — re-anchor `check_ci_local_parity`'s `min_scanned: 380` floor, now unmet at scanned 357, and rewrite its `corpus:` line, which still reads "443 at baseline". But the blocker's "Resolved when" (line 461), Phase 4 step 2's *Verify* (line 345) and the acceptance criteria (line 365) were all left covering only the CI-reachability decision. Recording that one decision therefore closes the last open step and the blocker, letting the roadmap reach `count_open == 0` and archive while `check_gate_coverage` is still red on a floor nobody owns — the "red gate nobody sees" class this roadmap exists to close. | fixed | Repaired in f98d9d529: the red is named in the blocker `Resolved when` line and in a new acceptance criterion, so the roadmap cannot close green while it is live. |
