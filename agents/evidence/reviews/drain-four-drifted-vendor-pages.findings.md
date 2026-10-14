# Findings: drain-four-drifted-vendor-pages
<!-- completion-review: v1 | reviewed: 2026-10-14 | scope: 5cf32133376fa652bf16a5bd8f78b9d47cdb4e1f40ce0d075053f7f4f5544cc1 | diff: e3791d87e926ecd657453f981ffebc26de87bac9 | reviewer: r2-fresh-subagent-drain-four-drifted-vendor-pages | prompt_hash: 5c422d779e7c4250a42233287773e1fec97f8dab27d8cd232e93d22a277031c9 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-four-drifted-vendor-pages"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e3791d87e926ecd657453f981ffebc26de87bac9
  scope_hash: 5cf32133376fa652bf16a5bd8f78b9d47cdb4e1f40ce0d075053f7f4f5544cc1
  roadmap: agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
  roadmap_hash: c653ff6bcf563337d8b24fff9290df8dc386584feb9cedeb8c4a130b38ab01df
  ac_hash: 9177b5025bfc210404254faf14b8fcb1859646e899978dae0dde50367c93e065
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-14T15:18:14Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/hooks/host_lowering.yaml:103 | Step 1.2 and the Goal require every re-established row to have `expires` "moved FORWARD", and 1.2 is ticked `[x]`, but the `claude` row gets `docs_at: 2026-10-14` with `expires` left at 2027-09-06, i.e. not `docs_at` + 1 year as the table policy states for rows set by a dated docs read. The reason is given in the roadmap's Findings section ("predates the policy"), but the policy exception now sits on a row that was re-read under the policy, and the step's own text does not record the deviation. The rule is applied unevenly across the five re-dated rows. | accepted-risk | Reason: the table header carves claude out of the docs_at+1y policy by name and 2027-09-06 is still in the future; moving it is a separate gated decision, and both council seats read it as correctly grandfathered in ratification rounds 1 and 4. Accepted by: the drain lane, on that council reading. |
| 2 | low | agents/evidence/ratifications/drain-four-drifted-vendor-pages.md:47 | The `## Rounds` section says "Six council invocations" but numbers nine items, mixing fix commits and a completion review in with the rounds (item 5 = "Round 4", item 7 = "Round 5", item 9 = "Round 6"). A reader who cites "item N" or "round N" from this ratification record can land on the wrong entry. | accepted-risk | Reason: each item carries its own bold label (Round N / Fix commit / completion review), so a citation by round number resolves; renumbering the record would re-open the gated subject review for a cosmetic change. Accepted by: the drain lane. |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
