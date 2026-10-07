---
complexity: lightweight
status: later
review_by: 2027-01-06
entry_condition:
  what: >
    The labelled routing matrix behind `report_skill_ranker_confusion` passes
    1,000 rows (`readMatrixLabelledPrompts` in
    `src/scripts/measure_skill_ranker_baseline.ts`; 390 on 2026-10-06) and the
    sealed slice is re-cut, so step 4.2's one sealed read is out of sample.
  when: >
    When the parked corpus roadmap `later/road-to-a-menu-whose-precision-is-measured`
    grows the matrix; no earlier date is meaningful (D1).
  who: >
    Whoever grows the corpus; then any agent runs step 4.2 and AC-3.
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The archived ranker roadmap named the alphabetical tie-break as the largest class after zero recall and handed it to whoever reopens with a larger corpus; there is no live owner to merge into. The nearest live roadmap, later/road-to-a-menu-whose-precision-is-measured, owns corpus growth, and folding a ranker-mechanism change into a parked corpus roadmap would wait on a wake condition that has nothing to do with ties. Nothing archivable or parkable buys the slot."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; no live roadmap owns the ranker's tie path."
relates:
  - slug: road-to-a-menu-whose-precision-is-measured
    relation: disjoint
    note: "Parked. Owns growing the labelled corpus toward D2's 1,000 rows; this file measures one mechanism on the corpus that exists and adds no rows."
  - slug: road-to-a-ranker-that-routes
    relation: extends
    note: "Archived. Its evidence page names the tie class and assigns it forward; this file picks that up under its D2 and leaves its cuts in place."
---
# Road to a ranker whose ties break on signal

> **Source:** an external review round (opaque id inbox-2026-10-e), consumed
> into `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at
> `main` @ `a75bb3210` on 2026-10-06.

> **Parked 2026-10-06.** Phases 1 to 5 landed on tuning; the council's D1
> verdict keeps the one sealed read (4.2, AC-3) for a freshly cut slice past
> 1,000 labelled rows. Resume when the `entry_condition` above holds.

## Goal

When two skills score the same, the order between them comes from something
the ranker measured, not from their names — behind one flag, default off, with
the default path byte-identical. The effect is read once on the sealed slice
and published whichever way it falls. Whether to turn it on is decided
elsewhere.

## Context

- The production score is an integer. `src/shared/skillRanking.ts:260` returns
  `roundHalfToEven(overlap * 70 + personaHit * 30)`; `:287` sorts by score and
  then by name; `:285` drops only score 0, so there is no abstention.
  `RankOptions` (`:136-154`) holds four opt-in flags — `includeTriggers`,
  `includeWhenToUse`, `includeHeadings`, `idfWeighting` — all default off, and
  `:130-134` pins every-flag-off to the Python-parity scorer.
- The alphabet decides one row in five.
  `agents/evidence/analysis/skill-ranker-confusion-2026-10-01.md:377-386`: ties
  decided alphabetically on 67 of 315 tuning rows (21.3 %) and 15 of 75 sealed
  (20.0 %); "had those ties broken the other way" tuning top-1 reads 0.432
  against 0.219 and sealed 0.360 against 0.160, "straddling the entire 0.251
  promotion bar". The page does not fix it, assigns it "to whoever reopens this
  with a larger corpus", and calls it "the cheapest deterministic change on the
  table" (`:388-396`).
- The one measured lift is mostly tie-breaking: `idf` cuts tie-decided misses
  from 67 to 20 on tuning and 15 to 5 on sealed while its whole top-1 lift is
  +5 and +1 rows (`:256-261`).
- False activation: 25 of 153 deliberate no-skill tuning rows (16.3 %) reach the
  median score of a correct hit (`:64-72`), from
  `src/scripts/report_skill_ranker_confusion.ts`.
- The lock and its scope. `agents/roadmaps/archive/road-to-a-ranker-that-routes.md:172`
  is D2: claims are read on a sealed 20 % slice, revisit when the corpus passes
  1,000 rows. `:147-148` cuts any embedding or model-based ranker and `:162`
  cuts "two-stage shortlist plus semantic rerank". Mechanism-match: D2 governs
  how a claim is read, not which mechanism may be measured on tuning; the
  rerank cut is a different mechanism and is not reopened here.

## Phase 1 — Whether to reopen before 1,000 rows

- [x] **1.1 The council's verdict is recorded.** The blocker below is put to
      the council with the D2 text, the 67/315 and 15/75 figures and the
      mechanism-match argument, and the verdict is written into this file's
      Decisions table.
      verify: `grep -c 'Status:\*\* resolved' agents/roadmaps/later/road-to-a-ranker-whose-ties-break-on-signal.md` -> /^[1-9]/

## Phase 2 — The tie, as a metric

- [x] **2.1 Two metrics in the
      confusion report.** `report_skill_ranker_confusion` prints
      `top1_loss_due_to_tie` (rows whose expected skill shares the top score
      and loses on order) and `expected_in_top_score_block` (rows whose
      expected skill is anywhere in the top-score block). A test reproduces 67
      of 315 on tuning and 15 of 75 on sealed from the committed corpus.
      verify: `npx vitest run tests/scripts/skill_ranker_tie_metrics.test.ts` -> 0

## Phase 3 — One flag

- [x] **3.1 A tie path behind
      a flag.** `RankOptions` gains one flag — an unrounded score used only to
      order equal integer scores (D4) — default off. With every flag off the output is byte-identical, shown
      by the existing parity suites; a sabotage test shows the flag changes
      order on a fixture tie.
      verify: `npx vitest run tests/scripts/score_skill_relevance.test.ts tests/scripts/skill_ranking_shared.test.ts tests/scripts/skill_ranking_tie_flag.test.ts` -> 0

## Phase 4 — Measured, then read once

- [x] **4.1 Tuning.** Under the flag, the report runs on tuning. The readings,
      the flag configuration and the commands go to
      `agents/evidence/analysis/skill-ranker-ties-2026-10.md` with its
      `evidence-type` marker. (Split from the original 4.1 by D1: the sealed
      half is 4.2.)
      verify: `grep -c 'tuning' agents/evidence/analysis/skill-ranker-ties-2026-10.md` -> /^[1-9]/
- [ ] <!-- blocked-by: sealed-read-awaits-recut --> **4.2 The sealed slice,
      once.** On the freshly cut sealed slice, the report runs once under the
      flag with a Wilson interval against the 0.251 bar, and the reading, its
      command and the pre-registered metrics (top-1, `top1_loss_due_to_tie`,
      `expected_in_top_score_block`) go to the evidence page under a
      `## Sealed reading under the flag` heading, whether the interval clears
      the bar or not.
      verify: `grep -c 'Sealed reading under the flag' agents/evidence/analysis/skill-ranker-ties-2026-10.md` -> /^[1-9]/

