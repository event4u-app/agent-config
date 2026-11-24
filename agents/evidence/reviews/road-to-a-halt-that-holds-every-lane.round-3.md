# Findings: road-to-a-halt-that-holds-every-lane
<!-- completion-review: v1 | reviewed: 2026-11-23 | scope: e745941777217d213d78c70af68042fbcffbd4738a82f6d54c4ba6f4891b9132 | diff: 7a66b95e91b084da7e12252eaec76a8009f28556 | reviewer: r2-fresh-subagent-road-to-a-halt-that-holds-every-lane | prompt_hash: 6b869aff14dd428f6f17ec6681611a156d824646fcd27f9af6eb0598b2701d50 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-a-halt-that-holds-every-lane"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-11-23 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 7a66b95e91b084da7e12252eaec76a8009f28556
  scope_hash: e745941777217d213d78c70af68042fbcffbd4738a82f6d54c4ba6f4891b9132
  roadmap: agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
  roadmap_hash: d915ff573b787f1b961fc5dfe09d9ff0ea20ea53f63ed01155ac39a9345706b4
  ac_hash: 3d6f38a97dcb40e0df525dc905f58db464a09baef2869720116662ddc6d84bdf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-11-23T19:38:46Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/roadmap_drain_queue.ts:296 | Step 2.4 requires that "the resolved name suppresses only the hold that names it", but `namesResolved` is computed per sentence, so every dependency hold in a sentence that mentions a resolved blocker is released, including holds on something else. Probe: "Still blocked by the host binary, and blocker `settled` has resolved." and "Blocked by the host binary (blocker `settled` is resolved)." both screen `runnable` while the host-binary hold is live; the same text split by ";" screens `held`. Not a regression against main (main also read these as runnable), but the requirement in 2.4 is checked [x] and is not met for dependency holds, which is risk-register item 2. | fixed | a resolved blocker releases only a dependency hold that cites it ("by blocker `x`", "(blocker `x`)", "see blocker `x`"); a ref that is its own subject ("blocker `x` has resolved") cites nothing — two fixtures |
| 2 | medium | src/scripts/roadmap_drain_queue.ts:405 | Dropping the `namedAll.length === 0` guard lets `phaseHeld` override a resolved blocker. The phase blockquote check at :360 calls `proseHold(line)` with no resolved refs, so a phase blockquote "> Blocked by blocker `settled`." still holds the phase after `settled` resolves. A step in that phase whose continuation names `settled` was `runnable` on origin/main and is now `held`: the probe gives `[runnable, held]` on main and `[held, held]` on the branch. A correctly classified step changes class, which is what AC-6 forbids. The live estate has no instance, so the 2.5 diff could not catch it, and no test covers it. | fixed | the phase blockquote is judged with the resolved local blockers — fixture "phase blockquote citing a resolved blocker" |
| 3 | medium | src/scripts/roadmap_drain_queue.ts:406 | The inline comment "A resolved named blocker releases only the clause that names it" is false. The release is sentence-scoped, as `proseHold`'s own docstring at :289-290 says, and an owner hold is never released, so the comment misdescribes the very rule finding 1 is about. | fixed | comment now says "the dependency hold that cites it" |
| 4 | low | tests/scripts/roadmap_drain_queue.test.ts:456 | Finding 1 is about the dead-lane re-dispatch (the `resume` bucket), but neither the halted `buildQueue` test nor the settings-file test builds a `resume` entry (no dead claim). They use only `continue` and `start` entries, so the path the roadmap names is covered only because the halt loop clears every entry, not by an assertion. | fixed | halt test over a dead-lane `resume` entry added |
| 5 | low | src/agent-src/contexts/execution/process-full-all.md:84 | The re-dispatch step says to read the entry for "`dispatchable: false` with `dispatch_hold: …`". `dispatch_hold` is a queue-level JSON field, not an entry field, and the text output prints neither literal (it shows the `HALTED —` line and a missing `▶`). The instruction holds for `--json` only, and the doc does not name that flag. | fixed | process-full-all names the `--json` fields (entry `dispatchable`, top-level `dispatch_hold`) and the text `HALTED —` line |
