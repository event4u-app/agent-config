---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-skills-that-arrive-when-called
entry_condition:
  what: the owner answers blocker fork-widening-is-owner-owned — widen, hold or retire the fork pilot
  when: whenever the owner takes the question up; nothing in the tree waits on it
  who: owner
review_by: 2026-12-31
estate_offset_exempt: "Carried 2026-10-20 from road-to-skills-that-arrive-when-called, which is archived in the same change, so this file is its one-in-one-out pair. Its only content is the owner question fork-widening-is-owner-owned, which blocks nothing and kept the finished parent from archiving. An AI council (2/2, 2026-10-20) chose to carry it unanswered rather than record `held` on the owner's behalf or leave the parent unarchived; merging it into another roadmap was not available because no other file owns the fork pilot."
estate_growth_exempt: "Carry of road-to-skills-that-arrive-when-called: the parent is archived in the same change and its last open blocker, fork-widening-is-owner-owned, moves here unanswered. Measured by check_estate_count at the merge with origin/main: later_roadmaps 106 → 107 (this file), open_blockers 72 → 71 (the parent's other blocker resolved; this one is counted here instead of there)."
---
# Road to skills that arrive when called — carried

> **Source:** carried on 2026-10-20 from
> [`road-to-skills-that-arrive-when-called`](../archive/road-to-skills-that-arrive-when-called.md),
> which closed every step and every acceptance criterion. Its one remaining
> blocker is an owner question that blocks nothing; it moved here unanswered so
> archiving the parent buried nothing. Disposition decided by an AI council
> (2/2, 2026-10-20, `anthropic` + `openai`): carry, never record `held` for the
> owner — `agents/evidence/council/fork-widening-disposition-20261020.md`.

## Goal

The owner's answer to whether the fork pilot widens, holds or retires is
recorded, and the pilot config says which.

## Phase 1 — The owner question carried from road-to-skills-that-arrive-when-called

- [ ] **1.1 Record the owner's answer on fork widening.** <!-- blocked-by: fork-widening-is-owner-owned | asked: yes — posed 2026-10-20 by the parent step 3.3 on its 3.2 record -->
  Write the chosen option into this file's blocker and set `status` in
  `src/config/skill-fork-pilot.json` to `widened`, `held` or `retired`
  (today: `pilot`). Under `widened`, the names added are report skills whose
  bodies need nothing from the conversation they are called in, read per skill.
  verify: `grep -cE '"status": "(widened|held|retired)"' src/config/skill-fork-pilot.json` -> 1

## Blockers

### blocker: fork-widening-is-owner-owned

<!-- asked: 2026-10-20 | record: agents/evidence/analysis/skill-fork-pilot-result-20261020.md -->

- **Status:** open — posed 2026-10-20 by the parent's step 3.3 on its 3.2 result; carried here unanswered the same day
- **Owner:** owner — widening changes what a consumer's conversation contains when a shipped skill is invoked, on every install, and 3.2 closed HARM
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** step 1.1 here. Nothing else: the pilot set stays at five and `renderForkContext` ships unwired.
- **What to do:** pick exactly one — (a) widen: name the report skills whose bodies carry no dependence on the invoking conversation, and ship `context: fork` for them on the first host; (b) hold at five and leave the render unwired, which is today's state; or (c) retire the pilot and delete the render.
- **Resolved when:** the answer is recorded here and the pilot config's `status` says `widened`, `held` or `retired`.
- **Recommendation:** (b) for now. A2 shows the saving is real and scales with the body, so there IS something here — the six D4 skills at ≥ 20,193 characters are exactly where it would pay. A3 shows the saving is paid for in conversation context, and nothing measured tells you which skill can afford that; it is a per-skill reading of what each body assumes about the turn it was called in. Five skills is a cheap place to be wrong and three hundred is not.
- **If you do nothing:** the pilot stays at five, the render stays unwired, and no consumer sees a change.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-20 | reviewer: drain/skills-arrive-20261020 -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The owner question is parked out of sight | product | A question moved to `later/` leaves the dashboard, and an unanswered owner question can sit there indefinitely | The blocker stays registered here, where `check_estate_count` counts `open_blockers` across `later/`, and `review_by: 2026-12-31` makes the parked-roadmap gate bring it back. No behaviour waits on it, so the cost of a long wait is the pilot staying at five | Phase 1 — The owner question carried from road-to-skills-that-arrive-when-called |

## Acceptance Criteria

- [ ] AC-1 — The fork pilot's `status` is `widened`, `held` or `retired`, and the blocker records the owner's choice.
