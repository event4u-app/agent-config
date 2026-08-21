<!-- evidence-type: analysis -->

# PR drain run — 2026-08-20/21

One autonomous run, driven by a merge queue. Scope: every open PR in this
repository at the time of each recompute, merged one at a time, each synced onto
the `main` that the previous merge had just moved.

**Result: 28 merged, 1 closed as superseded, 1 deferred with a written
diagnosis, 9 arrived after the cutoff and were not processed.**

The run held one rule above throughput, and it is the reason several rows below
say "transferred" or "abandoned" rather than "done": a count that falls is not
the same as work that finished, and the estate ratchet entry for each PR says
which of the two happened.

## Merged

Every SHA is the merge commit on `main`. "Conflicts" lists the files that
actually collided, not the files changed.

| # | PR | Sync conflicts | Resolution class | CI iters | Disposition |
|---|---|---|---|---|---|
| 1 | #1493 | none (already carried `main`) | — | 2 | merged `9b7934e6c` |
| 2 | #1488 | roadmaps-progress.md · stubs/README.md | regenerated · union-into-existing-table | 1 | merged `46837f58b` |
| 3 | #1480 | roadmaps-progress.md · stubs/README.md | regenerated · union | 1 | merged `b593d8c00` |
| 4 | #1489 | + estate-count-budget.json | regenerated · union · history-append | 2 (1 flake) | merged `d0fad2ccd` |
| 5 | #1482 | dashboard · stubs/README · estate budget | regenerated · union · history-append | 1 | merged `52cfb4bb8` |
| 6 | #1499 | dashboard · estate budget | regenerated · history-append | 1 | merged `dd6a14406` |
| 7 | #1490 | dashboard · estate budget · gate-violation-baselines | regenerated · history-append · stricter-per-key | 1 | merged `b7cc06305` |
| 8 | #1486 | dashboard · estate budget | regenerated · history-append | 1 | merged `727968f4a` |
| 9 | #1466 | estate budget | history-append | 1 | merged `12be7797f` |
| 10 | #1491 | stubs/README · estate budget | union · history-append | 1 | merged `b98782be3` |
| 11 | #1485 | stubs/README · estate budget | union · history-append | 1 | merged `85bc03950` |
| 12 | #1496 | gate-violation-baselines | stricter-per-key | 1 | merged `58113432e` |
| 13 | #1475 | dashboard · archive/INDEX.md · archive/index.json | all regenerated | 1 | merged `4b4aa1721` |
| 14 | #1471 | dashboard · both archive indexes | regenerated | 1 | merged `ac723a675` |
| 15 | #1476 | dashboard · both archive indexes | regenerated | 1 | merged `3adb070f3` |
| 16 | #1483 | dashboard · both archive indexes | regenerated | 1 | merged `c50ce5a0d` |
| 17 | #1500 | dashboard · both archive indexes | regenerated | 1 | merged `488ac89e5` |
| 18 | #1477 | dashboard · both archive indexes | regenerated | 1 | merged `99b45c957` |
| 19 | #1468 | round6-review.md · dashboard | two-true-edits · regenerated | 1 | merged `9f57a4a2d` |
| 20 | #1498 | dashboard · both archive indexes | regenerated | 2 | merged `07b0ca82c` |
| 21 | #1481 | dashboard · both archive indexes | regenerated | 1 | merged `b900dd099` |
| 22 | #1470 | dashboard · both archive indexes | regenerated | 2 | merged `7acfbf988` |
| 23 | #1478 | dashboard · both archive indexes | regenerated | 1 | merged `3d56be025` |
| 24 | #1501 | gate-coverage.yml · dashboard · archive indexes | keep-main-note-take-lower-floor · regenerated | 4 (1 flake, 1 re-merge) | merged `303557fb0` |
| 25 | #1473 | stubs/README.md (schema) | keep-main-schema-fold-column | 1 | merged `aef1d225e` |
| 26 | #1502 | dashboard · both archive indexes | regenerated | 1 | merged `88f1619a0` |
| 27 | #1497 | dashboard · both archive indexes | regenerated | 2 | merged `7868c0429` |
| 28 | #1503 | dashboard | regenerated | 2 | merged `f6984387b` |

