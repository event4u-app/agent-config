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

- [ ] **1.1 Choose the mechanism, and record the choice with its cost.** The
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
- [ ] **1.2 Fix the coverage instability before any mechanism depends on it.**
      Whatever 1.1 picks, a rotation whose worst-case cycle exceeds the window
      makes it unsatisfiable. The re-basing start offset is the cause; a
      schedule stable under suite-count change is the fix.
      verify: a test that grows the suite list across simulated weeks — not a
      loop over static totals — and asserts worst-case staleness stays inside
      the window. It must be shown red against the current scheme first.
- [ ] **1.3 Bound the spend the chosen mechanism implies.** The rotation makes
      paid calls, measured at roughly 9.5 queries per suite. Any batch increase
      multiplies the weekly bill, and `required_batch` as proposed had a floor
      and no ceiling — 500 suites would have produced ~437 calls a week.
      verify: a stated ceiling, and the weekly call count derivable from the
      code without running it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Someone bumps the 39 dates to clear the red | implementation | It is a one-line edit per file and it makes a required-looking gate green instantly. It also asserts 39 evaluations that never ran — the exact defect the corpus-refresh roadmap was created to stop, in a second place | Fact 1 above states plainly that no writer exists, so a bumped date is provably an assertion rather than a record; 1.1 forces the mechanism question instead of the symptom | Phase 1 — Decide what freshness is evidenced by |
| 2 | The gate is quietly deleted as "unenforceable" | product | It is local-only and blocks no merge, so removing it costs nothing today and loses the trigger-regression lock the suites exist for | 1.1 lists retirement as an explicit option with its cost named, so dropping the measure becomes a recorded decision rather than a cleanup | Phase 1 — Decide what freshness is evidenced by |
| 3 | A mechanism is built on rotation results that still are not durable | implementation | Fact 2 is easy to miss: the results directory exists locally and looks persistent, but in CI it is an ephemeral artifact and the job has read-only contents permission | 1.1's verify demands the cost be recorded, and the CI write path is the cost; 1.2 is sequenced before any dependency on the rotation | Phase 1 — Decide what freshness is evidenced by |

## Acceptance Criteria

- [ ] AC-1 — A reader can name, from the tree alone, what makes a trigger suite
      "fresh" and which mechanism produces it; or the freshness dimension is
      gone and `check_trigger_evals` no longer reads a date nothing writes.
- [ ] AC-2 — A growth-simulating test pins the rotation's worst-case staleness
      inside the enforced window, and has been observed red against the scheme
      it replaces.
- [ ] AC-3 — The weekly paid-call count of the rotation is derivable from the
      code and bounded by a stated ceiling.
