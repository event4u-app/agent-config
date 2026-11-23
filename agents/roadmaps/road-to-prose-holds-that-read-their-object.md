---
complexity: bounded
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2027-01-31
relates:
  - slug: road-to-a-halt-that-holds-every-lane
    relation: extends
    note: "Carries the parser findings the R2 completion review rounds of that roadmap's Phase 2 left open; the halt half closed there."
---
# Road to prose holds that read their object

> **Source:** R2 completion review of `road-to-a-halt-that-holds-every-lane`,
> rounds 6–9 (`agents/evidence/reviews/road-to-a-halt-that-holds-every-lane.round-*.md`).
> Every release-direction regression against `main` was fixed there; what is
> carried here either fails safe (a hold kept after its object resolved) or
> already behaved the same on `main`.

## Goal

`roadmap_drain_queue`'s prose-hold parser decides a hold by the object the hold
names — releasing it only when every object it names has resolved, and never
keeping it once its only object has.

## Findings, as they stand

1. **A compound past-tense hold never releases.** The parent closed the release
   direction conservatively: `RESOLVED_AFTER_RE` refuses any object list
   containing `and` / `or` / `both`, so "It was blocked by the probe and the
   host, which have since shipped." stays held even when both objects did ship.
   Fails safe; the gap is a step left held after every object resolved.
2. **A hold whose only object is a resolved blocker stays held in unlisted
   phrasings.** `citationRe` accepts only a citation directly after the hold
   phrase ("blocked by blocker `a`", "parked until blocker `a` ships"). "Blocked
   by blocker `a` and blocker `b`." (both resolved), "Blocked by blocker `a`
   (resolved 2026-10-18).", "Waiting on blocker `a` to ship.", "Parked until
   blocker `a` has been resolved.", "Blocked by blocker `a` — now resolved.",
   "Blocked on the probe (blocker `a`)." and "Waiting on the probe, see blocker
   `a`." stay held. `main` released them. The parent dropped the parenthetical
   and `see` forms after R2 round 8 showed they also released holds with a
   second, unresolved object ("Blocked on the host binary and the probe
   (blocker `a`)."). Fails safe.
3. **A restrictive negation releases a hold, as on `main`.** "Not blocked by the
   probe alone, but also by the host." reads runnable: the negator governs
   "alone", not the hold. Release direction, pre-existing (R2 round 9 finding 2).

## Acceptance criteria

- **AC-1** Each phrasing above is a fixture, red first, then green.
- **AC-2** A hold naming several objects releases only when every named object
  is resolved — by blocker status for blocker refs, by an attached resolution
  clause for prose objects.
- **AC-3** No step in the live estate changes class (before/after
  `roadmap_drain_queue --json` diff over `agents/roadmaps/`).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A broader citation grammar releases live holds | product | Accepting more phrasings for a resolved blocker can also accept one that names a second, unresolved object. | Every object named in the hold is enumerated before release (AC-2); fixtures for mixed resolved/unresolved objects in both orders. | Phase 1 — Objects, not phrasings |
| 2 | Regex growth without an end | implementation | Six review rounds each found new phrasings; another pattern per finding repeats that. | Phase 1 parses the hold's object list once and judges each object, instead of adding phrasing patterns. | Phase 1 — Objects, not phrasings |

## Phase 1 — Objects, not phrasings

- [ ] **1.1** Test first: the phrasings of findings 1–3 as named fixtures (AC-1),
  plus the parent's compound fixtures that must stay held while one object is open.
- [ ] **1.2** Extract a hold's object list (split on `and`, `,`, parentheses) from
  the hold phrase to the clause end.
- [ ] **1.3** Judge each object: a blocker ref by its status, a prose object by an
  attached `which has since <resolving verb>` clause; release only when all
  objects resolve (AC-2).
- [ ] **1.4** Before/after `--json` diff over the live estate; every changed step
  justified in the PR body (AC-3).

## Not in scope

- The emergency halt (closed by the parent roadmap).
- Any change to the blocker heading format or the `blocked-by` marker.