Not this run's: #1492 was already on `main` when the run started; #1506, #1507
and #1509 were merged by a second session working the same repository.

## Not merged

| PR | Disposition | Why |
|---|---|---|
| #1479 | superseded-closed | Effective diff against `main` was empty. Its three archive moves landed via #1493, whose regen archived a superset of six roadmaps; its one other file, `evidence-artifact-typing.findings.md`, landed earlier via #1391 (`097ab6549`). Closed rather than merged, because merging an empty PR only raises a count. |
| #1495 | twice-exhausted → deferred, diagnosis on the PR | `check_source_size_budget` reports 192 new lines over the ceiling, all from `src/scripts/hooks/dispatch_hook.ts` (1500 → 1692). That file sits at **exactly** 1500 on `main`, so any addition reds it, and raising the baseline is what the gate itself calls a defect. The fix is ~192 lines of extraction from the hook dispatcher that runs on every tool call and carries the deny-capable guards — not work to squeeze between two merges. Two cohesive candidates are named in the PR comment, including the finding that the stdin trio is **pure** (`_stdin_read_failed` is written only at the call site), so the state can stay behind. |

## Arrived after cutoff — not processed

#1504, #1505, #1508, #1510, #1511, #1512, #1513 (and any opened later). The
second session kept creating PRs throughout the run; these are recorded here and
left untouched per the cutoff.

## Dropped edits

One, and it is a schema decision rather than a lost line. #1473 introduced a
5-column stub transfer table (adding "Re-entry producer"); `main`'s 4-column
table had meanwhile grown to 16 rows. The merge kept `main`'s schema and folded
the producer inline at the front of each new row's gate cell. Nothing was
invented — back-filling a producer for 16 existing rows would have meant
inventing 16 facts — and nothing was lost: the four new rows keep their producer
values verbatim. Promoting it to a real column is left as its own change, and the
branch's paragraph explaining why a producer must be named survives with one
sentence recording the fold.

## Root-cause fixes that were not conflict resolution

Five gates failed for reasons the drain itself created, and each was fixed at the
root rather than by moving a number to wherever today's tree happens to sit.

