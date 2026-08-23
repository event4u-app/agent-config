---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
depends: []
drafted_against: 407915361
drafted_at: 2026-08-23
estate_offset_exempt: "An /analyze:inbox run consumes inbox notes and closes no roadmap, so there is no completed roadmap to retire against this addition."
estate_growth_exempt: "This change adds two roadmaps and three open blockers. The blockers are the finding, not an artefact of it: two of them record conditions that no owner can currently discharge, which is the defect this roadmap exists to make visible. Suppressing them to keep the count flat would delete the measurement."
---

# Road to unowned resume conditions

> **Source:** `agents/tmp.old/release-4.10.0` — a twelve-file drop analysed via
> `/analyze:inbox` at `407915361`. The drop is what surfaced this: it re-imported
> a roadmap that had been deliberately parked **one day earlier**, under the same
> filename, while the park's own resume gate was red. The re-arrival is the
> symptom. The defect is that the gate cannot turn green — so the same bundle
> will arrive again at 14.11.0, and the park has no way to end.

## Goal

Every recorded condition in this repository that says "resume when X" or
"decide by date D" either names an owner who can discharge it and a channel
through which X could arrive, or is restated as something reachable, or is
recorded as permanent. A reader can tell, per condition, which of the three it
is. Today two load-bearing conditions are none of them, and both were found by
accident.

## Context — two instances, both verified at `407915361`

### A. The park whose gate lost its owner

`agents/roadmaps/later/road-to-agent-config-next.md` parks the
architecture-tournament program on 2026-08-22 and resumes when **both** hold:

- **(a) ≥ 4 weeks of standing-payload delta measurements.** The instrument is
  `road-to-standing-payload-diet.md` Phase 0, steps 0.3–0.5 — all three still
  `[ ]`. Step 0.3's own verify command is the pre-state probe:
  `grep -ln "merge-base\|merge_base" .github/workflows/*.yml` returns **0
  files**. The ledger does not exist, so it holds zero weeks of entries.
- **(b) ≥ 95 % response-envelope adoption over ≥ 500 stops.** The named owner,
  `road-to-subagent-envelope-adoption`, was **archived** with Phase 2 (steps
  2.1–2.3) and AC-3 / AC-4 all `[-]`. Its last published rate is **0.00 % — 0
  `ok` of 1,296 stops**
  (`agents/evidence/investigations/subagent-envelope-return-baseline.md`). Its
  own blocker resolution names the arrival condition as "at least 500 stops
  carrying a post-split `envelope_parse` value from a ledger that is not this
  machine's drain traffic" and states in the same breath that **there is no
  arrival channel for it today**.

Leg (b) is not merely unmet. Its owning roadmap terminated without producing the
measurement, and the ledger it would come from is `agents/runtime/`, gitignored
at `.gitignore:190`, with no workflow ingesting it. A condition that cannot
receive its own input is an indefinite deferral — which the blocker record
itself names as the failure mode it was trying to avoid.

### B. The dated obligation that re-arms a structural freeze

ADR-133 freezes new large subsystems while any of four unblock conditions is
open, and lifts "without a superseding ADR" when all four are met. All four are
met at `407915361` — verified individually, and already recorded in
`docs/decisions/adr-evidence-sweep-2026-08.md:749`. But condition (d) is met
**only** through ADR-134's OR arm, and ADR-134 expires **2026-09-15**. On that
date the freeze re-arms unless ADR-134 is resolved first, while ADR-134's own
Consequences name satisfying ADR-133(d) as a benefit — a circular dependency
between two accepted records.

`grep -rl "2026-09-15" agents/roadmaps/*.md agents/roadmaps/later/*.md` returns
**nothing**. The date lives in archived roadmaps, evidence files and `docs/`. No
active roadmap owns it. None of the eleven inbox attachments mentions ADR-133 or
ADR-134 at all, while nine of them propose new structural subsystems.

## Phase 1 — Make the two known conditions decidable

**Exit criteria:** each of A and B is owned, restated, or recorded permanent,
with the decision written at the condition itself.
**Rollback:** every step is prose in an existing file; reverting is one commit.

- [~] **1.1 Give leg (b) an owner or a reachable restatement.** The current
      wording requires a measurement from a source that does not exist. Either
      name what would make it arrive, or restate it against something the tree
      can observe, or record the park as not-resumable-on-(b) and say what
      replaces it. **Human-gated:** restating a recorded resume condition
      downward is a weakening, and `decision-revisit-gate`'s owner-reserved
      table routes "weaken the criterion" to the owner, never the council.
      <!-- blocked-by: b-leg-b-restatement-is-owner-reserved -->
      verify: `later/road-to-agent-config-next.md` carries, at the resume condition, either a named owner for (b) or a restated condition whose input the tree can produce; and the decision names which.
- [ ] **1.2 Record leg (a)'s distance honestly at the park.** The park reads as
      a two-legged gate of comparable difficulty. It is not: (a) needs an
      unbuilt instrument to exist and then run for four weeks, which is a
      minimum of four weeks after `road-to-standing-payload-diet` Phase 0 closes,
      and that roadmap has 19 open steps and 0 closed.
      verify: the park states the earliest date (a) could possibly be met, derived from the diet roadmap's own state, and cites the step numbers.
