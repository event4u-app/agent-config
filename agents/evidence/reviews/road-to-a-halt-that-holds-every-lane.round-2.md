# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 59c924e25a7d88e312e29e64ea45fccea3a66cbd86da7f77846f751129710f8d | diff: 573020696229f6e7ff10451b12ef8097e8cf16d3 | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: a034d6565a338627865186e96476c0840b1d94aec0983917bee837b988ba1960 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 573020696229f6e7ff10451b12ef8097e8cf16d3
  scope_hash: 59c924e25a7d88e312e29e64ea45fccea3a66cbd86da7f77846f751129710f8d
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: d915ff573b787f1b961fc5dfe09d9ff0ea20ea53f63ed01155ac39a9345706b4
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T19:35:20Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/roadmap_drain_queue.ts:191 | `RESOLVED_AFTER_RE` accepts a resolution verb followed by any qualifier, so a past-tense hold that is still live is released (fail-open, the exact Risk-register item 2): "It was blocked by the upstream fix, which has since merged upstream but is not yet released." and "It was blocked by the probe, which has since been fixed in part; the rest is pending." both screen `runnable` (probed via `screenRoadmap`). The round-1 fixture "has since been reopened" only covers a non-matching verb, not a matching verb with a negating tail. | fixed | the resolution must end the sentence — fixtures "merged upstream but not yet released", "fixed in part" |
| 2 | medium | src/scripts/roadmap_drain_queue.ts:209 | A resolved named blocker now releases a hold only when its reference sits directly after the hold phrase (`^\s*(by\|on)?(the)?blocker \`id\``). "Blocked on the probe (blocker `settled`)." and "Waiting on the probe, see blocker `settled`." with `settled` resolved now screen `held`, where `main` read them `runnable`; this contradicts the stated goal ("held only when a hold is actually still in force") and the retained test "drops a prose hold whose named blocker has resolved" only pins the adjacent form. Such a step drops into `decide` and stays there after its blocker resolves. AC-6's zero-diff estate check shows no live roadmap uses these phrasings today, so no current misclassification. | fixed | a resolved blocker named anywhere in the sentence releases its dependency holds; owner holds stay — fixtures "(blocker `settled`)", "see blocker `settled`" |
| 3 | low | src/scripts/roadmap_drain_queue.ts:187 | `NEGATED_BEFORE_RE` also matches "or not", so "Whether or not blocked by the probe, the step waits." screens `runnable` (fail-open, but a contrived phrasing). In the other direction it misses contracted negations other than "isn't" ("wasn't/aren't/doesn't blocked by"), which fail closed (held). Behaviour is inconsistent with the comment's claim that only an adverb may sit between the negator and the phrase. | fixed | "or not" excluded, contractions added — fixture "Whether or not blocked by" |
| 4 | low | src/scripts/roadmap_drain_queue.ts:209 | A fresh `RegExp` is compiled for every resolved ref on every hold-phrase match inside the sentence/clause loop; could be built once per `proseHold` call. Minor inefficiency, no behaviour change. | fixed | refs built once per proseHold call; no per-match RegExp remains |