**1. `update_roadmap_progress.ts` over the source ceiling (#1493).** The archive
feature took it 1500 → 1584. Extracted the sweep spawner to
`archival_sweep.ts`, the sibling pattern `gate_execute.ts` already uses; total
excess back to 19427 exactly. The extraction's real risk was a silently broken
path lookup, so it was proved rather than assumed: calling `run_archival_sweep`
against a throwaway root returns `ran=true`, not the no-op branch.

**2. Two estate-pinned corpus floors (#1498, #1501).** A guard written
`expect(declaring).toBeGreaterThan(10)` exists to catch a *moved* roadmaps root,
but was pinned to how many roadmaps happen to exist — so archival fails it on a
healthy tree. After the first instance, the tree was searched rather than waiting
for a third: a grep for `toBeGreaterThan(<n>)` in tests whose surrounding lines
mention `roadmaps` finds **exactly two** estate-pinned instances
(`dispatch_r2_reviewer.test.ts`, `run_checkpoint.test.ts`); every other hit is
`> 0` and does not track the estate. Both are now floors of 5, which still fail
at 0 by arithmetic.

**3. `lint_plan_risk_register` coverage floor (#1501).** Same shape at config
level: floor 12 against a corpus the drain shrank to 11. `main` had independently
made the same diagnosis and lowered it to 10 with a better-written note. The
merge kept `main`'s note and took the lower floor, because 10 against 11 has one
file of headroom and would have redded on the next archival — the exact failure
`main`'s own note calls the wrong thing to detect.

**4. `check_depth_budget` fifth over-ceiling file (#1496).** A guideline sat 14
chars over 16,000 against a shrink-only ratchet with four files already above it.
Fixed by tightening two phrases inside the prose *that PR itself added*, giving
back 22 chars. No claim removed.

**5. Two prose-shaped lint findings (#1470, #1497).** `lint_example_fences`
flagged a fence teaching how to *detect* the `core.hooksPath` bypass — the
forbidden form has to appear for the diagnostic to be readable, so it got the
allow-marker the linter itself points at, with that reason.
`validate_reach_prescriptions` flagged `pipx install` in prose; that scanner
deliberately has no ignore marker, because a paragraph telling a human to run an
unpinned install hands over the same artefact the command would — so the sentence
was rephrased to "a single `pipx` installation" instead of exempted. Pinning a
version would have meant inventing one.

## What the estate numbers actually mean

Every merged PR walked the ratchet in `src/config/estate-count-budget.json`, and
every delta was verified **per blocker against `origin/main`** rather than read
off the branch's own prose. That check mattered repeatedly: #1480, #1491, #1500
and #1478 each carried a blocker already resolved on the trunk, which a
status-line count would have banked as this run's drawdown.

Over the run: `active_roadmaps` 26 → 5, `open_blockers` ~70 → 33,
`later_roadmaps` 52 → 55.

The `later` figure going **up** is the honest part. Parks were recorded in both
directions rather than netted to zero, because this ratchet's own history says
parking is not closing. Three PRs (#1486, #1466, #1468) parked a roadmap into
`later/`, and two of those three carried `status: draft` on the trunk — so
`collect()` had never counted them as active and there is no matching −1 to
report. Stating that asymmetry is the point; a bare +1 reads as drift.

Three dispositions deserve a maintainer's eye, because the count says "closed"
and the prose says something weaker:

- **#1476** closed two blockers as `resolved — **abandoned**`. That is a drop,
  not completed work. The leading `resolved` is what every gate reads.
- **#1473** closed five blockers, of which **four** are `transferred` into stubs
  created in the same change and only one (`cross-vendor-worker-slices`) is
  `satisfied`. Reading −5 as five problems solved would be wrong.
- **#1495** (unmerged) lands its roadmap **complete but unarchived**: 11/11 done
  with 2 unresolved `[~]` items, so Iron Law 3 correctly refuses a silent
  archive. Item 4.2 states in its own text that the bar is the maintainer's to
  pre-register, so resolving it is not an agent call, and the boxes were not
  flipped to let the roadmap archive itself. `update_roadmap_progress --check`
  reds locally on exactly this; no workflow runs that check, so it is a local
  signal rather than a CI blocker.

## Two defects found in passing, neither fixed here

**`check_no_conflict_markers` has a blind spot, and a marker is on the trunk
because of it.** `docs/contracts/settings-classes.md:323` on `main` is a bare
`<<<<<<< HEAD` with no `=======` and no `>>>>>>>`. The gate scans 8960 tracked
files and reports clean, because `scan_markers()` only records a hit when
`hasStart && hasEnd` (`src/scripts/check_no_conflict_markers.ts:145`). The
allowlist is empty, so nothing suppressed it — the pairing requirement is the
whole cause. Two one-line fixes: delete the stray line, and treat an unpaired
start marker as a hit. Found only because this run grepped for markers after
every merge, which means anything of the same shape has been passing unnoticed.

**The `pr-merge` authorization window is shorter than a drain.**
`LEDGER_MAX_AGE_MS` was raised to 6h for this run, and the run took 6.45h — the
authorization lapsed mid-queue twice. Not a defect in the guard, which behaved
exactly as written, but worth recording: a queue drain is a multi-hour operation
and the ledger is a single-window grant.

## Notes on method

- Serialization was forced, not chosen. Every PR touches
  `agents/roadmaps-progress.md` and `src/config/estate-count-budget.json`, so any
  merge makes every other PR `CONFLICTING`. Pre-greening several PRs is wasted
  work: the "green PRs first" rule yielded nothing at any recompute.
- Generated artefacts — dashboard, both archive indexes — were always
  regenerated, never hand-merged.
- `ci_settle` reads stale checks in the window between a push and the new run
  registering. It reported both a false RED (#1480) and a false GREEN (#1501)
  that way; both were caught by verifying the run's `headSha` before acting.
- A second session worked the same repository throughout, holding
  `commit`/`push`/`pr-create` but not `pr-merge`. It pushed sync commits to
  branches in this queue and opened nine new PRs. One consequence worth naming:
  it took over the main checkout mid-run, leaving it on `feat/wiring-truth` with
  uncommitted changes, which invalidated one "measure on plain `main`" reading
  before that was noticed. All later measurements were taken inside per-PR
  worktrees.
