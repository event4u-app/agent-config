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

> **Screened for promotion and archival 2026-10-05, and it moves to neither — every
> verdict below is a command's output, not a reading of a status line.** The file reads
> 4 done / 0 open / 2 deferred, which is the shape that normally precedes an archive.
>
> **1. Archival is unreachable while `status: draft`, and the gate is `collect()`.**
> `archive_completed_roadmaps.ts` iterates `collect()` from
> `update_roadmap_progress.ts`, which skips any roadmap whose frontmatter `status` is in
> `UNSCHEDULED_VALUES` (`update_roadmap_progress.ts:103` — one member, `draft`).
> Executed here: `collect()` over `agents/roadmaps/` returns 11 roadmaps with this file
> **ABSENT**; over a scratch copy with the single line flipped to `status: ready` it
> returns it **PRESENT**. So
> `npx tsx src/agent-src/scripts/archive_completed_roadmaps.ts --all --dry-run` printing
> `ℹ️  No completed roadmaps to archive.` is silence about this file, not a verdict on it.
>
> **2. Promoted to `ready`, the sweep sees it and refuses it.** Against a scratch root
> holding this file at `status: ready`: `⚠️  …: 2 unresolved deferral(s) — not archived.`
> — step 1.1 and AC-1 carry no `<!-- deferred-resolution: carried-to=<slug> -->`
> annotation. With the carry path at its default the refusal becomes an owner question
> rather than clearing: `❓  …: 2 deferred step(s) wait on owner blocker(s)
> freshness-mechanism-is-owner-owned — not archived; the owner decides:`, with an
> `OWNER-DECISION` record offering archive-and-park to `agents/roadmaps/later/` or leave
> in place. No agent run can close this file by archiving it.
>
> **3. Promotion is blocked by the estate ratchet, and this file's own frontmatter
> already said who promotes it.** `./scripts-run src/scripts/lint_decision_classes` is
> **clean** on this file under a simulated `status: ready` — 0 violations, because `D3`'s
> `OPEN` sits inside `## Decisions`, which that gate treats as the discharge record
> rather than the defect. The block is elsewhere:
> `./scripts-run src/scripts/check_estate_count` reds on the promotion of the two draft
> roadmaps screened together — `active_roadmaps 11 → 13` and `open_blockers 60 → 62`
> against the `origin/main` floor. And this file's `estate_offset_exempt` already states
> the disposition in its own words: *"It ships as a draft, so it is already excluded from
> the dashboard and from /roadmap:process-\* until a maintainer promotes it."*
>
> **The precedent that prompted the screen does not transfer.**
> `road-to-a-kernel-that-guards-its-plumbing` archived the same day at `status: ready`,
> **0** deferrals and **0** open blockers (`901e8bc4e`, a pure `git mv`). This file
> differs on all three axes.
>
> **Hand-over.** (a) `agents/roadmaps/road-to-trigger-eval-freshness-has-no-writer.md:3`,
> currently `status: draft` → `status: ready`, which also needs the `check_estate_count`
> growth claimed or offset; the frontmatter reserves that act to a maintainer. (b) `D3`
> answered — the row at `## Decisions` currently opens `| D3 | business-owned | owner |
> **OPEN.**` — which is the `business-owned`, `Class: 3 — human-only` spend decision the
> blocker prices. (c) Then either resolution of `freshness-mechanism-is-owner-owned`, or
> the owner's archive answer via `./agent-config roadmap:archive --all --owner-decision
> later --only road-to-trigger-eval-freshness-has-no-writer.md`.
>
> **The blocker's `Resolved when` was re-executed, both limbs, and is still UNMET.**
> Limb one: `grep -n 'OPEN' …` still returns the `D3` row reading `**OPEN.**`. The
> earlier 2026-10-05 note quotes that row at line 181, which was that day's offset; the
> row has since moved down the file and its content is unchanged, so quote the row rather
> than the offset when re-executing. Limb two:
> `grep -rn "last_eval" src/ --include="*.ts" | grep -v "/evals/"` still shows the only
> writer as `src/cli/commands/recordTriggerEval.ts:197`, writing `upstream.last_eval`
> into `manifest.json` — a different key in a different file from the top-level
> `last_eval` in `triggers.json` that `check_trigger_evals.ts:144` reads. The gate's own
> count is unchanged from this file's 2026-10-05 reading: `./scripts-run
> src/scripts/check_trigger_evals` reports 46 findings, 4 of them `missing or non-ISO`.
> Both `[~]` glyphs are carrying a real disposition; neither is an open step wearing one.

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
   would not move the gate by one day. (**42 stale as of 2026-10-05, and four
   further suites that carry no `last_eval` key at all** — a backfill reaches
   neither group. See risk 5 and the blocker's 2026-10-05 re-measurement.)

   **Re-verified 2026-10-01, and the original search scope was too narrow —
   widening it finds a decoy, not a writer.** Grepping `src/` rather than
   `src/scripts/` turns up a third non-fixture hit:
   `src/cli/commands/recordTriggerEval.ts` (`agent-config eval:record`), which
   on line 197 really does *write* a field called `last_eval`. It is not this
   gate's field. It writes **`upstream.last_eval`** into a corpus
   **`manifest.json`**; `check_trigger_evals` reads a **top-level `last_eval`**
   in **`src/skills/*/evals/triggers.json`** (its `GLOB`, line 34). Different
   key, different file, different reader — `upstream.last_eval` is
   `lint_eval_freshness`'s surface, and that lint is scoped to SHA-pinned corpus
   skills, of which the tree has one. Recording this because the next person to
   grep wider than the original search will land on `recordTriggerEval.ts` and
   reasonably conclude the premise of this roadmap has expired. It has not: the
   gate's field still has no writer anywhere in the tree.
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

- [~] <!-- blocked-by: freshness-mechanism-is-owner-owned | asked: yes — surfaced to the owner 2026-09-30 with the arithmetic below, re-measured and re-surfaced 2026-10-01; the four options are recorded and priced, the choice is not the agent's --> **1.1 Choose the mechanism, and record the choice with its cost.** The
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
      **DEFERRED 2026-10-01 — `[~]`, and deliberately not closed.** A drain pass
      re-executed the blocker's `Resolved when` rather than trusting its status
      line, and it is genuinely unmet: `D3` still reads `OPEN`, and no mechanism
      in the tree writes what the gate reads. The step is not deferred because
      it is hard — it is deferred because **every one of its four exits is
      owner-reserved**, and an agent taking any of them would be deciding a
      recurring external spend. Options 1 and 2 commit ~85 provider queries a
      week in perpetuity *and* need a workflow write-path into a
      protected-branch repository, which is a branch-protection change and
      therefore Hard-Floor under `non-destructive-by-default`. Option 3 retires
      a measure. Option 4 sets how long a trigger regression may go unnoticed —
      three months or six. `decision-revisit-gate`'s owner-reserved table routes
      "spend or liability above a delegated threshold" and "lowers or removes a
      recorded floor" to the owner, and this blocker is already typed
      `business-owned`, `Class: 3 — human-only`. Worth naming the sharpest
      version: options 1 and 2 would build a mechanism that **advances the
      freshness date automatically**, i.e. lets the system certify its own
      freshness. Whether that is acceptable is exactly the question the existing
      human gate on the live eval already answers in the other direction —
      `skill_trigger_eval`'s `require_confirmation` reads `/dev/tty` and
      hard-aborts under automation ("No --force, no --yes, no env-var bypass …
      Refusing to run under automation"), deliberately. An agent that built the
      auto-writer would be routing around that gate on its own authority.
      **Exact inputs a future session needs, all of them owner-supplied:** (a)
      one of the four options named in `D3`, replacing `OPEN`; (b) for options 1
      or 2, the owner's own execution of the branch-protection / workflow
      permissions change, since that write cannot be delegated; (c) for option
      4, the chosen window in days, written into `MAX_AGE_DAYS` in
      `src/scripts/check_trigger_evals.ts` and `ROTATION_CYCLE_WEEKS` in
      `src/scripts/trigger_eval_rotation.ts` **together** — a cycle longer than
      the window re-introduces the defect 1.2 removed. Nothing else is missing;
      the arithmetic is current (re-measured below) and steps 1.2 and 1.3 are
      closed and mechanism-independent, so the implementation after the choice
      is small in all four branches.

      **HAND-OVER, written 2026-10-05 so the remaining action is a decision and
      not a re-derivation.** Every anchor below was read off the live tree on
      that date. Pick one option; the edit under it is the whole implementation.
      Line numbers are given with their current content so a drifted anchor is
      recognisable rather than silently wrong.

      *Common to options 1 and 2 — the part an agent cannot do.* Both need the
      canary to write back into a protected branch. The anchor is
      `.github/workflows/cross-model-canary.yml:47-48`:

      ```yaml
      permissions:
        contents: read        # ← both options need `write` here, plus a
                              #   branch-protection exception for the pushing
                              #   actor. That is the Hard-Floor half.
      ```

      The rotation already runs at `cross-model-canary.yml:118-123` and its
      output is already collected at `:135-139` — as an `actions/upload-artifact`
      step, which is precisely why nothing durable survives. Measured cost,
      identical for both: ~93 provider queries a week sustained at today's 111
      suites, 140 in the peak week, 1110 per full pass.

      **Option 1 — durable rotation results, gate reads them.** After the
      permissions change, the upload step is replaced by a commit of the result
      JSONs to a tracked path, and `check_trigger_evals.ts:144-155` is rewritten
      to read the newest result per suite instead of a date field. Extra cost
      beyond the queries: a tracked artifact that grows every week, so it needs
      the retention answer `scale-discipline` R-A7 asks for.

      **Option 2 — CI writes `last_eval`.** After the permissions change, one
      step is added after the rotation that writes today's date into each
      covered suite's `triggers.json` and commits. The gate is untouched. The
      predicate is the trap already recorded above: write on a **completed**
      run, not a passing one, since a floor-breaching run is still evidence
      that an evaluation happened. Cheapest of the four to implement, and the
      one that lets the system certify its own freshness.

      **Option 3 — retire the freshness dimension.** The only option an agent
      could implement unaided once chosen, and the choice itself is still the
      owner's because it removes a recorded measure. Delete
      `src/scripts/check_trigger_evals.ts:144-155` — the whole block from
      `const raw = obj ? obj['last_eval'] : undefined;` through the closing
      brace of the `else` — plus `MAX_AGE_DAYS` at `:35` and its re-export at
      `:431`, and the doc line at `:19`. The structural smoke check below it
      stays. This also disposes of risk 4 by construction: the string that
      prints the fabrication recipe lives at `:152`, inside the deleted block.
      Cost: zero queries, and trigger regressions stop being measured over time.

      **Option 4 — lengthen the window.** Two constants move together, and the
      second is the one a reader forgets:

      ```ts
      // src/scripts/check_trigger_evals.ts:35
      const MAX_AGE_DAYS = 90;              // → the chosen window, e.g. 180

      // src/scripts/trigger_eval_rotation.ts:71
      export const ROTATION_CYCLE_WEEKS = 12;   // → ≤ window / 7, e.g. 24
      ```

      A cycle longer than the window re-introduces the defect 1.2 removed, so
      `ROTATION_CYCLE_WEEKS × 7 ≤ MAX_AGE_DAYS` has to hold after the edit;
      `tests/scripts/trigger_eval_rotation_growth.test.ts` pins the window it
      checks and needs the same number. At 180 days the sustained bill halves
      to ~47 queries a week. **This option does not finish the job on its own**
      — four suites carry no field for any window to measure, so it also needs
      the field-presence answer recorded against the option in the blocker.

      *Under options 1, 2 and 4, risk 4's string at
      `src/scripts/check_trigger_evals.ts:152` is still false after the edit* —
      it names `skill_trigger_eval`, which does not write `triggers.json` under
      any of them. It is rewritten in the same change to name whichever
      mechanism was chosen. It was left alone here deliberately: its correct
      text is a function of the choice, so writing it now would pre-empt the
      owner.
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
      **Evidence (2026-10-01).** Re-run on the drain pass rather than taken on
      trust: `npm run test:ts -- tests/scripts/trigger_eval_rotation_growth.test.ts`
      → `2 passed (2)`. The property it pins still holds against the live list.
      **Evidence (2026-10-05).** Re-run again rather than read off the line
      above, because the live suite list has grown since it was written:
      `npm run test:ts -- tests/scripts/trigger_eval_rotation_growth.test.ts`
      → `2 passed (2)`. The growth the test simulates has now also happened in
      the tree — 102 suites on 2026-10-01, **111** today — and the property
      still holds: adding suites shifts nobody else's slot, and worst-case
      staleness is still the cycle length (84d) rather than a re-based window.
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
      **Evidence (2026-10-01).** `npm run test:ts -- tests/scripts/trigger_eval_rotation.test.ts`
      → `13 passed (13)`. `rotation_plan(list_trigger_suites())` on the live
      tree returns `{ total: 102, cycleWeeks: 12, peakSuitesPerWeek: 14,
      peakWeeklyQueries: 140, worstCaseStalenessDays: 84, withinCeiling: true }`
      — the bill still reads off the code without a run, the peak week is inside
      `MAX_WEEKLY_QUERIES = 160`, and worst-case staleness (84d) is inside the
      gate's 90-day window. Note `QUERIES_PER_SUITE` is coded as `10`, not the
      ~9.5 the prose rounds from; the ceiling arithmetic uses the code's `10`.
      **Evidence (2026-10-05), and the suite count has moved.**
      `npm run test:ts -- tests/scripts/trigger_eval_rotation.test.ts` →
      `13 passed (13)`. `rotation_plan(list_trigger_suites())` on the live tree
      now returns `{ total: 111, cycleWeeks: 12, peakSuitesPerWeek: 14,
      peakWeeklyQueries: 140, worstCaseStalenessDays: 84, withinCeiling: true }`
      — **111 suites, up from 102 four days ago.** The bound still holds and
      nothing about this step's claim has weakened: the peak week is unchanged
      at 140 queries, comfortably inside `MAX_WEEKLY_QUERIES = 160`, because
      identity slotting spreads nine new suites across the cycle instead of
      stacking them. What moved is the full-pass bill D3 is being decided
      against: 111 × 10 = **1110 queries**, not the ~1020 this roadmap records
      elsewhere. That figure is corrected in the blocker below.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Rotate by suite identity — a suite's slot is a hash of its own name — rather than by a positional window whose start re-bases on `total`. Cost: the batch stops being a tunable knob; how many suites run in a week follows from the hash spread and `rotation_plan` reports it. | `trigger_eval_rotation_growth.test.ts`, observed red at 24 weeks against the old scheme and green at ≤12 after; a second test pins that adding a suite leaves every existing suite's schedule unchanged | a scheme is found that is both stable under growth and gives an even weekly load — identity slotting buys stability at the price of an uneven bill, and that trade is not obviously optimal |
| D2 | reversible-technical | evidence | State the weekly paid-call ceiling as `MAX_WEEKLY_QUERIES = 160` and make the bill derivable from `rotation_plan()` without a run. | re-measured 2026-10-05 at **111** suites: 140 queries in the peak week, `withinCeiling: true`. The decision stands; its **`revisit-if` figure did not** — see the correction note below this table | the peak week approaches `MAX_WEEKLY_QUERIES`, which `rotation_plan()` reports directly — **not** a suite count, because the count is the wrong proxy (correction below); or `QUERIES_PER_SUITE` is re-measured away from the coded `10` |
| D3 | business-owned | owner | **OPEN.** Which mechanism evidences freshness — see `## Blockers` → `freshness-mechanism-is-owner-owned`. Priced, not chosen. | the 1110-queries-per-pass arithmetic below, re-measured 2026-10-05 at 111 suites | — |

**Correction to D2's `revisit-if`, measured 2026-10-05.** The retired wording
said the ceiling "reds at roughly 117 suites" and asked for a revisit as the
count approached it. Executed against the live tree, it does not reproduce:
growing the live 111-suite list one synthetic suite at a time, the first
`withinCeiling: false` lands at **total 132–152 depending on the names added**
(five name families probed: 132, 141, 151, 152, 152). The spread is the point —
under identity slotting the peak week is a property of the **hash distribution
of the names**, not of the count, so no single suite number is the threshold.
A count-based `revisit-if` would therefore have fired at the wrong time in both
directions: it would have raised an alarm at 117 when ~20 suites of headroom
remained, and it offers no signal at all for a cluster of similarly-named
suites arriving at a count it considers safe. The row now points at
`rotation_plan().peakWeeklyQueries` against `MAX_WEEKLY_QUERIES`, which is the
quantity the ceiling is actually stated over and which the function already
returns. D2's **decision** is untouched — only the condition for revisiting it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Someone bumps the 39 dates to clear the red | implementation | It is a one-line edit per file and it makes a required-looking gate green instantly. It also asserts 39 evaluations that never ran — the exact defect the corpus-refresh roadmap was created to stop, in a second place | Fact 1 above states plainly that no writer exists, so a bumped date is provably an assertion rather than a record; 1.1 forces the mechanism question instead of the symptom | Phase 1 — Decide what freshness is evidenced by |
| 2 | The gate is quietly deleted as "unenforceable" | product | It is local-only and blocks no merge, so removing it costs nothing today and loses the trigger-regression lock the suites exist for | 1.1 lists retirement as an explicit option with its cost named, so dropping the measure becomes a recorded decision rather than a cleanup | Phase 1 — Decide what freshness is evidenced by |
| 3 | A mechanism is built on rotation results that still are not durable | implementation | Fact 2 is easy to miss: the results directory exists locally and looks persistent, but in CI it is an ephemeral artifact and the job has read-only contents permission | 1.1's verify demands the cost be recorded, and the CI write path is the cost; 1.2 is sequenced before any dependency on the rotation | Phase 1 — Decide what freshness is evidenced by |
| 4 | The gate's own error text instructs the fabrication risk 1 forbids | implementation | Found 2026-10-01 while re-verifying fact 1, and not fixed here on purpose. `check_trigger_evals.ts:152` tells the reader to "re-run skill_trigger_eval and bump it" — but `skill_trigger_eval` writes a result file and never touches `triggers.json`, so the only way to obey that instruction literally is to hand-edit the date. The gate is printing the fabrication recipe 39 times per run — **42 times as of 2026-10-05**, since the instruction rides the staleness branch and three more suites have aged past the window — with the authority of a failing check behind it. This is a stronger pull toward risk 1 than risk 1 models, because it needs no initiative — the reader is being told | Left as a recorded finding rather than a drive-by fix: the line's correct replacement depends on which option 1.1 picks (under 3 it disappears with the read; under 1 or 2 it should name the CI mechanism; under 4 only the number moves), so fixing it now would pre-empt the owner's choice. Whoever closes 1.1 rewrites this string in the same change | Phase 1 — Decide what freshness is evidenced by |
| 5 | A suite can arrive with no `last_eval` at all, and four already have | implementation | Found 2026-10-05, and it is a second failure direction this roadmap did not model. Every earlier reading recorded that all 102 suites carried the field and 39 had merely gone stale. That is no longer true: `src/skills/{api-testing,quality-tools,test-driven-development,test-performance}/evals/triggers.json` carry **no `last_eval` key**, all four added 2026-10-02 in `a3c839340` (#2173) — one day after the last re-measurement. Nothing in the tree requires the field when a suite is authored, so the gate's failing count now grows from ageing **and** from arrival. The consequence for the open decision is concrete and is recorded against option 4 in the blocker: a longer window does not clear a field that is absent | Not fixed here, and deliberately not by adding the field: writing a date into those four would assert four evaluations that never ran, which is risk 1 exactly. The structural fix — requiring the key at authoring time, independent of any freshness mechanism — is a gate this roadmap has no authorization to add, so it is recorded as a finding and priced under the blocker instead | Phase 1 — Decide what freshness is evidenced by |

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
     **Price corrected 2026-10-05 — this option no longer clears the gate on
     its own, and that is measured, not argued.** Four suites now carry no
     `last_eval` key at all (risk 5), and the gate's missing-field branch
     (`check_trigger_evals.ts:144-147`) fires before any age comparison, so no
     window length reaches them. Proven by running the gate with a reference
     date that makes every dated suite fresh:

     ```
     $ ./scripts-run src/scripts/check_trigger_evals --today 2026-06-20
     ❌ check-trigger-evals: trigger-set regression(s):
        - src/skills/api-testing/evals/triggers.json: missing or non-ISO `last_eval` (got None)
        - src/skills/quality-tools/evals/triggers.json: missing or non-ISO `last_eval` (got None)
        - src/skills/test-driven-development/evals/triggers.json: missing or non-ISO `last_eval` (got None)
        - src/skills/test-performance/evals/triggers.json: missing or non-ISO `last_eval` (got None)
     ```

     An effectively unlimited window leaves exactly those four red. Choosing
     option 4 therefore also requires saying what happens to a suite authored
     without the field — the same sub-question options 1 and 2 answer by
     construction (their mechanism writes the key on first run) and option 3
     answers by deleting the read. This does not disqualify option 4; it means
     its price is a window **plus** a field-presence decision, where on
     2026-09-30 it was priced as a window alone.
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
- **Re-measured 2026-10-01 — step 1 of "What to do" is already done; the
  numbers have not moved.** A drain pass ran the command this blocker prescribes
  and the gate itself, so the owner is deciding against current figures rather
  than month-old ones: `rotation_plan(list_trigger_suites())` →
  `{ total: 102, cycleWeeks: 12, peakSuitesPerWeek: 14, peakWeeklyQueries: 140,
  worstCaseStalenessDays: 84, withinCeiling: true }`, and
  `check_trigger_evals` reports **39 failing suites, all of them stale, none of
  them missing** the field (every one of the 102 carries a `last_eval`; 39 are
  older than 90 days). So the suite count is unchanged at 102, the ~1020-query
  full-pass arithmetic stands unchanged, and nothing about the four options'
  prices has shifted. The only correction is cosmetic and in the owner's favour:
  `QUERIES_PER_SUITE` is `10` in code, so a full pass is ~1020 queries exactly
  rather than by rounding.
- **Re-measured again 2026-10-05 — this time the numbers HAVE moved, in both
  the bill and the failure count.** Same two commands, run against the live
  tree:

  ```
  $ npx tsx -e "import('./src/scripts/trigger_eval_rotation.ts').then(m => console.log(JSON.stringify(m.rotation_plan(m.list_trigger_suites()))))"
  {"total":111,"cycleWeeks":12,"peakSuitesPerWeek":14,"peakWeeklyQueries":140,
   "worstCaseStalenessDays":84,"withinCeiling":true}

  $ ./scripts-run src/scripts/check_trigger_evals          # 46 findings
  … 42 × "`last_eval` <date> is <N>d old (> 90d)"
  …  4 × "missing or non-ISO `last_eval` (got None)"
  ```

  Three corrections to what the owner is deciding against, none of them in the
  owner's favour:
  1. **The suite count is 111, not 102** — nine new suites in four days. A full
     pass is 111 × 10 = **1110 queries**, not ~1020, and the sustained weekly
     cost under a 90-day window rises with it to ~93. The peak week is
     unchanged at 140 and still inside `MAX_WEEKLY_QUERIES = 160`, because
     identity slotting spreads arrivals instead of stacking them.
  2. **"None of them missing" has stopped being true.** The 2026-10-01 reading
     recorded 39 failures, all staleness, every suite carrying the field. Today
     it is **46 failures — 42 stale and 4 carrying no `last_eval` key at all**
     (risk 5). All four arrived 2026-10-02 in `a3c839340`, the day after that
     reading, so this is a four-day-old regression rather than a long-standing
     one nobody had noticed.
  3. **Option 4's price changed as a consequence of 2** — a longer window does
     not reach an absent field. Recorded against that option above, with the
     command that proves it.

  The shape of the decision is unchanged and so is its ownership. What changed
  is that the bill is ~9 % above the quoted figure and one of the four options
  now carries a second question. Growth is also not a one-off — 102 → 111 in
  four days — so a decision deferred further is decided against a larger
  number again.
- **Resolved when:** `grep -c 'OPEN' agents/roadmaps/road-to-trigger-eval-freshness-has-no-writer.md`
  no longer matches the `D3` row — that row names one of the four options — and
  the tree agrees with it: either a mechanism writes what the gate reads, or
  `check_trigger_evals.ts` no longer reads a date nothing writes.
  **Executed 2026-10-01: UNMET.** `D3` still reads `OPEN`, and the widened
  writer search (fact 1's re-verification above) confirms the tree still has no
  writer for the gate's field. The blocker's `Status: open` is accurate, not
  stale.
  **Executed again 2026-10-05: still UNMET — and a fifth exit was searched for
  and does not exist.** Both limbs run against the live tree rather than read
  off the line above:

  ```
  $ grep -n 'OPEN' agents/roadmaps/road-to-trigger-eval-freshness-has-no-writer.md
  181:| D3 | business-owned | owner | **OPEN.** Which mechanism evidences freshness …

  $ grep -rn "last_eval" src/ --include="*.ts" | grep -v "/evals/"
  src/cli/commands/recordTriggerEval.ts:197:  …upstream.last_eval = record;     # upstream.last_eval, in manifest.json
  src/scripts/check_trigger_evals.ts:144:    const raw = obj ? obj['last_eval'] : undefined;   # READ
  src/scripts/lint_eval_freshness.ts:231:   const last_eval = upstream['last_eval'];           # READ, different surface
  ```

  Limb one fails: `D3` still reads `OPEN`. Limb two fails: the only writer in
  the tree is still `recordTriggerEval.ts:197`, still writing a **different
  key** (`upstream.last_eval`) into a **different file** (`manifest.json`) from
  the top-level `last_eval` in `triggers.json` that line 144 reads.

  **The owner-owned label was tested, not assumed, and it holds.** Under
  capability-before-role the label follows the exit criterion, so the obvious
  fifth exit was checked: evidence already durable in the repo that the gate
  could be pointed at without any CI write path, which would make the fix
  agent-capable. There is none. `internal/evals/results/` is gitignored
  (`.gitignore:173`) and does not exist on disk; `src/skills/*/evals/last-run.json`
  is gitignored too (`.gitignore:171`). So fact 2's durability finding holds from
  the repository side as well as from the workflow-permissions side, every
  remaining exit is one of the four priced options, and each of those is either
  a recurring external spend or the removal of a recorded measure — both
  owner-reserved under `decision-revisit-gate`. `Class: 3 — human-only` is
  confirmed on this reading rather than carried over from the last one.

## Acceptance Criteria

- [~] <!-- blocked-by: freshness-mechanism-is-owner-owned | asked: yes — priced and put to the owner 2026-09-30, re-measured and re-surfaced 2026-10-01; the mechanism is a recurring-spend choice, not an agent one --> AC-1 — A reader can name, from the tree alone, what makes a trigger suite
      "fresh" and which mechanism produces it; or the freshness dimension is
      gone and `check_trigger_evals` no longer reads a date nothing writes.
      **DEFERRED 2026-10-01 — `[~]`, tracking 1.1.** Still unmet, and verified
      so rather than assumed: a reader today cannot name the mechanism, because
      there is none — the gate's field has no writer anywhere in the tree (fact
      1, re-verified at a wider search scope). This criterion cannot be met by
      any agent action that does not first resolve 1.1, because each of the four
      options produces a *different* answer to "what makes a suite fresh" — a
      durable rotation artifact, a CI-written date, nothing at all, or the same
      date against a longer window. Meeting AC-1 before the choice would mean
      inventing the answer. The exact inputs needed are listed under 1.1; this
      criterion closes automatically once one of them is supplied and
      implemented.
      **Re-read 2026-10-05 — still unmet, and the question it asks has got one
      answer harder.** The writer search was re-executed at the widened scope
      and the tree still holds no writer for the gate's field, so a reader still
      cannot name the mechanism. What moved is that "fresh" now has to cover a
      case this criterion did not anticipate: four suites carry no `last_eval`
      key at all (risk 5), so an answer to "what makes a suite fresh" has to say
      what a suite that has never been evaluated *is*, not only how old a date
      may be. Options 1 and 2 answer that implicitly, option 3 dissolves it, and
      option 4 does not answer it — which is why option 4's price was corrected.
      The hand-over written onto 1.1 on the same date carries the anchored edit
      for each branch, so this criterion closes with one owner decision plus the
      edit named under it.
- [x] AC-2 — A growth-simulating test pins the rotation's worst-case staleness
      inside the enforced window, and has been observed red against the scheme
      it replaces.
      **MET 2026-09-30.** `tests/scripts/trigger_eval_rotation_growth.test.ts`
      grows the suite list across 260 simulated weeks at two growth rates and
      asserts worst-case staleness stays within 12 weeks. It was observed red
      against the positional scheme at **24 weeks** before the replacement, so
      its sensitivity is demonstrated rather than assumed.
      **Re-verified 2026-10-05:** `2 passed (2)`, against a live list that has
      itself grown 102 → 111 since the criterion was written — the simulated
      growth the test asserts over has now partly happened in the tree, and
      worst-case staleness is still 84d inside the 90-day window.
- [x] AC-3 — The weekly paid-call count of the rotation is derivable from the
      code and bounded by a stated ceiling.
      **MET 2026-09-30.** `rotation_plan()` is pure and returns the peak week's
      suite count, its query cost, the worst-case staleness and whether the list
      is under `MAX_WEEKLY_QUERIES = 160`. Two tests: the live list is under the
      ceiling, and a 1000-suite list reports `withinCeiling: false` rather than
      billing silently.
      **Re-verified 2026-10-05:** `13 passed (13)`, and the live list at 111
      suites still reports `peakWeeklyQueries: 140, withinCeiling: true`. The
      criterion holds; D2's `revisit-if` did not, and was corrected to watch
      `peakWeeklyQueries` rather than a suite count — see the note under the
      Decisions table.