- [ ] **1.3 Give the 2026-09-15 obligation an active owner.** Add it to an
      active roadmap or a stub with the re-arming consequence stated, so the
      date is visible from the estate rather than only from an evidence file.
      verify: `grep -rl "2026-09-15" agents/roadmaps/` matches at least one file outside `archive/`, and that file names ADR-133's re-arming as the consequence.

## Phase 2 — Sweep the rest, report only

**Exit criteria:** a one-time inventory exists; nothing is gated on it.
**Rollback:** delete one evidence file.

- [ ] **2.1 Classify every parked roadmap's resume condition.** For each file
      under `agents/roadmaps/later/`, record one of: `reachable` (an owner and a
      channel both exist), `unreachable` (the input cannot arrive), or `absent`
      (no resume condition stated). Report it; do not gate on it — a gate over a
      judgement call is the mechanism this repository's own reviewers keep
      asking it to stop building.
      verify: the written inventory covers every `*.md` under `agents/roadmaps/later/` — count matches `ls agents/roadmaps/later/*.md | wc -l` — and each row carries its verdict and the evidence for it.
- [ ] **2.2 State what the inventory found, including a null.** If every other
      parked condition is reachable, that is the result and it says the two
      instances above are idiosyncratic rather than systemic. Record it as such
      instead of manufacturing a pattern.
      verify: the inventory's summary states the counts per verdict, and if `unreachable` is 0 outside the known instance, says so explicitly.

## Blockers

### b-leg-b-restatement-is-owner-reserved
- **Blocks:** step 1.1
- **Class:** 2
- **What to do:** the owner decides one of — (a) name what would make ≥ 500
  non-local stops arrive and keep the condition; (b) restate (b) against an
  observable the tree already produces, accepting that this is a weakening; or
  (c) record the park as permanent on (b) and name what would reopen it instead.
- **Recommendation:** none offered. This is the owner-reserved class by
  construction, and a recommendation from the party that surfaced the finding is
  the shape `evaluator-independence` exists to refuse.
- **If you do nothing:** the park never ends, and the same twelve-file bundle
  re-arrives at every release, each time re-importing the twelve-item version
  the park exists to keep out.
- **Resolved when:** the resume condition names an owner, or is restated, or is
  recorded permanent.
- **Status:** open

### b-adr-134-expiry-is-owner-reserved
- **Blocks:** step 1.3 in part
- **Class:** 2
- **What to do:** step 1.3 only makes the date visible. **Resolving** ADR-134 —
  posting the launch decision or writing a successor deferral with a new expiry
  — is the maintainer's, per ADR-134's own terms ("the maintainer either posts
  … or writes a successor deferral ADR with a signed reason").
- **If you do nothing:** on 2026-09-15 the expiry lapses with neither action,
  which ADR-134 calls "an open compliance finding for the next review cycle, not
  a silent extension", and ADR-133's freeze re-arms.
- **Resolved when:** ADR-134 is resolved or succeeded, or the lapse is recorded
  as a deliberate compliance finding.
- **Status:** open

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The restatement becomes a quiet unparking | product | "Make the condition reachable" is one edit away from "make the condition easy", which would resume a program the estate cannot carry — the exact outcome the park prevented | 1.1 is `[~]` and blocked on an owner-reserved decision; no council or agent path exists to lower it | Phase 1 |
| 2 | The sweep becomes a governance layer | product | Twelve reviewers converge on "prove, attribute, close — not expand"; an inventory that grows into a gate over parked-roadmap metadata is precisely the expansion they name | 2.1 is report-only by construction, and 2.2 requires a null to be reportable as a result | Phase 2 |
| 3 | The two instances are not a class | implementation | Two findings do not establish a pattern; building Phase 2 on the assumption that they do would be the over-generalisation this repo's own abstraction thresholds forbid | 2.2 makes "no other instance" a legitimate and expected outcome, stated before the sweep runs | Phase 2 |
| 4 | 1.3 satisfies the letter and misses the point | implementation | Adding the date to a roadmap makes a grep match without making anyone act, and the obligation lapses anyway | 1.3's verify requires the consequence (freeze re-arming) to be named alongside the date, not just the date | Phase 1 |

## Acceptance Criteria

- [ ] AC-1 — `later/road-to-agent-config-next.md`'s resume condition states, per
      leg, whether it is owned, restated, or permanent — and a reader can tell
      which without opening another file.
- [ ] AC-2 — The earliest possible date for leg (a) is derived and written at the
      park, from the diet roadmap's own open-step state rather than from an
      estimate.
- [ ] AC-3 — `2026-09-15` is reachable by grep from a non-archived roadmap, with
      ADR-133's re-arming named as the consequence.
- [ ] AC-4 — The parked-roadmap inventory exists, covers every file under
      `later/`, and its summary reports counts per verdict including a null.
