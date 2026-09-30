---
complexity: lightweight
status: later
review_by: 2027-03-30
entry_condition:
  what: >
    The tool-result byte census carries values written on at least two DISTINCT
    DATES. Checkable without judgement:
    `jq -r .date agents/runtime/state/tool-result-census.jsonl | sort -u | wc -l`
    reads 2 or more. One day's values are a reading of one tree, not a history,
    and a ratchet seeded on a single reading is a number invented at its own
    baseline — which is the exact ground the parent deferred on.
  when: >
    Producer-driven, not calendar-bound. The producer already exists: the
    `post_tool_use` byte recorder shipped with the parent roadmap, and it is
    default-off outside a maintainer workspace, so the census accumulates only
    where someone is working. What is missing is elapsed days.
    `review_by: 2027-03-30` forces a re-read of this file; it is not a wake date,
    and nothing enforces it — see the risk register.
  who: >
    An implementer. No owner decision is pending: both items were deferred on
    evidence, not on authority.
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "The `later_roadmaps` dimension grows by one because this file is ADDED into `later/` rather than MOVED into it — the parking allowance covers a move, and there was nothing to move: the parent is being archived in the same change and an archived roadmap cannot receive a carried item. The two dimensions net out (active 15 -> 13, later 85 -> 87) and the gate reads them independently, which is why the claim is needed on the later half even though the estate as a whole falls by two."
estate_offset_exempt: "Receives the two deferred items of road-to-a-bytes-row-that-exists, archived in the same change; a sibling parked file receives the third from the other parent, so two roadmaps leave the active estate and two parked ones arrive. It exists because `archive_completed_roadmaps` refuses a roadmap whose `[~]` items name no live destination, and the alternative was cancelling two evidence-based deferrals to clear the gate."
relates:
  - slug: road-to-a-bytes-row-that-exists
    relation: continues
    note: "receives its Phase 5 in full — 5.1 the shrink-only byte bound, 5.2 the first public network figure"
  - slug: road-to-host-traffic-knobs-that-ship
    relation: continues
    note: "receives its 4.2 — a measured saving for the request-size caps; same evidence stream as 1.1 and 1.2, with a paired run on top"
---
# Road to a byte bound and a public figure

> **Source:** Phase 5 of `road-to-a-bytes-row-that-exists`, archived 2026-09-30.
> Nothing here is new work; both items were written, reviewed and deliberately
> not built by the roadmap that shipped their machinery.

## Goal

Two numbers this tree can now produce and cannot yet bound. The metrics are
declared and the recorder runs; what is missing is a history to bound them
against.

## Why this is parked and not active

A ratchet over a quantity with no recorded history is a number invented at its
own baseline, and a first public figure should be a measured one. Neither
condition can be met by any change — only by elapsed days. Leaving the items
active would mean carrying two steps nobody can work.

## Phase 1 — The bound

- [ ] **1.1 A shrink-only bound on a byte metric.** The parent's 5.1, verbatim
      in intent: a ratchet over a quantity with no recorded history is a number
      invented at its own baseline. `tool-raw-bytes` and `tool-delivered-bytes`
      are declared and recorded; the bound becomes possible once the census spans
      more than one day.
      verify: the proposed baseline equals the measured MAXIMUM across all
      recorded dates, not the latest reading — asserted in the baseline note, and
      the note names the date range it was computed over
- [ ] **1.2 The first public statement of what this package moves over the
      network.** The parent's 5.2. `README.md` carries one incidental hit and
      `ONBOARDING.md` none, so this would be the first such figure the package
      publishes.
      verify: `./scripts-run src/scripts/check_claims` passes with the figure
      markered and a `kind: quant` ledger entry behind it, AND the sentence names
      both terms recorded `unavailable` — the host's own fetch tool and the model
      transport — so the total is visibly partial rather than quietly incomplete

## Phase 2 — What the size caps actually save

- [ ] **2.1 A measured saving for the request-size caps.** From
      `road-to-host-traffic-knobs-that-ship` 4.2. That roadmap shipped the caps
      and the settings key that writes them; it published no saving figure,
      because when it was written no byte metric existed. One does now — which is
      why this lands here and not in a third parked file: the condition is this
      file's `entry_condition` PLUS a paired run, not a different evidence stream.
      verify: two runs over the same fixture workload, one with both caps unset
      and one with both set, reported as a delta with both absolute figures beside
      it — never a percentage alone, and never a figure from a single run

## What this roadmap deliberately does not do

It publishes no figure before its history exists, and it estimates neither
unreachable term into a total. Both prohibitions are the parents', carried rather
than restated as new policy.

It also does not re-open whether this package may write a traffic variable. That
was decided on 2026-09-30 — it may not, and the write path is an allow table of
two size caps — and Phase 2 measures what those two caps save, nothing wider.

## Acceptance criteria

- The byte baseline is the measured maximum over a named multi-date range, never
  a single reading.
- Any published byte figure names its `basis` and the terms excluded from it.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-30 | reviewer: ai-council-2of2-anthropic-openai -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The file is never re-read, and the items die by attrition | product | Both review seats named this and one was blunter than my first draft deserved: **nothing enforces `review_by`.** Measured rather than assumed — `lint_roadmap_later_disposition` gates the PRESENCE of the key (`:review-by`, rule C) and no gate anywhere reads an EXPIRED date for a parked roadmap, so the forcing function I claimed is a date in prose. `later/` already holds 86 files. The honest risk is therefore not "might be forgotten" but "will be forgotten unless somebody looks". | The mitigation is the `entry_condition`, not the date: it is a one-line shell reading over a named file, so a re-read is a lookup rather than a re-derivation, and anyone sweeping `later/` can evaluate it without reconstructing the argument. The missing resurfacing gate is recorded here as a GAP rather than mitigated, because building it is a new CI surface and does not belong in an archival change. | Phase 1 — The bound |
| 2 | The baseline is seeded at the first reading anyway | implementation | The parent deferred on exactly this ground and said so in its own prose, which did not stop the item from being written down as buildable. An implementer arriving at a census that has finally accumulated values will reach for the latest number, and the latest number of a shrinking quantity looks like a safe baseline. | 1.1's verify demands the measured MAXIMUM across all recorded dates and that the note name the range it was computed over, so a single-reading baseline fails a stated criterion rather than a reviewer's memory. The first acceptance criterion repeats it in one line so it survives a skim. | Phase 1 — The bound |
