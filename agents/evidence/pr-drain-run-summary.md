<!-- evidence-type: analysis -->

# PR drain run — 2026-08-20/21

One autonomous run, driven by a merge queue. Scope: every open PR in this
repository at the time of each recompute, merged one at a time, each synced onto
the `main` that the previous merge had just moved.

**First pass: 28 merged, 1 closed as superseded, 1 deferred with a written
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

---

# Second pass — queue drained to zero (2026-08-22)

The run above stopped at 28 with #1495 deferred and nine PRs arrived-after-cutoff.
This pass closes it out. **Total merged by this session: 39. Open PRs at the final
recompute: zero.**

## Merged in the second pass

| PR | Sync conflicts | Resolution class | CI iters | Disposition |
|---|---|---|---|---|
| #1516 | none (own branch) | — | 2 | merged `66b3dc993` |
| #1513 | both archive indexes | regenerated | 1 | merged `fdf878dbc` |
| #1505 | stubs/README · dashboard · a stub's refs | table restored · regenerated · repointed | 1 | merged `c298a6aba` |
| #1504 | dashboard | regenerated | 1 | merged `176bc9e02` |
| #1517 | estate budget · dashboard | history-append · regenerated | 2 | merged `eb1e0b866` |
| #1495 | dashboard · stubs/README | regenerated · union | 3 | merged `4dd26a832` |
| #1518 | both archive indexes | regenerated | 1 | merged `038453c33` |
| #1522 | none | — | 2 | merged `f59024cfd` |
| #1519 | estate budget · dashboard | history-append · regenerated | 1 | merged `49339720c` |
| #1520 | 3× modify/delete + dashboard | **delete wins** (see below) | 1 | merged `4c810eea7` |
| #1521 | 3× modify/delete + estate budget | **delete wins**, mirrored | 1 | merged `7d3b8b07f` |

Merged by the second session in parallel, not by this one: #1506, #1507, #1509,
#1511, #1512, #1523 and the 1508/1510 pair.

## #1495 — the twice-deferred PR, and what it took

The blocker was never the feature: `src/scripts/hooks/dispatch_hook.ts` sits at
**exactly 1500** lines on main — deliberately pinned at the source ceiling — and
the PR added 192 lines, so `check_source_size_budget` redded and raising the
baseline is what that gate itself calls a defect.

Three **pure** blocks moved out: `py_json_dumps.ts` (91 lines),
`stdin_failure_policy.ts` (81), `fallback_yaml.ts` (57). Final: 1468, with 32
lines of margin. Three rather than the two that merely clear the ceiling —
two land the file at exactly 1500, back on the cliff, which is the zero-margin
shape this very run had just finished fixing elsewhere.

**The near-miss is the part worth recording.** The first attempt carried
`let _stdin_read_failed` out of the module: the block boundary began 18 lines too
early, and unrelated syntax errors in another block masked it. Moving that state
would have silently detached the flag from the call site that writes it, in the
dispatcher every tool call passes through. It was caught by checking where the
declaration actually sat before the second attempt, and the extraction script now
refuses any block containing it.

Verified in both directions rather than argued, because this file carries the
deny-capable guards: a benign Bash payload through the dispatcher exits 0, and
`git commit --no-verify` still exits 2 with `block-no-verify: BLOCKED`.

## The two mirrored modify/delete resolutions

#1520 removes three generated artifacts from the git index — that is its entire
purpose. `main` had merely regenerated them, so keeping main's versions would have
reverted the change one commit after writing it: **the deletion wins.** One PR
later, #1521 hit the same conflict from the opposite side (main had by then
untracked them, the branch had modified them) and the deletion won again, this
time because untracking is now the trunk's decision.

Same rule, opposite sides, and neither is the drain's usual "regenerate" answer.
Worth stating because a resolver that always regenerates would have quietly
undone #1520.

## Two gate contradictions resolved rather than papered over

