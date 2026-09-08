---
complexity: lightweight
status: ready
execution:
  mode: interactive
owner: maintainer
relates:
  - slug: road-to-the-packed-payload-cap
    relation: disjoint
    note: >
      Sibling receiver from the same run, and deliberately NOT folded into it:
      that file's own opening line says it exists to hold one owner-reserved
      blocker and nothing else, so a second subject would contradict it.
estate_growth_exempt: "Orchestrator-instructed 2026-09-08, after the run found the gap with `git status` rather than with a gate and the orchestrator ruled that a real coverage gap in a ratcheted metric deserves a receiver rather than a sentence in a report. +1 active with no offset in the same change, and that is the honest shape: the alternative was a stub, which is where this repository files decision-shaped work — but `stubs/` is explicitly out of the active estate, and a gap that lets a RATCHETED metric under-report is the one class that must not be parked somewhere no ratchet reads. Measured rather than argued: 23 archived roadmaps carry `- **Status:** open` today and no gate reads any of them."
design_validated: "gap measured 2026-09-08 — 192 archived roadmaps carry a blocker section, 23 of them `Status: open`, and both gates that would report them exclude the directory. The FIX is not validated; see § The fix is a decision, not wiring."
capability_gap: none
---
# Road to a blocker that cannot hide in the archive

> **Found by accident, which is the point.** During the archival of
> `road-to-a-graph-that-is-shipped` on 2026-09-08, `git mv` staged the rename
> against the index while the edit removing that roadmap's blocker was still
> unstaged. The archived file therefore shipped with a blocker section that had
> already been relocated to another roadmap — **the same blocker declared open in
> two files at once, one of them archived.** It was caught by reading
> `git status`, not by any gate, and this roadmap exists because that is a
> coverage gap rather than a lucky escape.

## Goal

An archived roadmap cannot silently carry a blocker that claims to be open.

## The gap, measured

Two gates read roadmap blockers, and both skip the archive:

| Gate | Where the exclusion is | What it means |
|---|---|---|
| `lint_roadmap_blockers` | `src/scripts/lint_roadmap_blockers.ts:28` — *"`later/` and `archive/` are outside this gate's contract"* | The five-field blocker contract is never checked on an archived file |
| `check_estate_count` (via `update_roadmap_progress`) | `src/agent-src/scripts/update_roadmap_progress.ts:97` — `EXCLUDE_DIRS = {archive, skipped, stubs, later}` | `open_blockers` counts active roadmaps only |

Consequence, measured on this tree at 2026-09-08:

```
grep -rl '^### blocker:'                  agents/roadmaps/archive/*.md | wc -l   → 192
grep -rlE '^- \*\*Status:\*\* *open'      agents/roadmaps/archive/*.md | wc -l   →  23
```

**192** archived roadmaps carry a blocker section and **23** of them carry
`Status: open`. Whether all 23 are genuine historical records or some are stale
duplicates like the one this run created is exactly what nobody can currently
answer, because nothing reads them.

And the ratchet consequence is the one that matters: `open_blockers` is a
**shrink-only ratchet**, and a blocker that moves from an active roadmap into an
archived one leaves the count while remaining declared open. That is a metric
that can be satisfied by archiving rather than by resolving. This run did not
exploit that — the blocker it moved went to another **active** roadmap and the
count stayed at its floor, verified `open_blockers 44 (floor 44, +0)` — but
nothing prevented the other outcome.

## The fix is a decision, not wiring

```
DO NOT SIMPLY SCAN `archive/`. THAT IS THE OBVIOUS FIX AND IT IS THE WRONG ONE.
```

Extending either gate's corpus to `archive/` would land **23 findings on day
one**, none of them caused by the change that landed the gate. This repository
has refused that shape before in writing, and the refusals are the precedent to
read before choosing: `lint_roadmap_later_disposition`'s baseline note records
*"a gate that fails its own tree on 68 files the landing change did not cause is
reverted rather than adopted"*, and `check_no_new_legacy_path` carries the same
reasoning at 46.

There is also a real reason the exclusion exists: an archived roadmap is a
historical record, and a blocker that was genuinely unresolved when its roadmap
closed is a true thing for it to say. A gate that forbids that would be
falsifying history to satisfy a count.

So the question this roadmap holds is **what a fix should assert**, and the
candidates differ in what they would have caught:

