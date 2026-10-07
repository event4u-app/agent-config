# Findings: findings-that-get-a-disposition
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: be48fbe5da936a6793f7304ef09aa23881fdb08bdbc4cc40b6c1cb1b054fb039 | diff: 464986f87cf1851fcedd0aacdd2a92084b4d07d8 | reviewer: r2-fresh-subagent-findings-that-get-a-disposition | prompt_hash: bba827b2a197d89eee523621f52530356cfb06823de318fb130bda86924c6f41 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-findings-that-get-a-disposition"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 464986f87cf1851fcedd0aacdd2a92084b4d07d8
  scope_hash: be48fbe5da936a6793f7304ef09aa23881fdb08bdbc4cc40b6c1cb1b054fb039
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: cea8f233d3dfde0a8a915db888d75565a49d0205e6b32f831b8b78e0097f436e
  ac_hash: 54e9d5fc3420182ceb7a0dd55831d30e38322da85c574f9fa212b6c72fe5d382
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T20:02:20Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/check_finding_dispositions.ts:274 | The widening does not reach the case that motivated it. The gate judges only the rows in the ledger of the release being cut, so a medium security finding left open in a ledger at or before 16.3.0 is never gated again unless the next self-review happens to re-report it. That covers `eff3d4ed3fee` and the three 16.2.0 forge rows it cites (`c6367568cb1a`, `77e3912664b9`, `8605e9fc59cd`). The council's stated reason (D3) was a medium security finding that crossed 16.2.0 and 16.3.0 with nobody required to decide it. Under this change that same carry-over can cross 16.4.0 too. Nothing pulls open medium-security rows from earlier ledgers forward into the gated release, and nothing flags that they stay open. | deferred | put to the council 2026-10-07 (claude-sonnet-4-5 + codex, 2/2 present): split on carry-forward, so it escalates to the owner; roadmap D6, residue stub item 7 |
| 2 | medium | agents/roadmaps/road-to-findings-that-get-a-disposition.md:149 | D5 narrows the council verdict in D3 (option (a), release gate) on `agent` authority. The narrowing is a prospective cutoff, and the cutoff is set at exactly 16.3.0, the release whose ledger holds this branch's own `still_open` medium security row (`eff3d4ed3fee`). So the narrowing is what keeps `check_finding_dispositions --release 16.3.0` (step 1.3) green. The rationale may be sound, since a shipped release cannot wait. But the agent changed the scope of a council decision to clear its own gate, and that change was not routed back to the council or recorded as a council amendment. | fixed | the cutoff went back to the council 2026-10-07 and was ratified 2/2; D5 now records that council, not the agent, as the deciding authority |
| 3 | low | tests/scripts/check_finding_dispositions.test.ts:172 | The test 'orders by version, so a later patch on an older line stays exempt' asserts as correct the gap that the `isBlocking` docstring calls 'a reason to revisit, not to read as covered'. Suppose a 16.2.x maintenance release is cut after the decision. It ships its medium security rows ungated, and the suite stays green. So the condition the comment says should trigger a revisit is pinned as passing, and nothing signals it. | fixed | the council accepted the semver ordering as a documented exemption (2/2); the docblock now says so and names cutting a maintenance line as the reopening condition, so the test pins a ratified behaviour |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
