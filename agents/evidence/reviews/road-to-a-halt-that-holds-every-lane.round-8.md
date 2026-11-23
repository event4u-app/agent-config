# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: 74d5b6beb171180951083ee978c957110f8f85da4ac05386a26736e164187f93 | diff: 42eff09d95c5a01f6cba120aed09239fd398a88f | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: b65c11b968dd08c8b1b176a3162215bb7f07116bd53a611f94d01b2acb3790c8 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 42eff09d95c5a01f6cba120aed09239fd398a88f
  scope_hash: 74d5b6beb171180951083ee978c957110f8f85da4ac05386a26736e164187f93
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: af8175100d6e8f597c8ad6f2fb77dea751730b5cf64327530e87f8d1773466bc
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T20:00:46Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/roadmap_drain_queue.ts:214-215 | `citationRe` forms 3 and 4 (`[^.;]*?\(\s*blocker …\)` and `[^.;]*?\bsee\s+blocker …`) accept ANY text between the hold phrase and the citation, so a dependency hold that names a second, unresolved object is released when its citation is a resolved blocker. Probed on 42eff09d: "Blocked on the host binary and the probe (blocker `settled`).", "Waiting on the host binary and the probe, see blocker `settled`.", "Blocked by the host binary until the probe ships (blocker `settled`)." and "Waiting on the host binary for now, see blocker `settled`." all classify `runnable` with `settled` resolved. Step 2.4 requires the resolved name to suppress "only the hold that names it"; here it suppresses a hold that also names the host binary. The function's own doc comment checks only text AFTER the citation, and no fixture covers a second object BEFORE a parenthetical/`see` citation. | fixed | the parenthetical and `see` citation forms are dropped — a citation releases only directly after the hold phrase; both example phrasings and the two former release fixtures now pin `held`; the lost releases (fail-safe) moved to the follow-up roadmap finding 2 |
| 2 | medium | src/scripts/roadmap_drain_queue.ts:194-195 | `RESOLVED_AFTER_RE` refuses `and`/`or`/`both` in the object span but not the other clause conjunctions `CLAUSE_SPLIT_RE` itself recognises (`but`, `while`, `whereas`), so the resolution can attach to a different subject: "It was blocked by the probe but the host, which has since shipped." and "It was blocked by the probe while the doc, which has since landed." both classify `runnable`. The past-tense release slices to sentence end, crossing the clause boundary the parser otherwise respects. | fixed | RESOLVED_AFTER_RE also refuses but/while/whereas in the object — fixture, red before (main held it) |
| 3 | medium | agents/roadmaps/road-to-prose-holds-that-read-their-object.md:37 | Finding 2 of the follow-up roadmap states the parser "Fails safe (held), never releases a live hold"; finding 1 above shows it does release live compound holds via the parenthetical/`see` citation forms. The follow-up's Risk Register and Phase 1 scope are planned on that premise, so the release direction is not carried anywhere. | fixed | follow-up finding 2 rewritten: lists the dropped forms and states the release direction is closed on this branch, which the new fixtures now pin |