## Phase 5 — Abstention, beside its cost

- [x] **5.1 The empties under the flag.** The page gains the no-skill rate over
      the 153 empties under the flag, and one abstention threshold with the
      recall it costs on correct hits at that threshold, side by side.
      verify: `grep -c 'abstention' agents/evidence/analysis/skill-ranker-ties-2026-10.md` -> /^[1-9]/

## Phase 6 — Promotion stays out

- [~] **6.1 Promotion is a separate decision.** Turning the flag on in the
      `skill-route` hook or the MCP tool is an owner or council step taken
      after the page exists, in its own change. Deferred here by design.
      verify: `grep -c 'promotion decision' agents/evidence/analysis/skill-ranker-ties-2026-10.md` -> /^[1-9]/

## What this roadmap deliberately does not do

- No structural context signal: zero corpus rows carry `open_files` or a
  `command` (`road-to-a-ranker-that-routes.md:139-143`).
- No embedding, semantic rerank or model-based ranker — the archived cuts stand.
- No production default change; 6.1 is deferred by design.
- No new labelled rows; corpus growth belongs to the parked roadmap in
  `relates`.

## Acceptance Criteria

- [x] AC-1 — The confusion report prints the two tie metrics and reproduces
      67/315 and 15/75 at the pinned corpus.
- [x] AC-2 — With every flag off the ranking is byte-identical; with the new
      flag on, a fixture tie resolves differently.
- [ ] <!-- blocked-by: sealed-read-awaits-recut --> AC-3 — One sealed-slice
      reading under the flag is published with its Wilson interval against
      0.251, whatever it shows.
