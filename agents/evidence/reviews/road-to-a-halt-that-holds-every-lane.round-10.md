# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 1118ee9c2c037fd00db400dabc1f7a0558a92c9338c76af980c662c3bf5c4d23 | diff: 7e0f32b2f304b85411f8bf03f298ac930ce8d0be | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: dd80712df925623854c805d9292706479bc31fb81e0ebbd068a36f88fcf595d5 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 7e0f32b2f304b85411f8bf03f298ac930ce8d0be
  scope_hash: 1118ee9c2c037fd00db400dabc1f7a0558a92c9338c76af980c662c3bf5c4d23
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: f92e574e909590f4cc4f7cb9f1e64421cfb2a609f562f992cd1bd772192c6c4e
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T20:09:32Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/roadmap_drain_queue.ts:187-190 | Release-direction regression against `main`, and inconsistent logic: `NEGATED_BEFORE_RE` adds past-tense contractions (`wasn't`, `weren't`), which release a hold with no further condition. Meanwhile `PAST_BEFORE_RE` treats an affirmative past tense (`was blocked by`) as still in force unless a `RESOLVED_AFTER_RE` clause follows. As a result, "It wasn't blocked by the probe until today; now it is." screens `runnable` (probed with `npx tsx` against `screenRoadmap`), while `main`'s `NEGATED_HOLD_RE` (no `n't` forms) kept it `held`. A past-tense negation describes the past just as `was blocked by` does, and neither says the hold is gone now. No fixture covers the contraction forms. The uncontracted "was not blocked by … until today" already released on `main`, so only the contraction is new. | fixed | Phase 2 reverted by AI-council verdict B (2026-11-24): the parser is byte-identical to origin/main, so the regression is gone; the phrasing is a corpus row of road-to-prose-holds-that-read-their-object |
| 2 | medium | src/agent-src/contexts/execution/process-full-all.md:108-110,143-145 | The Goal says the halt "stops every dispatch", but the halt check sits only in the dead-lane paragraph (line 84). The other re-start path in the same file has no halt check: a lane's `gated:` return is decided and the lane is resumed ("The orchestrator decides it and resumes you"; the verdict "goes back to the SAME lane via its message channel"). An armed halt does not stop that resume, and `emergency.orchestration_halt` appears nowhere else in the file. | fixed | process-full-all: the gated-lane resume re-runs the queue and holds the verdict while the halt is armed |
| 3 | low | src/scripts/roadmap_drain_queue.ts:212 | The second `citationRe` form accepts any single word after the cited blocker (`[a-z]+`). So "On hold until blocker `settled` is reverted." is treated as a hold whose object is the resolved blocker and released (`runnable`), even though the condition it names (a revert) has not happened. `main` behaved the same, so this is not a regression. | deferred | pre-existing on main; corpus row of road-to-prose-holds-that-read-their-object |
| 4 | low | agents/roadmaps/road-to-prose-holds-that-read-their-object.md:64 | Risk register rank 2 still says "Six review rounds each found new phrasings". Rounds 1–9 of this review each raised parser findings, and the same roadmap's Source line cites rounds 6–9. The figure is stale; nothing acts on it. | fixed | follow-up roadmap rewritten; its risk register no longer counts rounds |
