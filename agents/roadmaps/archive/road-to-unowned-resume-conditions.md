---
complexity: lightweight
status: ready
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

- [x] **1.1 Give leg (b) an owner — outlet (a), the restatement left untaken.** The current
      wording requires a measurement from a source that does not exist. Either
      name what would make it arrive, or restate it against something the tree
      can observe, or record the park as not-resumable-on-(b) and say what
      replaces it. **Human-gated:** restating a recorded resume condition
      downward is a weakening, and `decision-revisit-gate`'s owner-reserved
      table routes "weaken the criterion" to the owner, never the council.
      verify (discharged): `later/road-to-agent-config-next.md` carries, at the resume condition, either a named owner for (b) or a restated condition whose input the tree can produce; and the decision names which.

      **CLOSED ON THE FIRST LIMB — a named owner, not a restatement.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent,
      taking the blocker's **outlet (a)**: *"name what would make >= 500 non-local
      stops arrive and keep the condition."* That outlet ADDS a condition rather
      than lowering one, so it does not touch the owner-reserved transition —
      restating (b) downward is a weakening and stays with the owner, per
      `decision-revisit-gate`'s table. The park now says so explicitly: the
      restatement outlet was available and was **not** taken.

      **The channel, which is the substance.**
      `agents/roadmaps/stubs/road-to-org-telemetry-sink.md` carries as its Phase 2
      exit criterion, verbatim: *"records written on a second machine appear in the
      sink."* That is exactly the input leg (b) lacked, and it is the only
      mechanism in this estate that produces it. The stub is gated on
      `sink-choice`, deliberately owner-reserved because a telemetry sink is a
      **standing egress** — so leg (b)'s chain is: `sink-choice` decided -> the
      sink stands up -> non-local stops accumulate -> 500 carry a post-split
      `envelope_parse` value -> the leg is measurable. **Owner: the maintainer, at
      `sink-choice`.**

      The condition itself is byte-identical to what was parked on 2026-08-22:
      `>= 95 % over >= 500 stops` still means what it meant.
- [x] **1.2 Record leg (a)'s distance honestly at the park.** The park reads as
      a two-legged gate of comparable difficulty. It is not: (a) needs an
      unbuilt instrument to exist and then run for four weeks, which is a
      minimum of four weeks after `road-to-standing-payload-diet` Phase 0 closes,
      and that roadmap has 19 open steps and 0 closed.
      verify (discharged): the park states the earliest date (a) could possibly be met, derived from the diet roadmap's own state, and cites the step numbers.

      **Derived, not estimated.** The ledger cannot hold its first entry until
      `road-to-standing-payload-diet` steps **0.3** (emit the per-PR delta against
      the merge-base), **0.4** (register it in the gate ledger) and **0.5** (book
      the credit side) land. Measured at 2026-08-23: that roadmap is **0 of 19
      steps closed**, and 0.3-0.5 are three of the nineteen — so the ledger holds
      **zero weeks**, and four weeks of entries cannot complete before
      **2026-09-20**.

      The park states that this is a **floor, not a forecast**: the date assumes
      all three steps landed the day it was written, which nothing suggests, and
      the real date is four weeks after 0.5 lands whenever that is. Recording the
      floor rather than a guess is the point — the park read as a two-legged gate
      of comparable difficulty, and it is not.
- [x] **1.3 Give the 2026-09-15 obligation an active owner.** Add it to an
      active roadmap or a stub with the re-arming consequence stated, so the
      date is visible from the estate rather than only from an evidence file.
      verify (discharged): `grep -rl "2026-09-15" agents/roadmaps/` matches at least one file outside `archive/`, and that file names ADR-133's re-arming as the consequence.

      **SHIPPED** as `agents/roadmaps/stubs/road-to-adr-134-expiry.md`. It names
      the consequence in its title and in its own section — ADR-133's freeze
      **re-arms** on 2026-09-15 because condition (d) is met only through ADR-134's
      OR arm — and it records the circularity rather than resolving it: ADR-134's
      Consequences name satisfying ADR-133(d) as a benefit while ADR-133(d) is met
      only by ADR-134.

      A **stub** rather than an active roadmap, for two reasons. It is a date
      carrier with no steps to execute, so it has nothing to promote; and
      `check_estate_count` excludes `stubs/` from `active_roadmaps`
      (`check_estate_count.ts:373`), so making the date visible costs the estate
      nothing — which is what lets it be done at all under a shrink-only ratchet.

      Risk 4 of this roadmap warned that 1.3 could satisfy the letter and miss the
      point — "adding the date to a roadmap makes a grep match without making
      anyone act". The mitigation it named is met: the consequence is stated
      alongside the date, the three available actions are enumerated, and the third
      (a deliberate lapse recorded as a compliance finding) is named as the one
      this run could actually reach.

