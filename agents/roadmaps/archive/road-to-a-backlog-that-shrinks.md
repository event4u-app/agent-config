---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
estate_offset_exempt: "Archiving another active roadmap to pay for this one was rejected — which roadmaps stay active is the owner's WIP selection (OQ-4), not this run's. Written to be closed and archived in the PR that adds it, so the active count does not grow."
relates:
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: "Phase 4 rewrites the depth table's council and evidence wording to the 2026-10-24 directive. Its open steps (async telemetry, flip reading, A/B) stay there."
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "Owns the measurement windows and guard misfires. Phase 5 here only caps live sessions at dispatch."
---
# Road to a backlog that shrinks

> **Source:** `agents/tmp.old/inbox-2026-10-af/` — a transcript of the owner's
> question "why are we barely moving?", the owner directive of 2026-10-24 it
> produced, and a supplied draft plan. Figures re-read at `main@d463ed79`.

## Goal

The 2026-10-24 owner directive (throughput over ceremony) holds without anyone
re-stating it: the drain queue parks a step that eats days, refuses to start a
sixth roadmap or dispatch past three live sessions, lists owner questions that
are not on `agents/owner-questions.md`; the depth table calls the council only
for irreversible, release- or security-relevant questions; and one command
prints the evening report. Tests and CI are unchanged — only justification
paperwork is cut.

## Context — verified at `main@d463ed79`

| # | Finding | Read at |
|---|---|---|
| F1 | A step without a `blocked-by` marker reads runnable, so a step absorbing rounds is re-dispatched every drain. | `roadmap_drain_queue.ts:33-34` |
| F2 | 109 steps over the 150-word cap are held by name only — no ceiling, so a held step can keep growing. | `roadmap-step-size-baseline.json`, `_lib/roadmap_step_size.ts:53` |
| F3 | All 23 active roadmaps carry an `estate_*_exempt` line; growth by exemption is "deliberately unbounded". | `check_estate_count.ts:67-75` |
| F4 | 40 blockers read `asked: no`, none `asked: yes`; the owner sheet lists 3 questions. | `grep`, `agents/owner-questions.md` |
| F5 | The depth table is `mode: shadow`, so its `full` row applies: council "on any open question", evidence "an artefact under `agents/evidence/`". | `src/config/step-depth-table.json` |
| F6 | The queue starts an unstarted roadmap whenever nothing started can move — no cap on started roadmaps, none on live sessions. | `roadmap_drain_queue.ts:394-400` |
| F7 | `probe_turnaround --git` already tallies net ticked steps per night; no mode prints the directive's five evening figures. | `_lib/turnaround_throughput.ts:182` |

## Phase 1 — The directive on record, owner questions on one sheet

