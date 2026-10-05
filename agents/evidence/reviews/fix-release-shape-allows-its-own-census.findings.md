# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: c70ed190310263cc05f90ac3ba9173708a772d70c2f640a702556b6c5820cdeb | diff: c54288d5acf04d8594857dbf1c61d65b46e1cc6e | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: 6748dff16f4fd6b12c7370b2b6888264fa8eb3b56e64c1cc8ec26f9762c654ba -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c54288d5acf04d8594857dbf1c61d65b46e1cc6e
  scope_hash: c70ed190310263cc05f90ac3ba9173708a772d70c2f640a702556b6c5820cdeb
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T09:21:29Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/check_release_pr_shape.test.ts:175 | Silent deletion of the only positive test for the remediation hint. The branch removes `describe('check_release_pr_shape — mid-release-fix remediation hint')` and its member `it('an out-of-shape finding carries the land-on-main procedure')`, which asserted `out` contains `land the files above on main via their own PR` and `task release -- --resume --yes`. Only its inverse survives (`a shape-clean diff carries no remediation prose`, `not.toContain`), and no other test in the file references those strings — verified by enumerating all 18 surviving tests and grepping the file: `land the files above` appears once, inside the negative assertion. The remediation block at `src/scripts/check_release_pr_shape.ts:183-190` could now be deleted wholesale and the suite stays green, while the contract's § Mid-release fixes depends on that message reaching the operator. The diff is otherwise about the census allowlist entry; nothing in the added comments, the contract change or the docblocks explains the removal, so the loss reads as collateral of the splice rather than a decision. | fixed | fac41641d —  base `tests/scripts/check_release_pr_shape.test.ts:118-126` vs head; diff hunk `@@ -113,15 +125,51 @@` |
| 2 | low | docs/contracts/release-pr-gating.md:90 | The contract explains the one non-obvious glob choice with a reason it never states. The paragraph is headed "**`*` crosses `/` here**" and establishes that property for `*` only; it then says the census row "uses digit classes rather than `?` for exactly that reason". The operative property is that **`?`** compiles to `.` under the `s` flag and therefore also crosses `/` — stated in `check_release_pr_shape.ts:50-52`, nowhere in the contract. A reader following the contract alone cannot derive why `[0-9]` beats `?`, since `*` does not appear in the census row at all. This defeats the paragraph's own stated purpose two sentences later ("a reader must be able to predict the gate without reading TypeScript"). | fixed | fac41641d —  `docs/contracts/release-pr-gating.md:85-92`; code comment `src/scripts/check_release_pr_shape.ts:48-57` |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
