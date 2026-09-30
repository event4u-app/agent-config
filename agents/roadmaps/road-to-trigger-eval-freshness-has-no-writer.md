---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  Nothing in the active estate can be archived to pay for this one. It records a
  defect found while dispositioning PR #2078 — a freshness gate reading a field
  no code writes — and the alternative to adding it is dropping the finding,
  which is the outcome the ratchet is not trying to buy. It ships as a draft, so
  it is already excluded from the dashboard and from /roadmap:process-* until a
  maintainer promotes it.
---
# Road to trigger eval freshness has no writer

> **Source:** an independent completion review of PR #2078 on 2026-09-27, plus
> two measurements taken against this tree while dispositioning it. The PR
> proposed to fix `check_trigger_evals` by resizing the rotation batch; the
> review refuted its premise and the author's own re-measurement confirmed both
> findings. The PR was closed unmerged rather than patched, because every
> correction to it would still have left the gate exactly as red. This roadmap
> records what is actually wrong.

## Goal

`check_trigger_evals` either measures something a mechanism produces, or it
stops claiming to. Today it reads a field that nothing writes, so the only way
to satisfy it is to hand-edit a date asserting an evaluation happened — which is
the fabrication pattern this repository forbids everywhere else. When this is
finished, a reader can name the mechanism that makes a suite "fresh", and that
mechanism is something that ran, not something someone typed.

## Context — three measured facts

1. **`last_eval` has no writer.** Across `src/scripts/`, the string appears in
   exactly two files, `check_trigger_evals.ts` and `lint_eval_freshness.ts`, and
   both only read it. `skill_trigger_eval` — the interactive paid CLI everyone
   assumes bumps it, this roadmap's author included — writes its *result* file
   and never touches `triggers.json`. So a paid backfill of all 39 stale suites
   would not move the gate by one day.
2. **The rotation cannot help as built.** `trigger_eval_rotation.ts` contains no
   reference to `last_eval`; it writes results to an out-dir the canary uploads
   as an Actions artifact under `permissions: contents: read`. Nothing durable
   and repo-accessible survives the run, so the gate has nothing to read even if
   it were rewritten to prefer evidence over a date field.
3. **The rotation's coverage is not stable under growth.** Simulated against
   `pick_rotation` + the batch derivation proposed in #2078: with the suite list
   growing by one every four weeks, worst-case staleness reaches **133 days**
   against a 90-day window; every eight weeks, 98 days. `start = (week * batch)
   % total` re-bases whenever `total` changes, so a region can be skipped
   repeatedly. A static-total test cannot observe this — #2078's could not.

The AI council (2026-09-27, 2 of 2 seats) preferred making the gate read
rotation *evidence* over having CI write the date field, and both seats named
the durability precondition fact 2 shows is unmet.

## Phase 1 — Decide what freshness is evidenced by

- [ ] <!-- blocked-by: freshness-mechanism-is-owner-owned | asked: yes — surfaced to the owner 2026-09-30 with the arithmetic below; the four options are recorded and priced, the choice is not the agent's --> **1.1 Choose the mechanism, and record the choice with its cost.** The
      live options are: make rotation results durable and repo-accessible and
      have the gate read them; have CI write `last_eval` after a *completed*
      run (noting that a completed-but-floor-breaching run is still fresh
      evidence, so "successful" is the wrong predicate); or retire the freshness
      dimension and keep only the offline structural smoke check. Each costs
      something different — the first two need a CI write path into a
      protected-branch repo, the third gives up the measure.
      verify: a `## Decisions` row on this roadmap carrying the contract columns
      `| ID | ownership | resolved by | decision | evidence | revisit if |`,
      naming which was chosen and what it costs.
      **PRICED 2026-09-30, NOT CHOSEN — and the option list was incomplete.**
      Every option is now costed against a measured suite count, and the
      measurement corrects a number this roadmap carried: the tree holds **102**
      trigger suites, not the 39 the Context section names. 39 is the count of
      *stale* suites; the full list is what a cycle has to cover. At ~9.5
      queries each a full pass is **~1020 queries**, which is the figure every
      option below is a way of paying or not paying. See `## Blockers` →
      `freshness-mechanism-is-owner-owned` for the four options and their prices.
