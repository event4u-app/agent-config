# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 51e251ba87c273ddd4cc99e97e079e99608d98641da67e20d5bfab470de657c8 | diff: 55b27d08ccee9469dcecb909cdc1809d196cd915 | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: 8627d1446dd16f409f51c913edc2ea22eaba6028a67c679abe8040a52374f6ec | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 55b27d08ccee9469dcecb909cdc1809d196cd915
  scope_hash: 51e251ba87c273ddd4cc99e97e079e99608d98641da67e20d5bfab470de657c8
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: 8ce78731f198f7e5506bdd1ffbd3512f2962cde0ac44833395d303e8eaa6782b
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T19:31:49Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/roadmap_drain_queue.ts:189 | `RESOLVED_RE` accepts a bare `has since` / `have since` with any verb after it, so a sentence that says the hold continues or came back is read as resolved: "It was blocked by the probe, which has since been reopened." and "…, which has since stalled." both classify `runnable` (probed via `screenRoadmap`). This is the exact false release Risk Register rank 2 names ("could read a still-active hold as resolved and dispatch a step"); no fixture covers a non-resolving `has since`. | fixed | resolution must attach as ", which has (since) <resolving verb>" — fixture "has since been reopened" |
| 2 | high | src/scripts/roadmap_drain_queue.ts:199 | Resolution is judged per sentence, but the hold is judged per clause, and the resolution never has to refer to the held subject. "It was blocked by the probe and the doc has since shipped." reads `runnable`: the `and` clause about an unrelated doc releases the probe hold. The 2.3 contract ("was blocked by … has since shipped") is about the blocker itself; the implementation releases on any resolution verb anywhere in the sentence. | fixed | resolution read only after the hold phrase, as its relative clause — fixture "and the doc has since shipped" |
| 3 | high | src/scripts/roadmap_drain_queue.ts:186 | `NEGATED_BEFORE_RE` lets a negator govern the hold phrase across up to two arbitrary words, so intensifying or temporal negations release live holds: "Not only blocked by the probe but also by the host." -> `runnable`, "Not just waiting on the probe." -> `runnable`, "Not yet dispatched blocked by the probe." -> `runnable`. The window has no stop-list for `only`/`just`/`yet`, and the fixture set only proves the window releases ("Not currently") and that 4+ words hold; nothing tests a 1-2 word window that must NOT release. | fixed | only currently/presently/actually may sit between negator and phrase — fixtures "not only / not just / not yet" |
| 4 | medium | src/scripts/roadmap_drain_queue.ts:201 | A clause that mentions a resolved blocker in backticks is skipped wholesale, including any other hold phrase in that clause. "Owner-reserved until blocker `settled` is reviewed." classifies `runnable` although the owner-reserved hold is independent of the blocker's resolution. AC-5 / step 2.4 say the resolved name "suppresses only the hold that names it"; the suppression granularity is the clause, not the hold phrase, so an owner-reserved hold sharing a clause with the resolved name is still masked. | fixed | suppression per hold phrase whose object is the resolved blocker — fixture "Owner-reserved until blocker `settled` is reviewed" |
| 5 | low | agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md:3 | The archived roadmap still carries `status: ready` in its frontmatter while every step is `[x]` and the file sits in `archive/`; the record's status field contradicts its state. Also AC-6 names a `roadmap_drain_queue --json` before/after diff while the 2.5 result records a `screenEstate` comparison instead — equivalent in substance, but the record does not say the two are the same measurement. | fixed / accepted-risk | 2.5 now records the `--json` before/after diff (zero differences); `status: ready` kept — the archive convention (595 archived roadmaps carry it) |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