- [x] AC-4 — The no-skill rate and one abstention threshold are published
      beside the recall that threshold costs.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | council | Option (b), refined: build the flag default-off and measure it on tuning as exploratory now; hold the one sealed read for a freshly cut slice past 1,000 labelled rows | AI council 2026-10-06, `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, 2/2 convergent, $0 (subscription seats). Both: the 75 sealed rows already motivated the mechanism (15/75 and the 0.360 counterfactual are published), so a read now is not out of sample; at n = 75 the interval cannot settle 0.251. The openai seat asked for the sealed metrics to be pre-registered — done in 4.2 | The corpus passes 1,000 rows and the slice is re-cut |
| D2 | reversible-technical | evidence | One flag, default off, parity-pinned | `skillRanking.ts:128-134` requires one flag per signal so a configuration is a named set | — |
| D3 | reversible-technical | evidence | The sealed slice is read exactly once | Archived D2: tuning and reading on one corpus overfits it | The corpus passes 1,000 rows and the slice is re-cut |
| D4 | reversible-technical | agent | The tie path is the unrounded score, not a new secondary score | It changes no score, only the order inside a tie, so the parity suites hold with the flag off and nothing new has to be tuned; a secondary signal would be a fifth ranking input, which the archived roadmap's cut keeps out until measured | Ties left after the unrounded score still decide more than a tenth of tuning rows — **fired 2026-10-06 for the flag alone (67/315, 21.3 %: under `keyword-v1` every integer tie is an exact unrounded tie); not for `idf+ties` (14/315, 4.4 %)**. See the evidence page |

## Blockers

### blocker: tie-path-reopen-before-d2
- **Status:** resolved 2026-10-06 — council verdict (b), refined, recorded as D1. Steps 2.1 and 3.1, AC-1 and AC-2 proceeded as exploratory tuning work; the sealed half moved to `sealed-read-awaits-recut`.
- **Owner:** council
- **Blocks:** steps 2.1 and 3.1, AC-1, AC-2, AC-3
- **What to do:** pick exactly one — (a) measure the tie mechanism now on the tuning slice with `./scripts-run src/scripts/report_skill_ranker_confusion --slice tuning` and read the sealed slice once in Phase 4, or (b) wait until the corpus behind `report_skill_ranker_confusion` passes 1,000 labelled rows, as `agents/roadmaps/archive/road-to-a-ranker-that-routes.md:172` names.
- **Resolved when:** the council verdict naming (a) or (b) is recorded as D1 in this file's Decisions table.
- **Recommendation:** (a) — D2 governs how a claim is read, and Phase 4 reads the sealed slice exactly once; the evidence page itself calls the tie fix the first thing to try.
- **If you do nothing:** the alphabet keeps deciding one row in five, and the next corpus reading repeats the same confound.

### blocker: sealed-read-awaits-recut
- **Status:** open
- **Owner:** external — corpus growth, owned by `later/road-to-a-menu-whose-precision-is-measured`
- **Blocks:** step 4.2, AC-3
- **What to do:** (1) grow the labelled routing matrix past 1,000 rows and re-cut the sealed slice; (2) then run `./scripts-run src/scripts/report_skill_ranker_confusion --slice sealed --ranker idf+ties` exactly once and write the reading to `agents/evidence/analysis/skill-ranker-ties-2026-10.md` under `## Sealed reading under the flag`.
- **Resolved when:** the labelled row count from `readMatrixLabelledPrompts` exceeds 1,000 and the re-cut is committed.
- **Recommendation:** read `idf+ties`, not `ties` alone — the evidence page shows the flag alone reorders nothing under `keyword-v1`.
- **If you do nothing:** the flag stays measured on tuning only, as exploratory, and no promotion can be argued from it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The flag leaks into the default path | implementation | A change to rounding or sort reaches the live hook. | Parity suites green with every flag off; the flag only orders equal integer scores. | Phase 3 — One flag |
| 2 | The sealed slice is read more than once | implementation | A second look makes the interval circular. | D3; Phase 4 names one sealed command and the page records it. | Phase 4 — Measured, then read once |
| 3 | A positive reading is taken as promotion | product | A cleared bar reads as permission to ship. | 6.1 is deferred and owned elsewhere. | Phase 6 — Promotion stays out |
| 4 | The tie counts do not reproduce | implementation | The corpus moved since 2026-10-01. | 2.1 pins the corpus commit in its test and reports the drift if it differs. | Phase 2 — The tie, as a metric |