- [x] **1.2 Fix the coverage instability before any mechanism depends on it.**
      Whatever 1.1 picks, a rotation whose worst-case cycle exceeds the window
      makes it unsatisfiable. The re-basing start offset is the cause; a
      schedule stable under suite-count change is the fix.
      verify: a test that grows the suite list across simulated weeks — not a
      loop over static totals — and asserts worst-case staleness stays inside
      the window. It must be shown red against the current scheme first.
      **DONE 2026-09-30.** `tests/scripts/trigger_eval_rotation_growth.test.ts`
      grows the list by one suite every four and every eight weeks across 260
      simulated weeks and asserts worst-case staleness stays within the 12-week
      window. **Observed red first, at 24 weeks** — worse than the 133 days this
      roadmap's own fact 3 simulated, because a five-year run reaches a worse
      case than a shorter one. `pick_rotation` now takes a suite's slot from a
      hash of its own name, so adding a suite shifts nobody else and worst-case
      staleness is the cycle length by construction. A test pins exactly that
      property: growing the list leaves every existing suite's schedule
      unchanged.
- [x] **1.3 Bound the spend the chosen mechanism implies.** The rotation makes
      paid calls, measured at roughly 9.5 queries per suite. Any batch increase
      multiplies the weekly bill, and `required_batch` as proposed had a floor
      and no ceiling — 500 suites would have produced ~437 calls a week.
      verify: a stated ceiling, and the weekly call count derivable from the
      code without running it.
      **DONE 2026-09-30.** `MAX_WEEKLY_QUERIES = 160`, and `rotation_plan()` is
      a pure function returning the peak week's suite count, its query cost, the
      worst-case staleness the cycle promises, and whether the list is under the
      ceiling — so the weekly bill reads off the code. A test asserts the live
      list is under it; another asserts a 1000-suite list reports
      `withinCeiling: false` rather than billing silently.
      **The ceiling is set from measurement, and the measurement carries a
      finding.** At 102 suites a 90-day window costs ~85 queries a week on
      average and 140 in the busiest week (hash spread). The scheme this
      replaced billed only ~50 a week — because `batch = 5` over 102 suites is a
      **21-week cycle, missing the 90-day window by 57 days**. Its cheapness was
      the defect showing, not a budget worth preserving. No schedule can make
      `N × 9.5` queries per 90 days smaller; only changing N or the window can.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Rotate by suite identity — a suite's slot is a hash of its own name — rather than by a positional window whose start re-bases on `total`. Cost: the batch stops being a tunable knob; how many suites run in a week follows from the hash spread and `rotation_plan` reports it. | `trigger_eval_rotation_growth.test.ts`, observed red at 24 weeks against the old scheme and green at ≤12 after; a second test pins that adding a suite leaves every existing suite's schedule unchanged | a scheme is found that is both stable under growth and gives an even weekly load — identity slotting buys stability at the price of an uneven bill, and that trade is not obviously optimal |
| D2 | reversible-technical | evidence | State the weekly paid-call ceiling as `MAX_WEEKLY_QUERIES = 160` and make the bill derivable from `rotation_plan()` without a run. | measured at 102 suites: ~85 queries/week mean, 140 in the peak week; reds at roughly 117 suites | the suite count approaches 117, or `QUERIES_PER_SUITE` is re-measured away from ~9.5 |
| D3 | business-owned | owner | **OPEN.** Which mechanism evidences freshness — see `## Blockers` → `freshness-mechanism-is-owner-owned`. Priced, not chosen. | the ~1020-queries-per-pass arithmetic below | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Someone bumps the 39 dates to clear the red | implementation | It is a one-line edit per file and it makes a required-looking gate green instantly. It also asserts 39 evaluations that never ran — the exact defect the corpus-refresh roadmap was created to stop, in a second place | Fact 1 above states plainly that no writer exists, so a bumped date is provably an assertion rather than a record; 1.1 forces the mechanism question instead of the symptom | Phase 1 — Decide what freshness is evidenced by |
| 2 | The gate is quietly deleted as "unenforceable" | product | It is local-only and blocks no merge, so removing it costs nothing today and loses the trigger-regression lock the suites exist for | 1.1 lists retirement as an explicit option with its cost named, so dropping the measure becomes a recorded decision rather than a cleanup | Phase 1 — Decide what freshness is evidenced by |
| 3 | A mechanism is built on rotation results that still are not durable | implementation | Fact 2 is easy to miss: the results directory exists locally and looks persistent, but in CI it is an ephemeral artifact and the job has read-only contents permission | 1.1's verify demands the cost be recorded, and the CI write path is the cost; 1.2 is sequenced before any dependency on the rotation | Phase 1 — Decide what freshness is evidenced by |

## Blockers

### blocker: freshness-mechanism-is-owner-owned
- **Status:** open
- **Owner:** maintainer
- **Ownership:** `business-owned`
- **Class:** 3 — human-only
- **Blocks:** step 1.1 and AC-1. Steps 1.2 and 1.3 are closed and depend on no
  option below — the schedule and the ceiling are mechanism-independent, which
  is what 1.2's own wording asked for.
- **Question:** a 90-day freshness window over 102 trigger suites costs ~1020
  provider queries per pass, whatever the schedule. Is that worth paying, and
  through which mechanism?
