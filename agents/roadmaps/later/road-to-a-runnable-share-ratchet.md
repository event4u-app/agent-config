---
complexity: lightweight
status: later
review_by: 2027-03-30
entry_condition:
  what: >
    Two `roadmap_verify_share` readings exist whose dates are at least one quarter
    apart, plus a stated false-positive rate over a named sample. Checkable
    without judgement: two evidence files under `agents/evidence/reports/` whose
    `verify-clause-share` readings carry dates 90 or more days apart. The time
    separation is the criterion — NOT that the count moved. The parent's two
    readings failed on the same DAY, and a count that holds steady across a
    quarter is data rather than a disqualification.
  when: >
    Producer-driven. `roadmap_verify_share` already exists and produces the
    reading on demand, so this is purely a question of elapsed calendar time from
    the first reading (2026-09-29). `review_by: 2027-03-30` forces a re-read;
    nothing enforces it — see the risk register.
  who: >
    An implementer. No owner decision is pending: the item was deferred on an
    elapsed measurement window, not on authority.
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "Same shape as the sibling parked file, and the split that produced two rather than one is an AI-council requirement rather than a preference: a single destination would couple two evidence streams that mature independently. The `later_roadmaps` dimension grows by one because this file is ADDED into `later/`, not moved, and the parking allowance covers a move."
estate_offset_exempt: "Receives the single deferred item of road-to-a-verify-clause-that-can-fail, archived in the same change; a sibling parked file receives the two from the other parent, so two roadmaps leave the active estate and two parked ones arrive. Split from that sibling on an AI-council finding: one destination for both parents would couple two evidence streams that mature independently, so whichever matured first would wake a file carrying half-unworkable steps."
relates:
  - slug: road-to-a-verify-clause-that-can-fail
    relation: continues
    note: "receives its 2.4 — a ratchet on the runnable share"
---
# Road to a runnable-share ratchet

> **Source:** step 2.4 of `road-to-a-verify-clause-that-can-fail`, archived
> 2026-09-30. Not new work: written, reviewed and deliberately not built by the
> roadmap that shipped its reader.

## Goal

A shrink-only bound on the share of `verify:` clauses that can actually fail. The
reader exists and publishes the number; what is missing is a second reading far
enough from the first to be about behaviour rather than about the corpus.

## Why this is parked and not active

The parent produced two readings on the SAME DAY. The falsifiable count did not
move while five roadmaps were archived, so the delta was in the corpus and not in
the behaviour — and it recorded that reading as not qualifying. No change can
supply the missing quarter.

## Phase 1 — The ratchet

- [ ] **1.1 A ratchet on the runnable share.** The parent's 2.4. Needs two
      readings at least a quarter apart and a measured false-positive rate. May
      bind only files created after the ratchet lands, so it never retroactively
      reds prose clauses that were legal when written.
      verify: two `verify-clause-share` readings whose dates are 90 or more days
      apart, a stated false-positive rate over a named sample, and a baseline that
      binds only files created after the landing date — the reading's COUNT need
      not have moved, and a steady count across a quarter is admissible evidence

## The one correction this file carries

The parent's own wording, and my first draft of this file, made the ratchet wait
for a count that *changed*. An AI-council review named that as a defect and it is
one: a runnable share that holds steady across a quarter is a measurement, and
requiring movement would make a stable system unqualifiable forever. What the
parent actually established is that two readings on ONE DAY say nothing — the
criterion is the separation, not the delta.

## Acceptance criteria

- The ratchet binds only files created after it lands.
- Its baseline rests on two readings at least a quarter apart, with the dates
  named.
- A steady count across that window is accepted as evidence, not rejected.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-30 | reviewer: ai-council-2of2-anthropic-openai -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The file is never re-read, and the item dies by attrition | product | Both review seats named this. **Nothing enforces `review_by`** — measured, not assumed: `lint_roadmap_later_disposition` gates the PRESENCE of the key (rule C) and no gate reads an EXPIRED date for a parked roadmap. `later/` already holds 86 files. So the risk is not "might be forgotten" but "will be forgotten unless somebody looks". | The `entry_condition` is the mitigation, not the date: two evidence files with dates 90 days apart is a lookup, not a re-derivation. The missing resurfacing gate is recorded as a GAP rather than mitigated — building it is a new CI surface and does not belong in an archival change. | Phase 1 — The ratchet |
| 2 | The ratchet retroactively reds legal prose clauses | implementation | 137 of the measured clauses carry no command at all and were legal when written; rule 23 keeps prose legal on purpose. A ratchet seeded over the whole corpus would red them, and the cheapest repair for a gate that reds correct content is to weaken it until it finds nothing. | 1.1 binds the ratchet to files created after it lands, stated in the step and repeated as the first acceptance criterion. The parent already carries the same restriction, so this is carried rather than newly decided. | Phase 1 — The ratchet |
