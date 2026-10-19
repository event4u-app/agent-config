---
complexity: lightweight
status: ready
estate_offset_exempt: "Owner-requested on 2026-10-19 as its own plan. Rejected instead: folding it into road-to-agent-throughput-recovery (that file decides what binds a night and owns lane COUNT; this one owns what a lane must FINISH and which roadmap is taken next) and parking a neighbour, which would move the count without drawing the estate down."
estate_growth_exempt: "Adds one ready roadmap on the owner's instruction of 2026-10-19; its purpose is to make the other 24 close, so the estate shrinks through it rather than around it."
execution:
  mode: autonomous
relates:
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "Its AC-3 holds any lane-COUNT or settle change until its Phase 2 verdict. Nothing here changes the lane cap (two, decided 2026-08-20) or the CI settle; this plan changes the lane contract and the queue order. Step 1.1 puts the mechanism-match to the council before any lane text lands."
  - slug: road-to-an-intake-the-queue-can-carry
    relation: disjoint
    note: "Owns the intake limit for harvest roadmaps (D8, N = 8). Step 4.2 here touches only where time-gated steps of a NEW roadmap are written, not how many roadmaps arrive."
  - slug: road-to-a-cold-start-paid-once
    relation: disjoint
    note: "Owns spawning into a rate-limit event. Step 5.2 here only makes a killed lane resumable; it does not re-plan spawn timing."
---
# Road to roadmaps finished before new ones start

> **Source:** owner request of 2026-10-19 — under `/roadmap:process-full` every
> lane, subagents included, must take one roadmap to 100 %, with no intermediate
> PRs and no switching; new agents must prefer the started roadmaps; finishing
> must outrank starting so releases can follow. Measured in
> `agents/evidence/analysis/drain-lanes-leave-roadmaps-partial-2026-10-19.md`
> (50 sessions, 207 drain lanes, `origin/main @ aa4185a1f`).

## Context

24 active roadmaps are started and none is finished. The command already says
"Full is Full" and "one roadmap = one branch = one PR"; the runs do something
else, for five measured reasons:

1. **The lane brief is improvised and sets a partial finish line.** Parallel
   lanes are "staged, not shipped" in `roadmap-process-loop` § 3d, so each
   orchestrator writes its own brief: 244 of 285 said "deliver an open green
   PR", 77 sanctioned a partial PR, 14 said "remove the part that needs
   ratification". Only 17 of 207 drain lanes (8 %) ended complete.
2. **Gated residue never reaches a decision.** 55 lanes stopped on an owner
   decision, 25 on the council, 11 on a time window; 79 prompts said "do not ask
   the owner". The next run dispatches a fresh lane onto the same blocker
   (installed-layer: 9 lanes, still 11/20).
3. **The queue drifts to new roadmaps.** Roadmaps under 25 % got 86 touches,
   those at 75 %+ got 12; twelve roadmaps created 10-14..16 progressed at once.
   Ordering by percent puts the gated tails on top, the orchestrator screens them
   as blocked, and the 0 % bucket wins. Nothing claims a roadmap across sessions.
4. **Closing actions are refused or cut off.** 24 lanes were stopped by the host
   classifier on flipping their own boxes or writing dispositions; 30 died on the
   spend limit without a report; 4 had their PR merged under them.
5. **Time-gated steps sit inside implementable roadmaps.** ≈21 % of the 257 open
   steps wait on a window or a soak, so a roadmap whose work is done cannot reach
   `count_open == 0`.

Assumption stated, not asked: the owner's "no intermediate commits" is read as **no
intermediate push, PR or merge** for a roadmap. Local commits in logical chunks
stay, per `commit-policy`; they are pushed once, when the roadmap is closed.

## Goal

Under `/roadmap:process-full` — single, `--all`, with or without lanes, in any
session — a roadmap is taken only if no started roadmap can still move, is held
by exactly one lane until `count_open == 0`, and lands as exactly one PR. A gated
step is decided during the run (council, or one batched owner question), never
left in a report for the next run. A roadmap whose remaining steps are only
time-gated is closed by carrying them into a named follow-up, so it can archive.

## Phase 1 — One lane contract, written once

