# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: c84087ae48100cce89b3392f8cbad9d97f83f3b5283d8973faf6e92354dca913 | diff: ffa7dd256252c422c5106aca9ff7f90246894006 | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: f753d7a16d575f1fac4728380a63aab36e4f69e7188fe4de7c070ce4f043b9a1 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: ffa7dd256252c422c5106aca9ff7f90246894006
  scope_hash: c84087ae48100cce89b3392f8cbad9d97f83f3b5283d8973faf6e92354dca913
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: d915ff573b787f1b961fc5dfe09d9ff0ea20ea53f63ed01155ac39a9345706b4
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T19:50:12Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/roadmap_drain_queue.ts:193 | `RESOLVED_AFTER_RE` is tested against the whole remainder of the sentence after the hold phrase, so a relative clause that resolves only the LAST of several objects releases the hold on all of them: `It was blocked by the probe and the host, which has since shipped.` and `Was blocked by the probe and the host binary, which have since shipped.` both classify `runnable` (probed via `screenRoadmap`). The comment above the regex says the resolution must attach to "the hold's own object"; with a compound object it does not, and the release direction is the one Risk Register row 2 names as the dangerous one. No fixture covers a compound object. | deferred | carried to agents/roadmaps/road-to-prose-holds-that-read-their-object.md finding 1 (in this change); review loop closed after six rounds by design — further phrasing patterns repeat the defect class |
| 2 | medium | src/scripts/roadmap_drain_queue.ts:206 | `citationRe` recognises only four exact shapes, so a dependency hold whose sole object IS the resolved blocker stays `held` permanently when phrased any other way. Probed with blocker `a` (and `b`) resolved: `Blocked by blocker \`a\` and blocker \`b\`.`, `Blocked by blocker \`a\` (resolved 2026-10-18).`, `Blocked by blocker \`a\`, resolved 2026-10-18.`, `Waiting on blocker \`a\` to ship.`, `Parked until blocker \`a\` has been resolved.` (two-word verb after `has`), `Blocked by blocker \`a\` — now resolved.` all classify `held`; on main each was released by the `namedAll.length === 0` gate. Step 2.4 requires the resolved name to suppress the hold that names it; these holds name only it and are not suppressed, stranding the step in `held` with no open blocker to clear. Fails safe, but it is a class change from main that AC-6 only measured over today's estate. | deferred | carried to agents/roadmaps/road-to-prose-holds-that-read-their-object.md finding 2 (in this change); fails safe — never releases a live hold |
| 3 | medium | agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md:91 | The AC-6 evidence for step 2.5 says the `--json` before/after diff was taken "after the R2 round-1 parser fixes", but the shipped parser and tests carry later changes (test comments cite R2 rounds 2 and 5: `RESOLVED_AFTER_RE` tightening, `citationRe` whole-object rule, the `Parked until`/`On hold until` release forms). The record does not state that the zero-difference estate diff was re-run against the final code, so the AC-6 claim the archive closes on is not evidenced for the code under review. | accepted-risk | the --json estate diff was re-run on the final parser code (ffa7dd2562): 31 entries both sides, zero differences, same next; stated in the PR body |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
