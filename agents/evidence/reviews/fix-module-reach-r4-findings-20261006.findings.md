# Findings: fix-module-reach-r4-findings-20261006
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: ccbb38cf7cd1294b492ed8ba7563bd97c010ce5115b5a37ef69e353f115c59ec | diff: 27b7385150645a094b7bf9cd3d26d19bbdd3a43f | reviewer: r2-fresh-subagent-fix-module-reach-r4-findings-20261006 | prompt_hash: 20e36ce52f48f46c5af28f76a1ead50469434504b20ba8f8abbb1de7fd898541 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-module-reach-r4-findings-20261006"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 27b7385150645a094b7bf9cd3d26d19bbdd3a43f
  scope_hash: ccbb38cf7cd1294b492ed8ba7563bd97c010ce5115b5a37ef69e353f115c59ec
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T07:20:17Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | tests/scripts/report_module_reach.test.ts:277 | The "R2 finding 2" regression test (`a level-4+ heading resets the step-block tracker too`) asserts only `expect(m?.group).not.toBe('open-or-deferred-step')`, unlike its sibling "R2 finding 1" test (line 248) which asserts the exact expected group (`toBe('named-outside-open-step')`). In this fixture the negative and exact assertions happen to be equivalent today (the only two reachable `group` values here are `open-or-deferred-step` and `named-outside-open-step`), but the weak form would still pass if a future regression caused the mention to not register at all (e.g. `group` silently becoming `named-in-none`) — a different, more severe failure this test is named after a specific prior bug and should be positioned to catch. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
