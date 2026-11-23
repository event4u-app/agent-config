---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps, requested by the owner on 2026-11-20 to carry the two code findings of the after-the-fact council review agents/evidence/council/bypass-2768-review-20261119.md."
estate_offset_exempt: "Defects in merged code with no active roadmap covering them; the review records them as open and names no other carrier."
relates:
  - slug: road-to-a-split-the-task-earns
    relation: extends
    note: "Archived by #2768, which shipped the emergency halt and the expanded prose-hold vocabulary; this closes the gaps the after-the-fact review found in both."
---
# Road to a halt that holds every lane

> **Source:** after-the-fact council review of the #2768 bypass,
> `agents/evidence/council/bypass-2768-review-20261119.md` (2026-11-19, anthropic
> REJECT, openai REQUEST_CHANGES), findings 1 and 2. Both re-read against
> `main` at `99d4f7d657` on 2026-11-20 and still present.

## Goal

`emergency.orchestration_halt` stops every dispatch, including the re-dispatch
of a dead lane, and the roadmap drain queue classifies a step as held only when
a hold is actually still in force.

## Findings, as they stand on `main`

1. **The halt ends at queue selection.** `buildQueue` sets `next: null` and
   `dispatch_hold` when halted (`src/scripts/roadmap_drain_queue.ts`, the
   `halted` branch near `dispatch_hold`), but every entry keeps
   `dispatchable: true`. `process-full-all.md` § "A lane that dies keeps its
   work" sends a FRESH lane from the queue entry with no halt check. The tests
   inject `{ halted: true }` into `buildQueue`; the settings → queue →
   dispatch path is untested.
2. **The prose-hold parser misreads compound text.**
   - `NEGATED_HOLD_RE` only strips a negation adjacent to the hold phrase, so
     "Not currently blocked by the probe" stays held.
   - "It was blocked by the probe, which has since shipped" reads as held.
   - "No longer blocked by X but still blocked by Y": the outcome depends on
     regex order, not on meaning.
   - `namedAll.length === 0` gates the prose check: a step naming a RESOLVED
     local blocker skips prose detection entirely, so an independent
     `Owner-reserved` note in the same continuation is missed.

## Acceptance criteria

- **AC-1** With the halt armed, no queue entry reads `dispatchable: true`, and
  the JSON and text outputs both say why.
- **AC-2** The re-dispatch procedure in `process-full-all.md` reads the halt
  (via the queue) before sending a fresh lane; a halted queue refuses it.
- **AC-3** One test drives the halt from a real settings file through
  `roadmap_drain_queue` to the dispatch decision, with no injected flag.
- **AC-4** Each misread above is a failing test first, then green.
- **AC-5** A resolved named blocker no longer masks an independent
  owner-reserved hold in the same step.
- **AC-6** No step currently classified correctly in the live estate changes
  class (before/after diff of `roadmap_drain_queue --json` over `agents/roadmaps/`).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A halted queue hides why nothing runs | product | Marking every entry non-dispatchable could read as "nothing to do" instead of "halted", so an operator misses the armed switch. | AC-1 requires both outputs to name the halt; the test asserts the reason, not only the flag. | Phase 1 — Halt covers every dispatch |
| 2 | A looser parser releases real holds | product | Clause-scoped negation or past-tense resolution could read a still-active hold as resolved and dispatch a step the owner reserved. | Failing fixtures first (2.1); the estate-wide before/after diff (2.5) blocks any unexplained class change. | Phase 2 — Prose holds that mean what they say |

## Phase 1 — Halt covers every dispatch

- [x] **1.1** Test first: settings file with `emergency.orchestration_halt: true`
  → queue → no entry dispatchable, `next` null, hold named (AC-1, AC-3).
- [x] **1.2** `buildQueue`: when halted, every entry's `dispatchable` is `false`.
- [x] **1.3** `process-full-all.md`: the dead-lane re-dispatch reads the queue
  entry's `dispatchable` and `dispatch_hold` first and stops on a halt (AC-2);
  `task sync` regenerates the projection.

## Phase 2 — Prose holds that mean what they say

- [x] **2.1** Test first: the four cases of finding 2 as named fixtures (AC-4).
- [x] **2.2** Negation: strip a negation that governs the hold phrase within the
  same clause, not only when adjacent.
- [x] **2.3** Past-tense resolution ("was blocked by … has since shipped") is
  not a hold.
- [x] **2.4** Evaluate prose holds even when a named blocker resolved; the
  resolved name suppresses only the hold that names it (AC-5).
- [x] **2.5** Before/after classification diff over the live estate; every
  changed step justified in the PR body (AC-6).
  Result 2026-11-23, re-run on the final parser of this branch (after every R2
  round that changed it):
  `roadmap_drain_queue --json` from `origin/main` and from this branch over the
  same estate — identical entry count, zero differences in bucket,
  dispatchable, runnable or per-class counts, same `next`, same owner/council
  questions. Every earlier run after a parser change gave the same zero diff.

## Not in scope

- Finding 3 (tests narrower than step receipts) and finding 4 (the bypass
  record's missing withdrawal) of the same review.
- Any change to the ratification mechanism or the bypass record format.