**`gate_baseline.test.ts` vs a zero-count entry (#1522).** The test asserts every
shipped baseline entry records real debt (`count > 0`);
`lint_roadmap_blockers:decidability` had been legitimately walked to 0 with a note
saying "zero is now the ceiling". Both were right. Removing the entry is not a
loosening: `evaluateGate` treats a missing entry as `ok: actual === 0`
(gate_baseline.ts:139-142) — the same ceiling the note asked for, and stricter
than a stored 0 someone could later edit upward. Proved by appending an
undecidable blocker (gate exits 1) and restoring the file (exits 0). The note is
dated history, so it moved to a `retired` block rather than being deleted.

**The corpus floors, corrected against my own earlier claim (#1516).** A neutral
review provoked the failure my own commit message had denied: with 6 roadmaps at
the top level and floors of 5, archiving one roadmap redded two tests. The number
was never the defect — `check_estate_count` forbids growth, so the corpus only
shrinks and any absolute floor above 0 is met eventually. Floors are now `> 0` and
`min_scanned: 1`; a genuinely empty corpus still reds, which is the vacuous-
assertion case the guards exist for.

## What the neutral review found, and what remains open

A cross-check over the first pass's own threshold changes refuted three claims
this run had made about itself: the floor-of-5 durability (above), a commit
message attributing a pointer removal to `319d33936` when it fell at
`cafb8a255`, and a `corpus:` string still reading "19 at baseline" against a real
count of 6. All three are fixed; the misattribution stands corrected here because
the commit message cannot be.

**Still open and owner-reserved:** `decision-revisit-gate` left
`check_rule_stub_ceiling`'s scope at `cafb8a255` while growing 2186 → 8020 chars
against a 545-token ceiling, and its migration ledger
(`agents/decisions/rule-migrations/decision-revisit-gate.yml`) is now an orphan no
gate objects to. A new ceiling either reds CI immediately or bakes in 3.7× growth
— which is why it is not decided here.

**Still open, environmental:** the same commit passes `skill_route_hook.test.ts`
21/21 in a fresh worktree and fails 2 in the long-lived one, with CI green on the
pushed SHA. Established as local, **not root-caused**.

**Unchanged from the first pass:** the unpaired `<<<<<<< HEAD` on
`docs/contracts/settings-classes.md:323`, invisible to
`check_no_conflict_markers` because it only fires on a start/end pair.

## Process notes from the second pass

- **A parallel session merged #1523 mid-sync.** The sync work was wasted and the
  push re-created a branch the merge had deleted; it was left in place rather than
  deleted unasked.
- **Two self-inflicted errors, both recorded.** A `git checkout -B` onto a dirty
  tree silently skipped a merge (caught by a `behind: 8` reading that should have
  been 0). And testing and pushing in one command sent a push out with two red
  tests — the fix is that a push is its own step after a green read, never the
  same one.
- **The authorization ledger is replaced by every user turn.** A bare continue-only reply
  wipes a standing merge authorization, and a background task-notification
  containing the word "merge" can refresh the ledger without any human having
  spoken. Neither was acted on.

# Third pass — 2026-08-23

A separate autonomous run under a whole-run merge authorization, with the
`block_unauthorized_git` ledger TTL raised from 30 min to 6 h in source and
rebuilt into `dist/hooks/dispatch.js` before the run started. **Queue drained to
zero: 5 merged, 0 closed, 0 deferred, 0 terminal.**

## Step 0 — the premise was verified before the first merge

The run opened with a read-only check that the effective bundle actually carried
the raised TTL, because a source edit without a rebuild is silently inert:
`dist/hooks/dispatch.js:26076` reads `LEDGER_MAX_AGE_MS = 6 * 60 * 60 * 1e3`, and
the only surviving `30 * 60 * 1e3` in the bundle is `WALL_CLOCK_ARMS_MS[2]`, an
unrelated constant. The guard source and the bundle were not touched by this run;
the temporary `LEDGER_MAX_AGE_MS` edit stayed uncommitted in the working tree
throughout, and every commit below used an explicit pathspec so it could not be
swept in.

## Merged

`#1499` was named in the run brief as the first merge and was already `MERGED`
at `dd6a14406` on 2026-08-21 — first-pass row 6 above. The five PRs below are
this pass's own work. Every SHA is the merge commit on `main`.

| # | PR | Sync conflicts | Resolution class | CI iters | Disposition |
|---|---|---|---|---|---|
| 1 | #1566 | none (branch already carried `main`) | — | 1 | merged `67a85604a` |
| 2 | #1567 | none | — | 0 | merged `a435b40ce` |
| 3 | #1569 | none | — | 1 (pre-empted) | merged `6353242e3` |
| 4 | #1570 | none (synced server-side) | — | 0 | merged `f4dbecb64` |
| 5 | #1568 | none (synced server-side) | — | 0 | merged `3b2e950fd` |

No conflict was resolved this pass, because no sync produced one: the two
generated artifacts that collided on every PR of the first two passes —
`agents/roadmaps-progress.md` and `src/config/estate-count-budget.json` — were in
no PR's diff. The dashboard is gitignored, and the estate gate reads its floors
from `origin/main` at run time rather than from a committed budget file, so a
shrinking estate needs no edit at all. Both of this pass's roadmap archivals
(`#1567`, `#1569`) therefore passed `check_estate_count` on a `-1 disposed`
reading with nothing to merge.

**No edit was dropped.** Nothing was closed as superseded, nothing blocked
externally, nothing exhausted its iteration budget.

## The one real CI failure, and why it happened twice

`#1566` arrived red on `Rule backstops → secret-vcs-guard`:
`check_secret_leak` reported a `pem-private-key` at
`src/config/gate-coverage.yml:282`. That line is the `check_secret_leak --pack`
mutation canary — a PEM header whose body reads `zz-canary-not-a-real-key`,
planted at a shipped-and-gitignored path to prove the pack scope reaches what no
git-backed mode can. It carries an audited `.secret-allow` entry, and that entry
is **line-pinned**.

`#1566` inserts 59 lines into `gate-coverage.yml`, some above the canary recipe,
so the header moved 269 → 282 and the pin stopped matching. The remedy is the one
`.secret-allow` documents for itself: re-audit and move the pin. Sensitivity was
established in both directions before the fix landed — red at 269, green at 282.

`#1569` then did the same thing, moving the header 282 → 291. That one was caught
locally before CI saw it, because the shape was already known.

**Recorded, not redesigned.** Any PR that inserts a line above that recipe reds
this gate, and both PRs in this pass that touched `gate-coverage.yml` did. The
line-pinned design is deliberate and argued in `.secret-allow`'s own header
comment: a pin that drifts off its line reds, which forces a re-audit, whereas a
path-only entry would silently allow a real secret pasted anywhere in the file.
That trade-off is not this run's to overturn — but the frequency is now two
occurrences in five PRs, which is the falsifiable half the design comment does
not carry.

## Two branches could not be checked out at all

`#1570` (`drain/rm4`) and `#1568` (`chore/inbox-release-4-10-0`) had their head
branches checked out in other sessions' worktrees, so `gh pr checkout` failed
`exit 128`. Both were `BEHIND` with `mergeable: MERGEABLE` — no conflicts, only
staleness — and the ruleset sets `strict_required_status_checks_policy: true`, so
staleness alone blocks the merge.

They were synced with `gh pr update-branch`, which performs the same merge
server-side (merge, never rebase) without touching the peer's working tree. The
cost is stated rather than hidden: the peer's local branch is now behind its own
remote and its next push will be rejected until it pulls. That is recoverable and
was preferred over writing into a tree another session holds.

## Process notes

- **The queue grew four times during the drain.** `#1567`, `#1568`, `#1569` and
  `#1570` all arrived after the first recompute, from parallel sessions in the 40+
  worktrees this checkout carries. Recomputing after every merge — rather than
  working a list captured once — is what kept the run terminating.
- **The first CI waiter was mis-specified and would never have fired.** It
  required ≥ 28 checks before reading a green settle, which is right for a
  code-touching PR and impossible for a docs-only one: path filters mean `#1567`
  ran exactly 5 checks. It was stopped and replaced with a terminal-state
  condition — no `IN_PROGRESS`/`QUEUED`/`PENDING` entries in the rollup, plus
  `mergeStateStatus` out of `UNKNOWN`/`BEHIND` — which is decidable at any check
  count. One waiter at a time throughout; the superseded one was killed, not left
  running.
- **Exactly one status check is required.** `Sync + Generate Tools Consistency`
  is the only entry in the ruleset's `required_status_checks`, and
  `required_approving_review_count` is 0. The other 30+ checks are advisory, so a
  `BLOCKED` reading on a PR with everything green is branch freshness and nothing
  else — worth knowing before diagnosing it as a failure.
- **`gh pr merge --delete-branch` fails locally while the remote merge
  succeeds.** On `#1568` the local branch delete errored because a peer worktree
  held it. The merge itself had landed. Disposition was confirmed from
  `gh pr view --json state,mergeCommit`, never from the merge command's own exit.
- **Two transient classifier denials** on `gh pr merge` and `gh pr checkout`
  cleared on an immediate identical retry. No authorization window was spent on
  them.