## Phase 2 — Sweep the rest, report only

**Exit criteria:** a one-time inventory exists; nothing is gated on it.
**Rollback:** delete one evidence file.

- [x] **2.1 Classify every parked roadmap's resume condition.** For each file
      under `agents/roadmaps/later/`, record one of: `reachable` (an owner and a
      channel both exist), `unreachable` (the input cannot arrive), or `absent`
      (no resume condition stated). Report it; do not gate on it — a gate over a
      judgement call is the mechanism this repository's own reviewers keep
      asking it to stop building.
      verify (discharged): the written inventory covers every `*.md` under `agents/roadmaps/later/` — count matches `ls agents/roadmaps/later/*.md | wc -l` — and each row carries its verdict and the evidence for it.

      **SHIPPED** as `agents/evidence/reports/parked-roadmap-resume-conditions.md`
      — **60 rows**, which is `ls agents/roadmaps/later/*.md | wc -l` = 61 minus
      `README.md`, the directory's own contract rather than a parked roadmap. Each
      row carries its verdict and the condition as written; the three non-reachable
      rows carry their evidence in full.

      **Report-only by construction**, as the step requires: nothing is gated on
      the file, and no gate reads it.

      **A method correction is recorded in the artefact, because it changed a
      count.** The first extraction pass was line-anchored and left 15 rows with no
      condition text — 15 rows reading "no resume statement" while classified
      `reachable`, which is self-contradictory on its face. Thirteen were wrapped
      across lines and are recovered by normalising whitespace before matching; two
      state their gate in prose no pattern reaches and are quoted by hand, marked as
      such. The re-read moved one file from `reachable` to `absent`. A row whose
      text the extractor could not find is evidence about the extractor, not about
      the roadmap.
