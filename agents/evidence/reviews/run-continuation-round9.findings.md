# Findings: run-continuation-round9
<!-- completion-review: v1 | reviewed: 2026-08-19 | scope: 255299709d3bc8ae3fefa1d091726e0dcc0c05ccde9587f33a3b3dae2e6bffc1 | diff: 42e8c056aceb9953e45d6e572e8d28f43f0a8a6c | reviewer: r2-fresh-subagent-run-continuation-round9 | prompt_hash: e04477b983a507a8737a093abd49efbf4f7296806a37d34862c0a239f689d5fe -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-19 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 42e8c056aceb9953e45d6e572e8d28f43f0a8a6c
  scope_hash: 255299709d3bc8ae3fefa1d091726e0dcc0c05ccde9587f33a3b3dae2e6bffc1
  roadmap: agents/roadmaps/later/road-to-run-continuation-observation.md
  roadmap_hash: abdd73cba7628538a7fa135ac4d8b9092ee3d4b0baaab22a2235999215039d73
  ac_hash: bb34537a4ce90a2ac144c0346d9d3817fc8ddd788722900f17cdb6b7ed59bea7
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-19T20:50:09Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/hooks/run_continuation_hook.ts:1436 | The `blocked` terminal keeps the state file on the stated premise that "a later run carries a different run id and therefore a different keyed state file, so there is nothing to reclaim it FOR". That premise is false: `runId = deriveSessionKey(sessionId)` (:1087) is a hash of the SESSION id, constant for the whole session, so a re-claim of the same roadmap in the same session -- the case rounds 6 and 7 exist for -- resolves to the SAME keyed file. Two consequences. The spent `iterations` carry over, and because `ladder` tests the iteration cap AFTER the blocked/complete rung (:494 before :495), a re-claim whose blocker has since cleared and whose retained count is >= MAX_ITERATIONS emits `halt-max-iterations` without engaging once -- the never-engaged halt line round 6 finding 2 closed. And the retained `blocked_reported` suppresses the second exhaustion line, giving a NON-halt outcome halt-like permanence, which is what ADR-235's blocked-is-not-a-halt framing denies. `complete` clears (:1433) for exactly this reason. | fixed | 5fd366f83 |
| 2 | medium | src/scripts/hooks/run_continuation_hook.ts:623 | `clearRunState` reuses the legacy-file ADOPTION predicate (`readRunState`:568) as a DELETION predicate, and the two need opposite defaults on the unknown case. Adoption is permissive when `legacy.roadmap` is absent, deliberately, so an upgrade does not drop a live budget; deletion inherits that permissiveness and removes a per-session legacy file that carries no slug -- and a file with no slug is adoptable by EVERY roadmap in the session. So slug B reaching `complete` (or the absent-confirm at :1211) deletes a pre-`roadmap`-field legacy file that may hold slug A's budget or halt stamp, reinstating the "a halt must NOT clear it" leak round 7 finding 3 closed, and contradicting both the docblock's claim that the adoption condition enforces "another roadmap's legacy file is still not ours to delete" and the comment it replaced. The new dispatch test pins the over-broad case: its legacy fixture is written with no `roadmap` field. | fixed | 5fd366f83 |
| 3 | medium | src/config/estate-count-budget.json:133 | The appended history row records `open_blockers: 70` and its `why` argues "open_blockers is unchanged at 70 by construction -- which is the check that this is a park and not a burial". The three rows immediately above it record 71 (:112, :119, :126), so on the ledger's own chain the number steps DOWN by one in the same move that parks a roadmap carrying exactly one open blocker (`three-phase-contract-run`, which the same `why` asserts is "still open and still counted"). Nothing reconciles the -1: the predecessor row restated its active/later figures at merge and left blockers untouched. The unchanged-blocker count is the entry's only proof that this is a transfer rather than a burial, and a -1 here is numerically indistinguishable from the burial the metric was widened to active+later to catch. | fixed | 11c5aeffa |
| 4 | low | src/scripts/hooks/run_continuation_hook.ts:1186 | The two once-guards for `halt-roadmap-absent` now have different granularity for the same rung. With a readable state, `delete state.absent_fires` (:1374) resets the counter on any healthy fire, so the line is emitted once per absence EPISODE -- which is the behaviour round 8 finding 1 asked for. With `driven === null` the guard is `absentAlreadyLogged`, which scans an append-only ledger for a (run_id, roadmap) match and can never be reset, so it is once per RUN for the life of the ledger: a second absence episode on a state that stays unparseable across the recovery emits nothing, the same silence finding 1 objected to. The header ladder (:44) still documents a single unqualified ONCE for this rung. | fixed | 5fd366f83 |
| 5 | low | src/scripts/hooks/run_continuation_hook.ts:418 | Blockedness is decided by a bare substring test, `body.includes('blocked-by:')` over the step's own line, while the coupling paragraph this diff adds to `roadmap-process-loop.md` specifies the marker as `<!-- blocked-by: <id> -->`. The looseness predates the diff but its blast radius does not: before this change a false match only shrank the open count, and now it also flips the terminal outcome from `complete` to `blocked` and, per finding 1's branch, stops the state file being cleared. A step line that merely mentions the token in prose or a link therefore mis-reports the run's ending and leaves the budget behind. | fixed | 5fd366f83 |
| 6 | low | src/scripts/hooks/run_continuation_hook.ts:968 | `absentAlreadyLogged` ignores the `fs.readSync` return value and decodes the whole pre-allocated buffer, so a short read -- or the ledger being truncated or rotated between `statSync` (:962) and the read -- leaves NUL padding in the tail. Those lines fail `JSON.parse` and are skipped by the `catch { continue }`, producing a false negative that re-emits exactly the line this guard exists to suppress. The docblock (:168) also states both that the line "is always within a few lines of the end" and that the cap is not "expressing a belief about where the line is". | fixed | 5fd366f83 |
| 7 | low | src/scripts/hooks/run_continuation_hook.ts:475 | `blockedCount = 0` gives the new ladder input a default that silently reproduces the defect it was added to fix: any caller that omits it gets `complete` on a roadmap whose only open steps are blocked, which is round 8 finding 3 verbatim. There is exactly one production caller, so nothing is bought by the default. A required parameter -- or passing the whole `ScanResult`, since `open` and `blocked` come from the same scan and are never meaningfully independent -- makes the regression a compile error instead of a silent one. The parameter is also inserted BEFORE the existing `caps` argument, so any positional `caps` call site would now bind to the wrong slot. | fixed | 5fd366f83 |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->


