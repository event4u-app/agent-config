---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2027-01-31
relates:
  - slug: road-to-a-halt-that-holds-every-lane
    relation: extends
    note: "Carries that roadmap's Phase 2 (prose-hold parser) after an AI-council verdict on 2026-11-24; its halt half shipped alone."
---
# Road to prose holds that read their object

> **Source:** Phase 2 of `road-to-a-halt-that-holds-every-lane` (archived),
> carried by AI-council verdict B on 2026-11-24
> (`agents/evidence/council/halt-phase2-disposition-20261124.md`) after ten R2
> completion-review rounds (`agents/evidence/reviews/road-to-a-halt-that-holds-every-lane.round-*.md`).
> A regex parser was tried there and reverted: every round found new phrasings,
> and several fixes released holds `main` kept. Original findings: finding 2 of
> the after-the-fact council review of the #2768 bypass
> (`agents/evidence/council/bypass-2768-review-20261119.md`).

## Goal

`roadmap_drain_queue`'s prose-hold check decides a hold by the objects it names
and the clause that governs it — never by matching phrasing patterns — and it
releases a hold only when every object it names has resolved.

## Findings, as they stand on `main`

1. **Negation is only stripped when adjacent** — "Not currently blocked by the
   probe" stays held.
2. **Past-tense resolution reads as held** — "It was blocked by the probe, which
   has since shipped" stays held.
3. **Order decides compound text** — "No longer blocked by X but still blocked by
   Y" depends on regex order.
4. **A resolved named blocker masks independent holds** — `namedAll.length === 0`
   gates the prose check, so an `Owner-reserved` note beside a resolved blocker
   is missed.

## Fixture corpus — the ten review rounds

Every phrasing below was raised by a review round; it is the requirement list,
not a sample. "Blocker `s`" and "blocker `t`" are local blockers with
`Status: resolved`.

| Phrasing (step continuation) | Expected |
|---|---|
| Not currently blocked by the probe. | runnable |
| It was blocked by the probe, which has since shipped. | runnable |
| It was blocked by the probe, which has since shipped on 2026-10-30. | runnable |
| No longer blocked by the probe but still blocked by the host binary. | held |
| Still blocked by the host binary; no longer blocked by the probe. | held |
| It is not clear whether this is blocked by the probe. | held |
| The probe is not shipped, and the step is blocked by it. | held |
| It was blocked by the probe. | held |
| It was blocked by the probe. Phase 3 has since shipped. | held |
| It was blocked by the probe, which has since been reopened. | held |
| It was blocked by the probe and the doc has since shipped. | held |
| It was blocked by the upstream fix, which has since merged upstream but is not yet released. | held |
| It was blocked by the fix, which has since been fixed in part. | held |
| It was blocked by the fix, which has since merged in staging. | held |
| It was blocked by the probe and the host, which has since shipped. | held |
| It was blocked by the probe but the host, which has since shipped. | held |
| It was blocked by the probe and the host, which have since shipped. | runnable |
| Not only blocked by the probe. | held |
| Not only waits on the probe. | held |
| Not just waiting on the probe. | held |
| Not yet blocked by the probe; it will be. | held |
| Not blocked by the probe alone, but also by the host. | held |
| Whether or not blocked by the probe, the step waits. | held |
| It wasn't blocked by the probe until today; now it is. | held |
| Still held by blocker `s`. | runnable |
| Parked until blocker `s` ships. | runnable |
| On hold until blocker `s` resolves. | runnable |
| Blocked on the probe (blocker `s`). | runnable |
| Blocked by blocker `s` and blocker `t` (both resolved). | runnable |
| Owner-reserved until blocker `s` is reviewed. | held |
| Still held by blocker `s`. Owner-reserved: the flip is the maintainer's call. | held |
| Still blocked by the host binary, and blocker `s` has resolved. | held |
| Blocked by blocker `s` and the probe. | held |
| Blocked on the host binary and the probe (blocker `s`). | held |
| Waiting on the host binary for now, see blocker `s`. | held |
| On hold until blocker `s` is reverted. | held |
| Phase blockquote "> Blocked by blocker `s`." over two plain steps | runnable, runnable |

## Acceptance criteria

- **AC-1** Every corpus row is a fixture, red first where `main` disagrees, then
  green.
- **AC-2** A hold naming several objects releases only when every named object is
  resolved — a blocker ref by its status, a prose object by a resolution clause
  attached to it.
- **AC-3** A resolved named blocker suppresses only the hold whose object it is;
  an owner hold beside it still holds.
- **AC-4** No step currently classified correctly in the live estate changes
  class (before/after `roadmap_drain_queue --json` over `agents/roadmaps/`) —
  the parent's AC-6, carried unchanged.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A parser that releases a live hold | product | Any loosening can dispatch a step the owner reserved — the failure that sent the parent's attempt back. | The corpus pins every held row; a held row turning runnable fails CI. | Phase 1 — Objects, not phrasings |
| 2 | Pattern growth without an end | implementation | The parent added one regex per review finding for ten rounds without converging. | Parse the hold's clause and object list once; no phrasing-specific pattern is accepted in review. | Phase 1 — Objects, not phrasings |

## Phase 1 — Objects, not phrasings

- [ ] **1.0** Discovery: show on the tense rows of the corpus ("wasn't … until
  today; now it is", "which has since been reopened") that an object-list model
  can represent a hold that resolved and returned — the council named this the
  unproven half of the design. If it cannot, stop and re-plan before 1.2.
- [ ] **1.1** Test first: the corpus above as named fixtures (AC-1).
- [ ] **1.2** Extract each hold's governing clause and its object list (split on
  `and`, `or`, `,`, parentheses).
- [ ] **1.3** Judge each object: a blocker ref by its status, a prose object by an
  attached resolution clause; judge negation and tense from the governing clause,
  not by distance; release only when all objects resolve (AC-2, AC-3).
- [ ] **1.4** Before/after `--json` diff over the live estate shows no class
  change for a correctly classified step (AC-4).

## Not in scope

- The emergency halt (shipped by the parent).
- Any change to the blocker heading format or the `blocked-by` marker.