- [x] **1.1 Record the directive verbatim.** Write <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`
      with the directive text, its provenance (drafted in an external chat at the
      owner's request, issued by the owner), and what it does not grant.
      verify: the file exists and quotes "Durchsatz vor Zeremonie".
- [x] **1.2 The queue names owner questions missing from the sheet.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      `roadmap_drain_queue` reads blocker ids cited on `agents/owner-questions.md`
      and reports each owner-class question whose blocker id is absent as
      `not on the sheet`, with the count.
      verify: a unit test with one sheeted and one unsheeted owner blocker reports exactly the second.
- [x] **1.3 Runs put questions on the sheet, never in a question-only PR.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `process-full-all.md` § Gated residue and `roadmap-process-loop` § 5
      step 4: an owner-owned question becomes a row on the sheet, the run takes
      the next step; a PR whose only change registers a question is not opened.
      verify: both files name `agents/owner-questions.md`.

## Phase 2 — A step cannot eat the day

- [x] **2.1 Timebox markers park a step.** A step carrying <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      `<!-- partial: N -->` with N ≥ 3, or `<!-- started: YYYY-MM-DD -->` two or
      more days before today, reads `held` with blocker `timebox` and is listed
      under `timeboxed` in the queue output.
      verify: unit tests cover partial 2 (runnable), partial 3, started today−2 and started today−1.
- [x] **2.2 The run writes the markers and the result note.** `process-full-all.md`: <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      a delivery that lands work on a step without ticking it sets `started:` once
      and increments `partial:`; a timeboxed step is condensed to result, open
      question and split, never extended.
      verify: `process-full-all.md` names both markers.
- [x] **2.3 Decision cap.** `lint_roadmap_complexity` warns when one step cites <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/roadmap_step_size.ts -->
      more than 10 distinct decision ids (`D1`…): split, do not extend. Warning,
      never red.
      verify: `npx vitest run tests/scripts/roadmap_step_size.test.ts` -> 0
- [x] **2.4 Held steps get a ceiling.** The step-size baseline records each held <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/roadmap-step-size-baseline.json -->
      step's word count; a held step may shrink, never grow.
      verify: a unit test where a held step grows past its recorded count reports a problem.

## Phase 3 — Work in progress is capped at five

- [x] **3.1 The queue starts nothing past five.** An unstarted roadmap is <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      dispatchable only while fewer than five active roadmaps are started — pull,
      not push.
      verify: a unit test with five started roadmaps leaves the `start` entry undispatchable.
- [x] **3.2 Above five, an exemption needs an owner record.** `check_estate_count`: <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_estate_count.ts -->
      while the active count at HEAD exceeds five, an added roadmap's
      `estate_offset_exempt` counts only if it cites an existing file under
      `agents/evidence/owner-directives/`.
      verify: the script's self-test carries a reject and an accept fixture for it.
- [x] **3.3 Inbox output fills owners or `later/`.** `/analyze:inbox` Phase 6: a <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      surviving finding without an owner is written to `agents/roadmaps/later/`
      while five or more roadmaps are active, unless the operator asks for an
      active one.
      verify: the command file names the WIP cap of five.
- [x] **3.4 The owner chooses the five.** Add the ranked proposal (benefit and <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      nearness to finish) as one question on `agents/owner-questions.md`.
      verify: the sheet carries the WIP question with its options.

## Phase 4 — Ceremony by risk

- [x] **4.1 Depth table follows the directive.** `full` and `R2`: council only <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/step-depth-table.json -->
      for irreversible, release- or security-relevant questions; evidence is the
      PR body, an artefact only when it must be re-read (release, security,
      owner-reserved). R3 unchanged.
      verify: the table's `full.council` names "irreversible" and the step-receipt tests stay green.
- [x] **4.2 Lowering R0/R1 below the full row stays the owner's.** The flip <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      threshold (30 shadow steps) is the owner's 2026-10-21 decision; reversing it
      is put on the sheet as one question, not done here.
      verify: `grep -c 2026-10-21-review-cap-and-depth-flip agents/owner-questions.md` -> /^[1-9]/

## Phase 5 — Parallelism and test cost

- [x] **5.1 Three live sessions, then no dispatch.** When three or more other <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_drain_queue.ts -->
      sessions hold live claims, the queue's `next` is empty with the reason
      `session cap (3)`.
      verify: a unit test with three live foreign claims yields no `next`.
- [x] **5.2 Related tests during work, the full suite at the gate.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `process-full-all.md` § Delivery says so, with the command.
      verify: the file names `vitest related`.
- [x] **5.3 Council and vitest calls per session.** `probe_turnaround --calls` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/estate_daily.ts -->
      counts Bash calls running the council or vitest in the current session's
      transcript; the delivery summary prints them.
      verify: a unit test over a fixture transcript counts two council and three vitest calls.

## Phase 6 — The evening report

- [x] **6.1 One command, five figures.** `probe_turnaround --daily` prints, over <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/estate_daily.ts -->
      the last 24 h on `main`: closed steps (split by roadmap age over 7 days),
      open steps now against 24 h ago, `agents/evidence/` lines against `src/` +
      `tests/` lines, timeboxed steps, owner questions added.
      verify: a unit test over a temporary git repository reproduces each figure.
- [x] **6.2 The report is part of the drain's close.** `process-full-all.md` <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      names `--daily` as the evening report.
      verify: the file names `probe_turnaround --daily`.

## Decisions

| ID | Decision | Why |
|---|---|---|
| D1 | The supplied plan's supersession of two roadmaps is not adopted. | 16 open steps, several measurement windows over several drains — this file could not close; the owner's WIP selection (3.4) decides their fate. |
| D2 | WIP cap is five, not the supplied 12 → 8. | The owner directive names five. |
| D3 | No new gate, no hook, no standing-rule prose. | A new gate needs a ratification round; the hook bundle and the per-spawn preamble have no headroom. Existing readers are extended. |
| D4 | Exemption owner records bind only above the cap and only on added files. | Retroactive application would red all 23 active roadmaps. |

## Declined from the supplied plan

- Daily metric thresholds (≥ 2× baseline, ≤ 0.5 ratio) and the day-14 keep-or-rollback reading: the report prints the figures; no flip is made here to roll back.
- Lanes derived from quota counters: the session cap is the directive's measurable form; quota-derived lanes stay with the cold-start and throughput roadmaps.
- Classifying shrink-only baseline edits as R1: classifier changes are R3 by construction (self-protection clause).
- Path-disjoint dispatch: roadmaps declare no paths, and claims already keep two sessions off one roadmap.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Markers nobody writes | product | Timebox markers are written by the run; a run that skips them leaves the stall invisible. | The evening report counts timeboxed steps; zero over a week of partial PRs is the signal. | Phase 2 — A step cannot eat the day |
| 2 | Cap starves a started roadmap | implementation | The five-started cap could leave all five blocked and nothing dispatchable. | `decide` and owner sheet are unchanged; a blocked roadmap is parked by the owner's selection (3.4). | Phase 3 — Work in progress is capped at five |
| 3 | Lower ceremony lets a defect through | product | Fewer council rounds remove a reviewer. | Tests, CI and R3 depth are unchanged; only the council and evidence wording move. | Phase 4 — Ceremony by risk |

## Acceptance Criteria

- [ ] AC-1 — The drain queue reports timeboxed steps, unsheeted owner questions,
      the five-started cap and the three-session cap, each covered by a unit test.
- [ ] AC-2 — The depth table and the run procedures carry the directive's council
      and evidence wording; no test, CI check or R3 depth changed.
- [ ] AC-3 — `probe_turnaround --daily` and `--calls` print their figures on
      today's tree.
- [ ] AC-4 — The owner sheet carries the WIP selection and the flip question.
