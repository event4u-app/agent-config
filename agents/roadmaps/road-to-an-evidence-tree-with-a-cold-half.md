---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The evidence tree is 32 MB and 1,317 tracked files with a contract retention of permanent, and 160 files arrived in one release; the round's reviews name a hot/cold cut their first priority across two releases and no roadmap in any estate directory has ever carried it. Merging into an archived estate-triage roadmap was rejected because those moved roadmaps, not evidence, and parking an active roadmap would not shrink a tree nobody is pruning."
relates:
  - slug: road-to-estate-triage-remaining-batches
    relation: disjoint
    note: That stub triages roadmaps; this one triages the evidence those roadmaps leave behind.
---
# Road to an evidence tree with a cold half

> **Source:** `agents/tmp.old/inbox-2026-10-a/` — a round of sixteen external
> reviews of the 16.2.0 release; one ranks an evidence hot/cold cut as its first
> priority for the second release running, another names the two re-measurements
> the archive still owes. Verified against `main` at `9bc8cd4f2` on 2026-10-01;
> disposition at `agents/evidence/analysis/inbox-2026-10-a-disposition.md`.

## Goal

Evidence that no live roadmap, contract or gate reads moves to a cold location
that every scanning gate skips, and the two measurements the archive carried away
unrun get one reading each. Done means: a census names the cold set by rule rather
than by hand, the council has ruled on the location and the rule, the move lands
with the contract amended, and readings exist for the turnaround round-trip
count and for mean batch size against their 2026-08-30 baselines.

## Context

Measured on 2026-10-01:

- `agents/evidence/` is 32 MB and 1,317 tracked files; `reviews/` alone is 821
  files and 26 MB. 160 files were added between the 16.1.0 tag and `main`.
- `docs/contracts/agents-layout.md:82` gives `evidence/` the retention
  `permanent`, so any cold location is a contract amendment.
- The turnaround round-trip figure (42.6 per request) was measured once in
  `road-to-agent-turnaround`; its re-measurement was transferred to
  `road-to-turnaround-followups` and then to
  `road-to-obligation-delivery-verification` step 1.2, which closed `[-]` in the
  archive without a reading. The probe exists: `src/scripts/probe_turnaround.ts`
  writes nothing.

## Phase 1 — Name the cold set by rule

- [x] **1.1 Census.** For every tracked file under `agents/evidence/`: bytes,
      first-added date, and the set of tracked files outside `agents/evidence/`
      that reference its path. Classify as hot (referenced by an active,
      later or stub roadmap, a contract, a gate or a test), warm (referenced only
      by archived roadmaps) or cold (referenced by nothing). Report-only, written
      to `agents/evidence/analysis/evidence-temperature-<date>.md`.
      verify: `grep -c 'cold' agents/evidence/analysis/evidence-temperature-*.md` -> /^[1-9]/
- [x] **1.2 Name the gates that scan the tree.** List each script that reads
      under `agents/evidence/`, and what it would lose or gain if cold files left
      its scan root. A gate that relies on a cold file reclassifies it hot.
      verify: `grep -c 'scan root' agents/evidence/analysis/evidence-temperature-*.md` -> /^[1-9]/

## Phase 2 — Decide the location and the rule

- [ ] **2.1 Council ruling.** Put three options to the council with 1.1 and 1.2
      attached: (a) `agents/evidence/cold/` inside the tree, excluded from every
      scan root and from the published package; (b) delete cold files, leaving
      git history as the archive; (c) keep everything and only exclude cold paths
      from scan roots. Record the verdict, both seats and a `revisit-if` in
      `## Decisions`.
      verify: `grep -c 'council' agents/roadmaps/road-to-an-evidence-tree-with-a-cold-half.md` -> /^[1-9]/
- [ ] **2.2 Amend the contract.** Change `agents-layout.md`'s `evidence/` row to
      state the cold location and the classification rule the verdict chose.
      verify: `grep -c 'cold' docs/contracts/agents-layout.md` -> /^[1-9]/

## Phase 3 — Move, and keep it moved

- [ ] **3.1 Move the cold set.** Apply the verdict to the files 1.1 classed
      cold, in one change whose message names the census file and the count.
      Every reference checker must stay green: a moved file that something still
      cites was not cold.
      verify: `./scripts-run src/scripts/check_references` -> 0
- [ ] **3.2 A gate keeps new cold files from staying hot by default.** The
      census runs report-only on each release and lists files newly cold since
      the last run; nothing refuses.
      verify: `npx vitest run tests/scripts/report_evidence_temperature.test.ts` -> 0

## Phase 4 — The two readings the archive still owes

- [ ] **4.1 Re-run the turnaround probe against its baseline.** Run
      `./scripts-run src/scripts/probe_turnaround --limit 10 --against-baseline`
      over sessions after 2026-08-30 and record the four figures the probe
      reports — round-trips per request, mean tool-call batch size (the serial
      measure), the over-60-second blocking tail and its share of tool time, and
      the context floor — beside the 2026-08-30 baseline, in whichever direction
      they moved, with the session window and the excluded count.
      verify: `grep -c 'against-baseline' agents/evidence/analysis/turnaround-reading-*.md` -> /^[1-9]/

## Gap table

| Source item | Verdict | Where |
|---|---|---|
| Evidence hot/cold lifecycle — move, not analyse | KEEP, census first because the rule must be checkable | Phase 1 to Phase 3 |
| Large evidence documents are a drift source | FOLD — the cold move removes them from scan roots | Phase 3 |
| Re-measure turnaround 42.6 → X | KEEP | 4.1 |
| Release size — cut more often | CUT here — release cadence is the owner's practice, not a tree change | disposition |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:step-2.1 | Location and rule for cold evidence | Pending 2.1 | Council verdict lands |
| D2 | reversible-technical | evidence | Classify by reference, not by age | An old file a contract cites is load-bearing; a new file nothing cites is not | 1.1 shows referenced files that are demonstrably dead |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A cold file was the only record of a decision | product | Evidence cited by nothing can still be the only place a measurement lives, and moving it out of scan roots makes it unfindable by the next round. | The council weighs option (c), which keeps every file in place; 1.1 reports bytes and dates so the cost of keeping is visible. | Phase 2 — Decide the location and the rule |
| 2 | A reference resolver misses a citation form | implementation | Paths cited without a link — in prose, in a JSON field — are missed, and a cited file is classed cold. | 3.1 requires `check_references` green after the move, and 1.2 lists each gate's scan root. | Phase 1 — Name the cold set by rule |
| 3 | The turnaround reading is read as a verdict on a mechanism | product | A delta over a window that includes delivery changes cannot attribute the movement to one cause. | 4.1 records the window and excluded count beside the figure and draws no attribution. | Phase 4 — The two readings the archive still owes |

## Acceptance Criteria

- [ ] AC-1 — A census classifies every tracked evidence file by reference, and
      the cold set is named by that rule.
- [ ] AC-2 — The evidence row of the layout contract states the cold location
      and rule the council chose.
- [ ] AC-3 — The cold set has moved and every reference check is green.
- [ ] AC-4 — A turnaround reading against the 2026-08-30 baseline exists.
