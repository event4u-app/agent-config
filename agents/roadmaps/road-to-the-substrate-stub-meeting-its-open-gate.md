---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
depends:
  - road-to-a-recurrence-count-that-survives-the-round
relates:
  - slug: road-to-a-recurrence-count-that-survives-the-round
    relation: depends
    note: >
      That roadmap owns the counting practice; this one is its most expensive
      instance. The arrival line this roadmap writes onto the substrate stub is
      one of the thirteen that roadmap's Phase 1 covers.
estate_growth_exempt: >-
  A held object whose stated gate has been open since the day it was written, unread by three
  subsequent rounds. Verified 2026-09-11: `agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md`
  holds eight tracks behind the line "every track below is unbuildable until that roadmap's Phase 1
  ADR exists"; that roadmap is in `agents/roadmaps/archive/` and the decision record its Phase 1
  landed reads `status: accepted`. The stub carries no `### blocker:` heading for tooling to parse,
  no `status:` line, and no arrival counter. Also grows open_blockers by two.
estate_offset_exempt: >-
  The object this would offset against is the stub itself, and retiring it is precisely the
  decision this roadmap exists to put to the owner rather than take. No active roadmap owns the
  runtime-orchestration subject; the eight tracks have been held there for fifteen days and
  re-argued from scratch by three inbox rounds in that window.
---
# Road to the substrate stub meeting its open gate

> **Source:** `agents/tmp.old/inbox-2026-09-y/t1-typed-state-routing/` — analysed 2026-09-11. The
> control-plane subject has arrived in at least nine consumed rounds. A vessel for it already
> exists and has absorbed those arrivals without recording one, behind a condition that was
> satisfied the day the vessel was written.

## Goal

The runtime-orchestration stub is re-adjudicated against the fact that its stated gate has opened,
each of its eight tracks carries a named disposition instead of prose, and the object carries the
arrival count that three rounds of re-argument would have made unnecessary.

This is the round's structural answer rather than another increment. The stub says every track is
unbuildable until a named roadmap's first phase lands a decision record. That roadmap is archived,
marked ready, and its first phase landed a record that reads accepted — dated the same day the
stub was written. Nothing in the tree records that the gate opened, and the stub is invisible to
blocker tooling because its hold lives in a header line rather than in a blocker section. Three
rounds since have re-derived the architecture instead of reading the file.

## Phase 1 — Read the gate and say whether it is open

- [ ] **1.1 Enumerate the governance conditions the accepted decision record carries** and name
      each one's current state: met, unmet, or unverifiable from tree evidence.
      verify: the enumeration is in the evidence tree with a condition per row and a state per
      condition; no row reads "probably".
- [ ] **1.2 Correct or confirm the stub's gate line** against that enumeration.
      verify: the stub's header states whether the gate is open, with the date and the record it
      was checked against.
- [ ] **1.3 An unmet verdict closes this roadmap cleanly.** If the conditions are not met, the
      stub was right and the finding is that nobody could tell.
      verify: that outcome is recorded as a success rather than as a blocked phase.

## Phase 2 — Write the arrival count onto the object

- [ ] **2.1 Add the arrival line** directly under the stub's source header, naming the count, the
      latest round codename and the earlier ones by codename.
      verify: the line is present, and the source-silence gate stays green — codenames only, never
      a source identity.
- [ ] **2.2 Name the denominator.** The consumed-inbox tree is gitignored, so the count is machine
      local and the ordering is the finding rather than the exact figure.
      verify: the line says what it was counted over.

## Phase 3 — Give the stub the two fields tooling reads

- [ ] **3.1 Add a blocker heading for the hold**, with a slug naming the actual condition rather
      than "waiting on a decision", and the five fields the blocker contract requires.
      verify: `./scripts-run src/scripts/lint_roadmap_blockers` sees the entry, and the five fields
      are present.
- [ ] **3.2 Add a status line** so lifecycle tooling can place the object.
      verify: the stub carries a status and the roadmap dashboard reflects it after a regeneration.

## Phase 4 — Re-cut the eight tracks against the open gate

- [ ] **4.1 Give every track exactly one disposition** — promoted, still gated by a named gate, or
      killed with a reason.
      verify: all eight rows carry one of the three; no row is left as prose.
- [ ] **4.2 Make each row stand alone.** The stub's track rows point into a consumed inbox tree
      that no clone has.
      verify: each row states its own subject without requiring the pointer to resolve.

## Phase 5 — Promote at most one track, or none

