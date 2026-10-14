<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-14, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Three closed criteria of a parked roadmap lost the code their evidence exercised

You are deciding one question about the parked roadmap
`agents/roadmaps/later/road-to-adversarial-verification-and-long-runs.md`.
Answer on the evidence below. Do not summarise the evidence back.

## What happened, in order

1. The roadmap closed three items on 2026-09-13/14, each with a fixture in
   `tests/e2e/adversarial-verification-fixtures.test.ts`:
   - **8.1 "States, and one forbidden ending."** Text: *"`run_continuation_hook.ts`
     treats a PR below its delivery target as work remaining, so a run cannot end
     with red CI or a stale target while its checkboxes read complete."* Verify
     line: *"fixture `T7` — a run whose checkboxes are complete but whose CI is
     red does not end; `T8` — the same run without a grant ends open-green and
     says so."* Landed in `_lib/continuation_ladder.ts` (`DELIVERY_STATES`,
     `DELIVERY_ENDINGS`, `deliveryBlocksCompletion`).
   - **AC-1** "`T1`-`T10`, `G8` and `G9` exist under `tests/e2e/` and are green."
   - **AC-7** "a throttled four-phase long-run fixture ends merged, with one
     continuity resume and zero owner asks." Its fixture composed two modules:
     `continuation_ladder` bounding ONE run (25 iterations, four hours) and
     `mission_record` carrying the mission across runs.
2. PR #2336 withdrew the run-continuation hook concern on its own
   pre-registered kill date (`run_continuation_hook.ts`, 1,524 lines, and its
   tests deleted). The ladder module was retained at that point.
3. PR #2343, on an owner decision of 2026-10-14, removed
   `_lib/continuation_ladder.ts` as well. Fixture cases whose subject was the
   ladder were deleted with it: the whole `T7`/`T8` describe (7 `it`s), 2 of 5
   `T1` cases, 6 of 9 `AC-7` cases, and one assertion in `T6` comparing a
   twelve-hour gap to `WALL_CLOCK_CAP_MS`. An independent L1 pass confirmed
   every removed assertion exercised a symbol that no longer exists.
4. What remains green: `T1`'s test-delta and same-session cases; `T6`'s resume
   assertion; `AC-7`'s mission-record half (the record survives the boundary,
   one resume twelve hours later re-asks nothing, a record without decisions
   closes nothing). `T2`-`T5`, `T9`, `T10`, `G8`, `G9` are untouched.
5. What is no longer exercised by any code: the delivery state machine of 8.1
   (it survives only as prose in the `process-full` command contract), and
   AC-7's claim that a run is bounded while the mission is not (no run bound
   exists in code).
6. PR #2343 left all three items `[x]` and appended at each a note: the
   removal happened, which fixture cases left, and that *"whether this item
   stays closed on prose alone is the owner's to settle when the roadmap
   wakes"* (8.1) / *"reopening this criterion is the owner's call"* (AC-7).

## The parking state

The roadmap is in `agents/roadmaps/later/` with `status: later`. Its recorded
wake condition names two things, neither related to the ladder: AC-4 needs an
owner edit to a kernel rule that a fail-closed guard refuses to agents, and
AC-6 needs the blocker `daemon-host-kill-switch` (Class 3, human-only, status
`open` as of today) decided. Neither has happened. `review_by: 2027-01-08`.

## Who may decide what

The repository's preservation test: a council may resolve a disposition only
where it keeps the item alive in the active estate (fix now, carry into a named
follow-up created in the same change, merge into existing work that covers it,
restore to `[ ]`, or leave/annotate it). Converting to cancelled, weakening the
criterion, cutting its scope, or accepting a loss permanently is owner-reserved
and must not be decided here. If you conclude an item is moot, say so as a
question for the owner rather than as a disposition.

## Options

- **(a)** Leave all three exactly as they are: `[x]` with the 2026-10-14 notes,
  parked, decided by the owner at wake.
- **(b)** Rewrite the three to the post-ladder reality and keep them parked —
  for example restore an item to `[ ]` because its evidence no longer exists,
  or reword its verify line to name what is actually exercised today — without
  changing what the criterion requires.
- **(c)** Un-park the roadmap and restore the items to active work.
- **(d)** Something else that keeps the items alive (name it).

Answer per item (8.1, AC-1, AC-7) if your answer differs between them. For each
answer, state whether it is council-decidable under the preservation test above
or must go to the owner, and what would change your answer.