- **The arithmetic, because it is what makes this a decision rather than a
  design task.** 102 suites × ~9.5 queries = ~1020 per full pass. Spread over a
  90-day window that is ~85 queries a week, 140 in the busiest week. No
  scheduling change moves that number; only changing the suite count or the
  window does. The scheme replaced on 2026-09-30 billed ~50 a week and looked
  affordable **because it never finished a pass** — `batch = 5` over 102 suites
  is a 21-week cycle against a 12-week window.
- **Options, priced:**
  1. **Durable rotation results, gate reads them.** The AI council's stated
     preference (2026-09-27, 2/2 seats). Cost: ~85 queries/week sustained, plus
     a CI write path into a protected-branch repository — a permissions change
     on the branch-protection surface, which is Hard-Floor under
     `non-destructive-by-default`.
  2. **CI writes `last_eval` after a completed run.** Same ~85 queries/week and
     the same write-path cost. Note the predicate: a completed-but-floor-
     breaching run is still fresh *evidence*, so "successful" is the wrong test.
  3. **Retire the freshness dimension**, keep the offline structural smoke
     check. Cost: zero queries, and the trigger-regression lock the suites exist
     for stops being measured over time. Risk 2 of this register is exactly this
     outcome arrived at by accident; chosen deliberately it is a different thing.
  4. **Lengthen the window** — NOT in this roadmap's original option list, added
     2026-09-30 because the arithmetic makes it the only lever that keeps a real
     measure and lowers the bill. 180 days halves the weekly cost to ~43 and
     keeps every other property; it says a trigger regression may go unnoticed
     for six months instead of three.
- **Recommendation:** none offered. Three of the four options trade money
  against detection latency and the fourth gives up detection, and nothing in
  the tree establishes which the owner wants. Naming a preference here would be
  the agent deciding a recurring external spend, which is what `business-owned`
  exists to prevent.
- **If you do nothing:** `check_trigger_evals` keeps reading a `last_eval` field
  no code writes, so the only way to make it green stays a hand-edited date —
  the fabrication pattern this roadmap was created to stop.
- **What to do:**
  1. Re-read the arithmetic above and pick one of the four options. The numbers
     are current as of 2026-09-30; re-measure the suite count first with
     `npx tsx -e "import('./src/scripts/trigger_eval_rotation.js').then(m => console.log(m.rotation_plan(m.list_trigger_suites())))"`,
     which prints the count, the peak week and the weekly query cost.
  2. Write the choice into this roadmap's `## Decisions` row `D3`, replacing
     `OPEN` with the option and its cost.
  3. Then implement it: options 1 and 2 need a workflow permissions change on a
     protected branch, which is Hard-Floor and stays the maintainer's; option 3
     removes the `last_eval` read from `check_trigger_evals.ts`; option 4 raises
     `MAX_AGE_DAYS` there and `ROTATION_CYCLE_WEEKS` in
     `src/scripts/trigger_eval_rotation.ts` together, since a cycle longer than
     the window is the defect 1.2 just removed.
- **Resolved when:** `grep -c 'OPEN' agents/roadmaps/road-to-trigger-eval-freshness-has-no-writer.md`
  no longer matches the `D3` row — that row names one of the four options — and
  the tree agrees with it: either a mechanism writes what the gate reads, or
  `check_trigger_evals.ts` no longer reads a date nothing writes.

## Acceptance Criteria

- [ ] <!-- blocked-by: freshness-mechanism-is-owner-owned | asked: yes — priced and put to the owner 2026-09-30; the mechanism is a recurring-spend choice, not an agent one --> AC-1 — A reader can name, from the tree alone, what makes a trigger suite
      "fresh" and which mechanism produces it; or the freshness dimension is
      gone and `check_trigger_evals` no longer reads a date nothing writes.
- [x] AC-2 — A growth-simulating test pins the rotation's worst-case staleness
      inside the enforced window, and has been observed red against the scheme
      it replaces.
      **MET 2026-09-30.** `tests/scripts/trigger_eval_rotation_growth.test.ts`
      grows the suite list across 260 simulated weeks at two growth rates and
      asserts worst-case staleness stays within 12 weeks. It was observed red
      against the positional scheme at **24 weeks** before the replacement, so
      its sensitivity is demonstrated rather than assumed.
- [x] AC-3 — The weekly paid-call count of the rotation is derivable from the
      code and bounded by a stated ceiling.
      **MET 2026-09-30.** `rotation_plan()` is pure and returns the peak week's
      suite count, its query cost, the worst-case staleness and whether the list
      is under `MAX_WEEKLY_QUERIES = 160`. Two tests: the live list is under the
      ceiling, and a 1000-suite list reports `withinCeiling: false` rather than
      billing silently.