- [ ] **5.1 Promote one track to a roadmap, or record that none qualifies.** Both are acceptable
      outcomes and the second needs a reason, not an apology.
      verify: either exactly one new roadmap exists carrying its estate keys, or the stub records
      why none qualified.
- [ ] **5.2 Measure the estate before promoting, not after.**
      verify: `./scripts-run src/scripts/check_estate_count` is green on the promoting change.

## Blockers

### blocker: which-track-promotes-is-owner-reserved
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 5 only. Phases 1 through 4 proceed without it and are the phases that produce
  the finding.
- **What to do:** decide whether any of the eight tracks is promoted, and which. This is an estate
  decision under an unconditional one-in-one-out lint, and no mechanical evidence identifies the
  most valuable track — the ranking is a judgement about what this package should become.
  Run `./scripts-run src/scripts/check_estate_count` to see the current floor before choosing.
- **Recommendation:** promote none in this change. Phases 1 to 4 leave the stub readable,
  parseable and counted, which is what the next round needs; promotion is a separate decision that
  is cheaper to take once the eight tracks carry dispositions.
- **If you do nothing:** the stub becomes readable and countable and stays a stub, which is
  strictly better than today and loses nothing.
- **Resolved when:** one track is promoted with its estate keys, or the stub records that none
  qualified and why.

### blocker: the-governance-conditions-are-a-supervision-read
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 1.2's confirmation, per track. Phase 1.1's enumeration is unblocked — listing
  the conditions and their observable state is evidence work.
- **What to do:** decide whether the accepted record's conditions are satisfied for a given track.
  Read `docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md` and
  `agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md` for the eight tracks they
  gate; `./scripts-run src/scripts/adr_cite_check ADR-249` reports the record's effective state.
  Two options per track: (a) rule the conditions met and let Phase 4 disposition it as promotable;
  (b) rule them unmet and name which condition fails. An agent may enumerate what the conditions
  say and what the tree shows; declaring a governance-shaped condition met for a resident process
  is a supervision judgement and not an agent's to make on its own reading.
- **Recommendation:** take the enumeration from Phase 1.1 and rule on it per track. The expensive
  half is the reading, and Phase 1.1 does it.
- **If you do nothing:** the gate line stays as written, and the eleventh arrival of this subject
  meets the same unread sentence the tenth did.
- **Resolved when:** each condition carries a ruling, or the stub records that the ruling is
  pending with the date it was requested.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The gate reads open while its conditions are unmet per track | product | The record is accepted, which is not the same as its conditions being satisfied for a resident process, and conflating the two would unblock eight tracks on a technicality | Phase 1.1 enumerates all four conditions with their states before any track moves, and the second blocker reserves the ruling | Phase 1 — Read the gate and say whether it is open |
| 2 | Promotion reds the estate ratchet | implementation | The active count is measured against the base ref and a promotion adds to it without an offset | Phase 5.2 measures before promoting and Phase 5.1 permits "none qualifies" as a complete outcome | Phase 5 — Promote at most one track, or none |
| 3 | The track rows dereference into a deleted tree | implementation | The stub's rows point into a consumed inbox directory no clone carries, so a reader who follows them finds nothing | Phase 4.2 rewrites each row to stand alone before anything relies on the pointers | Phase 4 — Re-cut the eight tracks against the open gate |
| 4 | The arrival count becomes the argument | product | A large count invites acting on the subject because it keeps coming back, which is capitulation rather than adjudication | The count is recorded and the decision cites evidence; a repeat opens the question and never answers it | Phase 2 — Write the arrival count onto the object |
| 5 | Phase 4 produces eight dispositions nobody revisits | product | A table of dispositions written once ages exactly like the prose it replaced | Each disposition names its gate, so a later reader checks a named condition rather than re-reading the argument | Phase 4 — Re-cut the eight tracks against the open gate |

## Acceptance Criteria

- [ ] AC-1 — Every governance condition the accepted record carries is listed with its state, and
      no state reads as a guess.
- [ ] AC-2 — The stub's gate line states whether the gate is open, with the date and the record
      checked against.
- [ ] AC-3 — The stub carries an arrival line with its count, codenames only, and its denominator
      named.
- [ ] AC-4 — The blocker linter sees the stub's hold as a parseable entry with all five required
      fields.
- [ ] AC-5 — The stub carries a status line and the dashboard reflects it.
- [ ] AC-6 — All eight tracks carry exactly one disposition each, and each row stands alone
      without a pointer into a consumed tree.
- [ ] AC-7 — Either one track is promoted with its estate keys and the estate gate green, or the
      stub records why none qualified.