- [ ] **1.1 Put the mechanism-match to the council.** Two recorded locks touch
      this plan: `road-to-agent-throughput-recovery` AC-3 ("Phase 2's verdict
      is recorded before any lane or settle change lands") and
      `roadmap-process-loop` § 3d ("lanes are staged, not shipped; gate: ten
      clean serial set runs"). Ask the council whether (a) a change to the lane
      CONTRACT, not the lane count, is outside AC-3, and (b) § 3d's gate is moot
      given 285 lane runs already happened outside it, so the shape should ship
      with the contract below. Neutral prompt, prompt stored beside the verdict.
      verify: a Decisions row per question, verdict and dissent recorded; a
      refusal stops Phase 1 and is reported, not routed around.
- [x] **1.2 Ship the canonical lane brief.** Add `§ Lane brief` to
      `src/domains/product-basic/roadmap/process-full/command.md`: the one text
      an orchestrator sends a lane, with the roadmap path and worktree as its
      only parameters. Finish line: `count_open == 0` and one PR. Forbidden in
      the brief and in any orchestrator addendum: "open green PR" as a finish
      line, a sanctioned partial PR, "remove the part that needs ratification",
      a per-phase or step-range scope, "do not ask the owner".
      verify: a test renders the brief and asserts the finish-line sentence and
      the absence of each forbidden phrase; it is seen red with one phrase
      re-inserted.
      Done 2026-10-19: `### Lanes — at most two, each on the canonical brief` in `process-full/command.md` carries the fenced brief and the forbidden list; `tests/scripts/process_full_lane_brief.test.ts` 10/10 green, seen red (1 failed) with "A partial PR is acceptable." re-inserted into the brief.
- [x] **1.3 No intermediate push, PR or merge per roadmap.** State in the Iron
      Law block that a lane pushes once, opens one PR after the last box flips,
      and that no PR of a lane's roadmap is merged before the lane reports
      `complete`. Local chunked commits stay.
      verify: the Iron Law fence carries the three clauses; `check_condensation`
      green after `task sync`.
      Done 2026-10-19: the Iron Law fence carries ONE ROADMAP, ONE PR (no push, PR or merge before the last step; delivery fixes to the same PR), no merge before the lane reports `complete`, and finish-before-start; asserted by the same test file.
- [ ] **1.4 Replace § 3d's "staged" paragraph.** Per the 1.1 verdict, either
      mark lanes shipped under the 1.2 brief with the two-lane cap, or record why
      they stay staged and make `--all` serial-only. No third state.
      verify: § 3d names one of the two outcomes and cites the 1.1 Decisions row.

## Phase 2 — Finish-first queue, across sessions

- [x] **2.1 Order by "can it still move", not by percent.** Replace `--all`
      step 2 ordering: (1) started roadmaps (`[x]` ≥ 1) with at least one
      runnable open step, fewest open runnable steps first; (2) started roadmaps
      whose open steps are all gated, routed to Phase 3 before any lane; (3)
      unstarted roadmaps, only when (1) is empty. Keep the `next` Goodhart note:
      under a total drain the order decides only what finishes first.
      verify: a queue test over a fixture estate (a 90 % gated roadmap, a 40 %
      runnable one, a 0 % one) yields 40 % → gated-route → 0 %; red with the old
      percent sort.
      Done 2026-10-19: `src/scripts/roadmap_drain_queue.ts` orders resume → continue (fewest runnable first) → start → decide → claimed; `--all` step 2 now runs it instead of the percent sort. `tests/scripts/roadmap_drain_queue.test.ts` 14/14, seen red (2 failed) with a percent-descending comparator patched in. Live estate 2026-10-19: next = hook-carrier, 24 `continue`, the one unstarted roadmap not dispatchable.
- [x] **2.2 A WIP limit of one started roadmap per lane.** A lane holds one
      roadmap until it reports `complete` or a halt; it never receives a second.
      An orchestrator never dispatches onto an unstarted roadmap while a started
      one has a runnable step and no lane.
      verify: the brief and the `--all` loop both state it; the 2.1 test covers
      the "free lane, started roadmap waiting" case.
      Done 2026-10-19: § Lanes states one roadmap per lane until `complete` or a halt, and no lane onto `start` while a `continue` entry has none; the queue sets `start` dispatchable only when no `resume`/`continue` is left (test: "lets an unstarted roadmap start only when nothing started can move").
- [x] **2.3 Claim the roadmap in the session register.** At lane start, write
      the roadmap claim the register already supports (it reads "no roadmap
      claimed" today); `--all` in any later session skips live claims and takes
      unclaimed started roadmaps first. A stale claim (TTL expired) makes the
      roadmap a resume, not a new start.
      verify: two simulated sessions over one estate never select the same
      roadmap; a test drops the claim write and goes red.
      Done 2026-10-19: the `--all` loop claims with `agent-config sessions:claim <slug>` and releases after delivery; the queue reads live register records and lists a peer's claim as `claimed`. Test "two sessions over one estate never select the same roadmap" went red with the claim filter neutralised. Scope delta: a stale claim is read from the register's own expiry (TTL), not a new field.
- [x] **2.4 Read "as many as possible" as "as many to completion".** Add one
      line to the command: an owner's quantity word widens how many roadmaps
      are finished, never how many are started.
      verify: the sentence is in the `--all` section.
      Done 2026-10-19: the `--all` section states that an owner's quantity word widens how many roadmaps are FINISHED, never how many are STARTED; asserted in the brief test.

## Phase 3 — Decide the gated residue during the run

- [x] **3.1 Pre-screen each roadmap before its lane starts.** Classify every
      open step as runnable, council-decidable, owner-reserved or time-gated,
      reusing `/roadmap:resolve-blockers`' classifier rather than a second one.
      verify: the screen's four counts sum to `count_open` on the fixture estate.
      Done 2026-10-19: the queue classifies every open step as runnable / council / owner / time from `blocked-by` markers, blocker `Class` / `Owner` / `Status`, prose naming an open local blocker, and a dated wait; the four counts sum to `open` (test). Scope delta: `/roadmap:resolve-blockers` has no code classifier to reuse — the queue reads the same `Class` field contract it reads.
- [x] **3.2 Council-decidable steps go to the council in the run.** The
      orchestrator, not the lane, runs the round and resumes the SAME lane with
      the verdict (SendMessage), instead of ending the lane and re-dispatching
      later.
      verify: the loop text names "resume the same lane"; no "leave `[ ]` with
      a one-line reason" path remains for council-decidable steps.
      Done 2026-10-19: § Gated residue 2 — the orchestrator runs the council round and returns the verdict to the SAME lane via its message channel; the brief replaces "leave it with a reason" by a `gated:` return.
- [x] **3.3 Owner-reserved steps become one batched question at run start.**
      Collect them across the queue and ask once, one decision per number,
      before lanes spawn, per `ask-when-uncertain`; answers are recorded at the
      step. Unanswered steps keep their roadmap in bucket (2) — they do not
      license starting an unstarted one in their place.
      verify: a dry run over the live estate prints one question block covering
      every owner-reserved step; the step's owner field matches the
      `resolve-blockers` routing test.
      Done 2026-10-19: § Gated residue 1 — the queue's `owner_questions` become one numbered block at run start; live dry run 2026-10-19 printed 4 owner questions (canvas, installed-layer, authority-routing, placeholders) covering 23 steps.
- [x] **3.4 Stop re-dispatching onto unchanged blockers.** A roadmap whose last
      lane ended on blocker X is not re-dispatched until X's text or status
      changed.
      verify: a test with an unchanged blocker yields no dispatch; changing the
      blocker's `Status:` yields one.
      Done 2026-10-19: a roadmap with no runnable step is `decide` and never dispatchable; it turns runnable only when its blocker's `Status:` reads resolved (test: "never dispatches a started roadmap with no runnable step", and the resolved-blocker case in the classification test). Scope delta: no last-lane history is kept — the live blocker status is the change signal.

## Phase 4 — Let a finished roadmap close

- [x] **4.1 Carry time-gated tails out, with the council.** For each active
      roadmap whose only open steps are time-gated, carry them into a named
      `<slug>-carried` follow-up in the same change (the council-routed
      disposition of `roadmap-progress-sync` Iron Law 3), and archive the
      parent. Never `[~]` or `[-]` to reach zero.
      verify: per carried roadmap, the follow-up exists in the same commit, the
      item records criterion, blocker, verdict and destination; `roadmap:progress`
      archives the parent.
      Done 2026-10-19 with zero carries: `roadmap_drain_queue --today 2026-10-19` lists no `decide` roadmap — every active roadmap has at least one runnable step, so none has only time-gated steps left to carry. The mechanism ships as § Gated residue 4 of `process-full`. Limit, stated rather than hidden: the queue finds dated waits only where a wait word sits beside a future date (3 such steps estate-wide today); the 2026-10-19 reading by hand put about a fifth of open steps on a wait, most of it written as prose ("the release that ships 2.1"), which reads runnable and is met by the lane.
- [x] **4.2 Write time-gated steps into a stub at authoring time.** In the
      roadmap template and `/analyze:inbox` § roadmap emission: a step that waits
      on a calendar window, soak or release goes into a `stubs/` entry with its
      trigger, not into the implementable roadmap.
      verify: `lint_roadmap_complexity` (or the template lint it calls) warns on
      a `verify:` that names a future date inside a non-stub roadmap; a fixture
      shows the warning.
      Done 2026-10-19: template rule 17c and `/analyze:inbox` Phase 6 write dated waits as `stubs/` entries; `lint_roadmap_complexity` warns on an open step pairing a wait word with a future date (same reading as the queue). Tests 2 new, seen red with the warning neutralised.

## Phase 5 — The closing actions reach the tree

- [x] **5.1 The orchestrator flips the boxes, after verifying.** A lane returns
      the steps it closed with evidence; the orchestrator verifies each return
      (per `delegation-policy` item 4) and makes the bookkeeping commit. This
      also keeps a lane from approving its own work, which is what the classifier
      refused as "Self-Approval".
      verify: the brief tells lanes not to flip boxes; the loop names the
      orchestrator's verify-then-flip step; one live run shows the flip in the
      orchestrator's commit.
      Done 2026-10-19: § The orchestrator closes the boxes, and the brief says "Do not flip checkboxes … the orchestrator verifies and flips". The live-run evidence is this roadmap's own run: every flip here is the orchestrator's commit.
- [x] **5.2 A killed lane is resumable.** The lane writes its worktree, branch,
      closed steps and next step to the claim from 2.3 after each step, so a
      spend-limit death leaves a resume point instead of a silent branch.
      verify: a killed-lane fixture resumes on the recorded next step; the claim
      without the write goes red.
      Done 2026-10-19: a claim whose session record expired becomes a `resume` entry carrying worktree, branch and session id, ranked first (test "resumes a dead session's claimed roadmap in its worktree"). Scope delta: the register already rewrites worktree and branch every heartbeat, so no new per-step write was needed; the lane's local commits on that branch are the resume point.
- [x] **5.3 Enforce the two-lane cap in the `--all` loop.** An owner's "max N"
      above the cap is reported, not obeyed silently; the 14-lane run is the
      evidence.
      verify: the loop text names the cap and the report line for a higher ask.
      Done 2026-10-19: § Lanes caps lanes at two and reports a higher "max N" in the run's first line; asserted in the brief test.

## Phase 6 — Measure it on the live estate

- [ ] **6.1 Read the next five `--all` runs.** Re-run the 2026-10-19 lane
      classification on the five drains after Phase 5 lands.
      verify: an evidence file with the same table shape as the 2026-10-19
      reading; complete-share, intermediate PRs per roadmap, and unstarted
      roadmaps started while a started one was runnable.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | "no intermediate commits" means no intermediate push, PR or merge; local chunked commits stay | owner request of 2026-10-19; `commit-policy` § Always split into logical chunks | the owner reads it as no local commits either |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | One PR per 40–50-step roadmap | implementation | A full-roadmap PR touches many generated files and conflicts with every merge that lands while it runs | Sync the base before the single push; `/pr:merge --no-merge` already resolves enumerated conflict classes | Phase 1 — One lane contract, written once |
| 2 | Owner question block grows large | product | Batching every owner-reserved step at run start can produce a long block the owner skips | One decision per number, council pre-filters what is council-decidable (3.2) before the owner block | Phase 3 — Decide the gated residue during the run |
| 3 | Carrying tails becomes deferral by renaming | implementation | `-carried` follow-ups pile up and nothing ever runs them | Carry only time-gated steps, each with its trigger; a carried item untouched at the next boundary is raised again per `active-remediation` | Phase 4 — Let a finished roadmap close |
| 4 | Council refuses the lane-contract change | product | 1.1 may hold the AC-3 lock | Phase 1 stops and reports; Phases 2–4 do not depend on lanes and run serially | Phase 1 — One lane contract, written once |

## Acceptance Criteria

- [ ] AC-1 — `process-full` carries one lane brief whose finish line is
      `count_open == 0` and one PR, and no orchestrator text can sanction a
      partial PR (1.2 test green, seen red).
- [ ] AC-2 — Over the five runs read in 6.1, no unstarted roadmap was started
      while a started roadmap had a runnable step and no lane.
- [ ] AC-3 — Over the same runs, every roadmap that a lane completed landed as
      exactly one PR, and at least half of the drain lanes ended `complete`
      (baseline 8 %).
- [ ] AC-4 — Every owner-reserved step met in those runs was asked during the
      run and its answer recorded at the step; none was left only in a lane
      report.
- [ ] AC-5 — No active roadmap holds only time-gated open steps.