1. **Assert on the TRANSITION, not the corpus.** `archive_completed_roadmaps`
   already refuses to archive a roadmap with an open blocker — it is what
   refused `road-to-a-graph-that-is-shipped` for a day. Make it re-read the file
   it is about to move **from the working tree** rather than trusting the index,
   and refuse on a `Status: open` it finds there. Day-one findings: **zero**,
   because it only ever fires on a future archival. Would have caught this run's
   duplication exactly, since the working tree and the index disagreed.
2. **Assert non-duplication across the whole tree.** No blocker id may appear
   with `Status: open` in more than one file, active or archived. Day-one
   findings: unknown, needs measuring — and it catches a class the transition
   check misses (a blocker copied rather than moved).
3. **Ratchet the archived corpus separately.** A second shrink-only baseline at
   23, so the count cannot grow. Day-one findings: zero by construction, and it
   makes the 23 visible and shrinkable. Cheapest, and asserts the least.

(1) is the narrowest fix that would have caught the observed defect. (3) is the
cheapest way to stop the ratchet-by-archiving hole. They are not exclusive.

## Phase 1 — Decide and implement

- [ ] **1.1 Pick among (1), (2), (3)** above — or a fourth the reader sees — and
      say in the same change which day-one finding count the choice carries and
      how it was measured.
      verify: the chosen assertion is implemented, its gate exits 0 on this tree
      **without a baseline** if the choice claims zero day-one findings, or with
      a baseline whose note states the measured count if it does not.
- [ ] **1.2 A sensitivity case, not just a green run.** Reconstruct this run's
      defect — an archived roadmap whose working-tree content and index content
      disagree about a blocker — and prove the new assertion goes red on it.
      verify: neutralising the assertion turns that case green again, so the
      case is known to have teeth rather than assumed to.

## What this roadmap is NOT

- **Not a claim that the 23 are wrong.** They are unread, which is different.
  Reading them is part of (2) or (3), not a premise of this file.
- **Not a proposal to scan `archive/` wholesale.** § The fix is a decision says
  why, with the two precedents that refused that shape.
- **Not owner-reserved.** Unlike its sibling receiver, nothing here needs an
  owner ruling: no floor is lowered and no ratchet is moved. `owner: maintainer`
  marks who should choose the assertion, not a permission gate.

## Provenance

- **Source:** discovered 2026-09-08 by the autonomous run of
  `road-to-a-graph-that-is-shipped`, from the `git mv`/index defect described
  above. Not from an analysis round and not from an external reference.
- **Council:** none, and it was unavailable rather than skipped — both
  configured seats measured `50/50 · exhausted` (`council_cli quota`,
  2026-09-08), the other three are disabled seats, and `api_on_quota: off`
  forbids the metered rung. The decision this file holds is therefore **not**
  taken here: the run recorded the gap and its options and left the choice.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | The obvious fix lands 23 findings and gets reverted | implementation | Extending either gate's corpus to `archive/` is the first thing a reader will try, and it fails this tree immediately on files the landing change did not cause — the shape this repository has already reverted twice. | § The fix is a decision names the two precedents by gate, states the 23 up front, and puts the day-one count in 1.1's own verify so a choice cannot be made without measuring it | Phase 1 |
| 2 | The ratchet-by-archiving hole is left open while the assertion is debated | product | `open_blockers` is shrink-only, and until something reads the archive a blocker can leave the count by being archived rather than resolved. The debate over (1) vs (2) could outlast several archivals. | Option (3) is a standalone, zero-day-one-finding ratchet that closes this specific hole without settling the wider assertion, and § The fix says the three are not exclusive | Phase 1 |
| 3 | A transition-only check (option 1) misses a copied blocker | implementation | (1) fires on archival, so a blocker duplicated into an archived file by any other route — a hand edit, a bad merge — stays invisible. | Named in (1)'s own description and is precisely what (2) covers; 1.1 requires the chooser to say which class the choice leaves open | Phase 1 |

## Acceptance Criteria

- [ ] AC-1 An archived roadmap carrying `Status: open` is detected by a gate
      rather than by a human reading `git status`.
- [ ] AC-2 The chosen assertion's day-one finding count on this tree is measured
      and recorded, and is zero unless a baseline note states otherwise.
- [ ] AC-3 The sensitivity case from 1.2 exists and has been seen red.
