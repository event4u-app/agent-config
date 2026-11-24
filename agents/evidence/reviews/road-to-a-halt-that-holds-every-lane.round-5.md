# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 11e13495db451c2ed60691678e3790b84890b60d618d9667a1c0b3206d9bb224 | diff: c9aa912e711c0d7e2ada86d863c8628b8dac902e | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: fa1612a0fc33c62f1322d84d5457112c96c83ca4bad35790ba44d53ab73f35d6 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c9aa912e711c0d7e2ada86d863c8628b8dac902e
  scope_hash: 11e13495db451c2ed60691678e3790b84890b60d618d9667a1c0b3206d9bb224
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: d915ff573b787f1b961fc5dfe09d9ff0ea20ea53f63ed01155ac39a9345706b4
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T19:45:54Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/roadmap_drain_queue.ts:196 | A dependency hold written as "Parked until blocker `settled` ships." or "On hold until blocker `settled` resolves." stays `held` forever once `settled` has resolved: OWNER_HOLD_RE treats `parked until` and `on hold` as owner holds, so the resolved-citation release never applies to them, even when the phrase cites the blocker directly. On main the resolved named blocker made these steps runnable, so this is a regression. It breaks step 2.4 ("the resolved name suppresses only the hold that names it") and the Goal ("held only when a hold is actually still in force"). Probe: screenRoadmap with a resolved `settled` returns `held` for both texts. | fixed | only `owner-reserved` is an owner hold; "parked until / on hold until blocker `x` …" release again as on main — two fixtures, red before |
| 2 | medium | src/scripts/roadmap_drain_queue.ts:206 | citationRe only anchors on the citation prefix and lets the rest of the span run free. As a result, a resolved blocker releases every other dependency coordinated in the same hold phrase: "Blocked by blocker `settled` and the probe." -> runnable, and "Waits on blocker `settled` and on the host binary." -> runnable, although the probe and the host binary are still open dependencies. The same coordination in reverse order ("Blocked by the probe and blocker `settled`.") -> held, so word order still decides the outcome, which is the very defect finding 2 named. The `[^.;]*?\bsee\s+blocker` alternative also releases "Blocked by the host binary, see blocker `settled` for the earlier probe." This is Risk-register item 2 (a looser parser releases real holds), and no test covers it. | fixed | a citation releases only when it is the hold's whole object (nothing but the sentence end follows) — fixtures "… and the probe", "… for the earlier probe", plus the reverse order |
| 3 | medium | src/agent-src/contexts/execution/process-full-all.md:87 | The procedure says the text output "opens with a `HALTED —` line". It does not: renderText always prints the `drain queue · …` header first, and the HALTED line comes second (the test asserts `split('\n')[1]`). An agent that follows the dead-lane re-dispatch procedure literally and checks only the first line of the text output will miss the halt (AC-2). The same text is in dist/agent-src/contexts/execution/process-full-all.md:87. | fixed | process-full-all says the HALTED line sits directly under the `drain queue ·` header |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