## Where round 9 leaves this

Nine rounds, **70 findings**: 9, 7, 8, 7, 11, 7, 6, 8, 7.

**Every finding in this round is a defect in the previous round's fix**, which is
the sharpest form the pattern has taken. Round 8 closed with the observation that
six of seven highs had that property; here it is seven of seven, and the high is a
premise I wrote in a comment — "a later run carries a different run id" — that was
false about the code three lines above it.

Two things are worth separating from the rest, because they are not the same kind
of finding.

Finding 3 is not about this branch's code at all. It surfaced an unreconciled −1
in the estate ratchet's history that commit 7d5114dbd introduced by walking a
baseline without appending its row. The review found it because this change had to
write a neighbouring row; nothing else would have looked.

Finding 7 is the reviewer catching a defence that had been weakened while being
added: `blockedCount = 0` gave every future caller the exact behaviour the
parameter existed to prevent. A default argument is the cheapest possible way to
reintroduce a fixed bug, and it was one edit away from shipping.

**The size ratchet is the finding no reviewer produced.** These fixes plus round
8's grew the concern from 1,499 to 1,568 lines against a 1,500-line ceiling, and
`check_source_size_budget` plus its companion test went red on the pushed commits.
That gate's own note already records this exact shape happening once before — an
R2 fix pass growing an over-ceiling file — and prescribes the answer: condense or
extract, never re-pin. Condensed, back to 1,499, ratchet at baseline. The
round-by-round narration those comments carried is in these artefacts, which is
where it is durable and where it costs no ceiling.

**What nine rounds now establish, and it is a different claim from round 8's.**
Round 8 said the rate was flat-to-rising and that nothing predicted a ninth round
would find fewer. Nine found seven, so the rate did not fall — but the finding
COMPOSITION changed: no medium or high in this round touches the concern's original
behaviour, only the repairs. That is what a review loop looks like when the
remaining defects are being manufactured by the repairs themselves, and it is the
strongest argument available that a tenth round would measure this branch's
restructuring rather than the mechanism.
