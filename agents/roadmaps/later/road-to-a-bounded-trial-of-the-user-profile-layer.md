---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: an active roadmap closes, so this one fits under the WIP limit of five
  when: at the next active-roadmap closure
  who: agent
review_by: 2027-01-28
estate_offset_exempt: >-
  Carries the owner's 2026-10-30 answer to OQ-11 of agents/owner-questions.md; no archive
  move is available, and it is parked rather than active because the WIP limit is full.
estate_growth_exempt: Parked carrier of the answered OQ-11; adds one later roadmap, no active one.
---
# Road to a bounded trial of the user-profile layer

> **Source:** OQ-11 of `agents/owner-questions.md`, answered by the owner on
> 2026-10-30: a bounded trial. The layer is ADR-138's global user-profile layer;
> its teardown review opened on 2026-10-28 with 0 observations proposed.

## Goal

Find out whether the global user-profile layer earns its place once it is
actually offered. One trial, fixed in advance, decides: the layer stays if the
trial reaches its sample and its bar; otherwise it goes through archive-first
deprecation, and no user data is lost either way.

## Context

The layer was never offered: observations come only from the manual
`/memory mine-session`, so 0 proposals at day 90 measures the missing offer, not
the layer's value. The council's amendment of 2026-10-25 bounds the review:
non-destructive, user data inventoried and preserved, nothing deleted without
consent. `/agents user show --audit` shows the current reading.

## Phase 1 — Inventory before anything moves

- [ ] **1.1 Inventory the layer's user data.** Every file and key the layer
      writes, where it lives and how it is exported; nothing is changed.
      verify: the inventory lists a location and an export path for every store the layer writes.

## Phase 2 — Fix the trial before it starts

- [ ] **2.1 Pre-register the trial.** The offer moment (a natural point such as
      session end, never a cold prompt), consent and opt-out wording, the fixed
      end date, the minimum sample, and the bar that keeps the layer.
      verify: the pre-registration is committed before the offer ships.
- [ ] **2.2 Ship the offer behind consent.** Asked, never assumed; one opt-out
      stops it for good; the offer switches itself off at the end date.
      verify: a test where the user opts out never sees the offer again, and one past the end date sees none.

## Phase 3 — Read the result

- [ ] **3.1 Read the gate at the end date.** Sample reached and bar met → the
      layer stays and the teardown review closes. Sample not reached or bar
      missed → Phase 4.
      verify: the reading is recorded against the pre-registered sample and bar.

## Phase 4 — Archive-first deprecation, only if the trial says so

- [ ] **4.1 Deprecate for one release, keep code and data.** Commands marked
      deprecated, code archived, user data preserved and exportable; deleting
      user data stays the user's own act.
      verify: after deprecation every inventoried store is still readable and exportable.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-30 | reviewer: agent/oq-11-carrier -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The offer becomes a nag | product | An offer at the wrong moment trains the user to dismiss it, which reads as no demand | One natural moment, one opt-out that holds, a fixed end | Phase 2 — Fix the trial before it starts |
| 2 | Deprecation loses user data | implementation | Removing the layer could take stored observations with it | Inventory first; deprecation archives and never deletes | Phase 1 — Inventory before anything moves |

## Acceptance Criteria

- [ ] AC-1 — The trial ran to its end date against a pre-registered sample and bar, and the layer was kept or deprecated on that reading.
- [ ] AC-2 — No user data from the layer was deleted by the run.