- [x] **2.2 State what the inventory found, including a null.** If every other
      parked condition is reachable, that is the result and it says the two
      instances above are idiosyncratic rather than systemic. Record it as such
      instead of manufacturing a pattern.
      verify (discharged): the inventory's summary states the counts per verdict, and if `unreachable` is 0 outside the known instance, says so explicitly.

      **Counts: `reachable` 56 · `unreachable` 2 · `absent` 2.**

      **The null is the headline, and it is nearly the null this step predicted.**
      `unreachable` outside the known instance is **1**, not 0 — and it fails for a
      **different reason**: `road-to-mixed-trigger-activation-cost` waits on a
      third-party host binary exposing an `InstructionsLoaded` observer, which is a
      capability no owner here can produce, whereas leg (b) failed because its
      producer terminated and its ledger had no ingestion channel. Two unreachable
      conditions with two distinct causes and no shared mechanism is **not a
      class**, which is exactly what Risk 3 said the honest outcome would look
      like. So the two known instances are idiosyncratic rather than systemic, and
      the inventory says so in those words instead of manufacturing a pattern from
      n=2.

      The second `absent` row is a finding the sweep would not have produced
      otherwise: `road-to-thin-flip-under-anchor-scoring` states its cause in
      unusual detail (inter-evaluator Cohen's kappa 0.472 against a registered
      floor of 0.800) and names no condition that would end the park. Read strictly
      it is closer to *permanent* than to *absent*, and the three-verdict schema has
      no `permanent` slot — recorded with that reading stated rather than filed
      under a verdict that fits worse. Not repaired: writing a resume condition into
      a roadmap this run did not otherwise touch would be authoring someone else's
      park, and Phase 2 is report-only.

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
- **Status:** resolved
- **Resolution (2026-08-23) — outlet (a): the condition NAMES AN OWNER, and the
  restatement was deliberately not taken.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent; the maintainer delegated
  owner-reserved blockers to the council for this autonomous drain run, and the
  council's own reasoning turned on the distinction this blocker draws: outlet (a)
  *adds* a condition, so it does not exercise the reserved transition, while outlet
  (b) *is* the weakening `decision-revisit-gate`'s table routes to the owner. Only
  (a) was taken.

  The arrival channel is
  `agents/roadmaps/stubs/road-to-org-telemetry-sink.md`, whose Phase 2 exit
  criterion reads *"records written on a second machine appear in the sink"* — the
  exact input leg (b) lacked, and the only mechanism in this estate producing it.
  That stub is gated on `sink-choice`, owner-reserved because a telemetry sink is a
  standing egress. Owner: the maintainer, at `sink-choice`. The condition text is
  unchanged: `>= 95 % over >= 500 stops`.

  **What is still NOT decided, stated so this resolution is not read as more than
  it is:** whether the sink is ever stood up. The blocker asked for an owner or a
  restatement or a permanence record; it now has an owner and a channel. It does
  not have a date, and this run cannot give it one.

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
- **Status:** resolved
- **Resolution (2026-08-23) — the THIRD limb: the lapse is recorded as a
  deliberate compliance finding.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent. ADR-134 is neither resolved nor
  succeeded, and neither is an agent action — its own terms reserve both to the
  maintainer (*"the maintainer either posts … or writes a successor deferral ADR
  with a signed reason"*). So the reachable limb is the third, and it is taken
  explicitly rather than by default: `agents/roadmaps/stubs/road-to-adr-134-expiry.md`
  names the date, names ADR-133's freeze re-arming as the consequence, records the
  circularity between the two accepted records, enumerates the three available
  actions, and states that option 3 — a lapse recorded as an open compliance
  finding, which is what ADR-134 itself prescribes for a lapse — is the disposition
  this run could reach.

  **What that does and does not buy.** It buys visibility: the date was reachable
  by grep from **no** active-estate file before this change and is reachable from
  one now. It does not buy action, and the stub says so. If 2026-09-15 passes with
  none of the three done, ADR-133's freeze re-arms and that is a real consequence,
  not a bookkeeping one — which is precisely why a date nobody could see was the
  defect.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The restatement becomes a quiet unparking | product | "Make the condition reachable" is one edit away from "make the condition easy", which would resume a program the estate cannot carry — the exact outcome the park prevented | 1.1 is `[~]` and blocked on an owner-reserved decision; no council or agent path exists to lower it | Phase 1 |
| 2 | The sweep becomes a governance layer | product | Twelve reviewers converge on "prove, attribute, close — not expand"; an inventory that grows into a gate over parked-roadmap metadata is precisely the expansion they name | 2.1 is report-only by construction, and 2.2 requires a null to be reportable as a result | Phase 2 |
| 3 | The two instances are not a class | implementation | Two findings do not establish a pattern; building Phase 2 on the assumption that they do would be the over-generalisation this repo's own abstraction thresholds forbid | 2.2 makes "no other instance" a legitimate and expected outcome, stated before the sweep runs | Phase 2 |
| 4 | 1.3 satisfies the letter and misses the point | implementation | Adding the date to a roadmap makes a grep match without making anyone act, and the obligation lapses anyway | 1.3's verify requires the consequence (freeze re-arming) to be named alongside the date, not just the date | Phase 1 |

## Acceptance Criteria

- [x] AC-1 — `later/road-to-agent-config-next.md`'s resume condition states, per
      leg, whether it is owned, restated, or permanent — and a reader can tell
      which without opening another file.
      **Met 2026-08-23.** The park carries a per-leg block: (a) **owned**, with a
      derived floor date; (b) **owned**, with the arrival channel named and the
      owner-reserved decision it sits behind named. Neither is restated and neither
      is permanent, and the block says which outlet was taken and which was left
      untaken. A reader needs no second file for the verdict — the sink stub is
      cited for the channel's detail, not for the verdict.
- [x] AC-2 — The earliest possible date for leg (a) is derived and written at the
      park, from the diet roadmap's own open-step state rather than from an
      estimate.
      **Met 2026-08-23: 2026-09-20**, derived from `road-to-standing-payload-diet`
      being 0 of 19 steps closed with 0.3-0.5 among the nineteen, so the ledger
      holds zero weeks and four weeks cannot complete sooner. Written at the park as
      a **floor, not a forecast**, with the assumption that makes it a floor stated
      alongside it.
- [x] AC-3 — `2026-09-15` is reachable by grep from a non-archived roadmap, with
      ADR-133's re-arming named as the consequence.
      **Met 2026-08-23.** `grep -rl "2026-09-15" agents/roadmaps/stubs/*.md` matches
      `road-to-adr-134-expiry.md`, which names the re-arming in its title and in its
      body. Before this change the same grep over `agents/roadmaps/*.md` and
      `later/*.md` matched **nothing**.
- [x] AC-4 — The parked-roadmap inventory exists, covers every file under
      `later/`, and its summary reports counts per verdict including a null.
      **Met 2026-08-23.** 60 rows = 61 files minus `README.md`; counts `reachable`
      56 / `unreachable` 2 / `absent` 2; and the null is reported as the headline —
      one unreachable beyond the known instance, failing for a different reason, so
      two causes and no shared mechanism, which is not a class.
