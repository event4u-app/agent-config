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

- [x] **1.1 Enumerate the governance conditions the accepted decision record carries** and name
      each one's current state: met, unmet, or unverifiable from tree evidence.
      verify: the enumeration is in the evidence tree with a condition per row and a state per
      condition; no row reads "probably".
      **landed 2026-09-13** — `agents/evidence/analysis/substrate-stub-gate-conditions-2026-09-13.md`.
      All four ADR-249 conditions, each with a state and a named file. Two state columns, because
      the conditions are predicates on a *process* and none of the eight tracks has one: the
      shipped P1 collector satisfies 1-3 and is the worked example; for the tracks all four read
      `unverifiable from tree evidence`. Condition 4 splits — documentation half met
      (`check_supervision_claim_atomicity` green, `scanned=8 skipped=0`), process half unmet as a
      mechanism, on the governance contract's own words. No row reads "probably".
- [x] **1.2 Correct or confirm the stub's gate line** against that enumeration.
      verify: the stub's header states whether the gate is open, with the date and the record it
      was checked against.
      **landed 2026-09-13** — the stub's `> **Class:**` block is replaced by
      `> **Gate: OPEN since 2026-08-27. Checked 2026-09-13 against ADR-249…**`. The old line was
      a *false statement of fact* ("that roadmap's Phase 1 ADR" does not exist — it was accepted
      the same day the stub was written), and correcting a falsifiable claim is not the reserved
      ruling: the block says explicitly that declaring a condition met per track stays with the
      owner. The same false sentence appeared a second time in the posed-question block and is
      corrected there too, with option 2 struck rather than deleted so an older citation lands
      somewhere.
- [x] **1.3 An unmet verdict closes this roadmap cleanly.** If the conditions are not met, the
      stub was right and the finding is that nobody could tell.
      verify: that outcome is recorded as a success rather than as a blocked phase.
      **branch evaluated and not taken, 2026-09-13** — recorded in the evidence artefact § 3.
      The verdict on the stub's own stated condition is `open`, so the unmet branch does not
      fire. The step is discharged by evaluating it and recording which way it went, not by the
      branch being taken; a reader checking only the checkbox can see the outcome and its basis.

## Phase 2 — Write the arrival count onto the object

- [x] **2.1 Add the arrival line** directly under the stub's source header, naming the count, the
      latest round codename and the earlier ones by codename.
      verify: the line is present, and the source-silence gate stays green — codenames only, never
      a source identity.
      **already landed on `origin/main`, verified 2026-09-13** — by the `depends:` roadmap
      `road-to-a-recurrence-count-that-survives-the-round`, which owns the counting practice; this
      object is one of the thirteen its Phase 1 covers. The line reads `**Arrivals:** 11 (at
      least) - latest \`inbox-2026-09-aa\`…`, codenames only. Re-verified rather than assumed:
      `./scripts-run src/scripts/check_no_external_sources` → `No external inspiration-source
      references in the tracked tree`, and the `shape-block` count is **148, unchanged at
      baseline**, after this change's edits to the same file. Placement note, recorded rather
      than "fixed": the block sits *above* the source header, not under it. The verify condition
      names presence and the gate, both met; moving a block six lines to satisfy a preposition
      would be a drive-by edit on a file eight sibling branches may touch.
- [x] **2.2 Name the denominator.** The consumed-inbox tree is gitignored, so the count is machine
      local and the ordering is the finding rather than the exact figure.
      verify: the line says what it was counted over.
      **already landed on `origin/main`, verified 2026-09-13** — same line: "Counted as distinct
      prior round directories under the consumed-inbox tree, which is gitignored - so the count is
      machine-local and the ordering is the finding, not the exact figure", plus a strictness note
      that `(at least)` is the subject-matched floor and a broad keyword sweep returns more.

## Phase 3 — Give the stub the two fields tooling reads

- [x] **3.1 Add a blocker heading for the hold**, with a slug naming the actual condition rather
      than "waiting on a decision", and the five fields the blocker contract requires.
      verify: `./scripts-run src/scripts/lint_roadmap_blockers` sees the entry, and the five fields
      are present.
      **landed 2026-09-13**, and **the verify's first clause is unsatisfiable at this file's
      location — that is a finding, not a skipped step.** `### blocker:
      per-track-governance-ruling-unmade` carries all five required fields plus both decidability
      fields (`Recommendation`, `If you do nothing`) and an explicit `Class: 3`. The slug names the
      condition, not the wait.
      **Why the named gate cannot see it:** `lint_roadmap_blockers.ts:48` sets
      `ROADMAP_GLOB = 'agents/roadmaps/*.md'` — non-recursive — and its own header states the
      exclusion as deliberate ("`later/` and `archive/` are outside this gate's glob"). `stubs/` is
      outside it on the same terms. Run at this revision the gate reports `14 roadmap(s)
      blocker-contract-clean` and the stub is not among them. So the roadmap's own § Goal is
      **half right**: the stub was invisible to blocker tooling for *two* reasons, not one — no
      `### blocker:` heading (fixed here) **and** a gate glob that never reaches the directory
      (untouched here, and named for whoever takes it).
      **What was verified instead, red-before-green:** the tooling that *does* read stub blockers.
      `count_owner_decisions()` in `src/agent-src/scripts/stubs_due.ts` — the parser the dashboard
      consumes — returns **0 on the `origin/main` copy of the stub and 1 on this one**, keyed on
      exactly the `- **Status:** open` and `- **Owner:** maintainer` lines this step added.
      **Not widened on purpose:** extending that glob to `stubs/` judges 121 files by a contract
      their directory was excluded from, which is a gate-scope decision outside this roadmap.
      Measured so the next person does not have to: all five stubs that already carry blocker
      headings pass both the required and the decidability field sets, so the widening looks cheap
      — it is still a decision, and it is not this roadmap's.
- [x] **3.2 Add a status line** so lifecycle tooling can place the object.
      verify: the stub carries a status and the roadmap dashboard reflects it after a regeneration.
      **landed 2026-09-13.** Two surfaces, because a stub's lifecycle fields are not a roadmap's:
      (a) the blocker's `- **Status:** open` line, which is literally what
      `stubs_due.ts:215` reads to place the object; (b) the stub frontmatter contract from
      `agents/roadmaps/stubs/README.md` § Frontmatter contract — `reviewed_at: 2026-09-13`
      (this run is the substantive re-read), `blocker_class: product`, `blocker_opened:
      2026-08-27`, which give `stubs:due` the hold's age and its class.
      **Dashboard reflects it:** regenerated via `src/agent-src/scripts/update_roadmap_progress.ts`
      — the header's owner-decision counter moves **12 → 13**, and `stubs:due`'s own OWNER bucket
      **37 → 38** (`ownerPhrase: "reserved to the owner"`). The estate ratchet is unmoved:
      `check_estate_count` → `open_blockers 53 (floor 53, +0)`, because that metric excludes
      `stubs/` by construction.
      **Deliberately not written: a frontmatter `status:` key.** No tooling reads one on a stub —
      every roadmap-lifecycle gate excludes `stubs/` via `EXCLUDE_DIRS` — and the stubs README
      warns in its own Iron Law against a field "certifying attention it does not pay". A status
      nothing reads is the invisibility this roadmap is about, one layer up.

## Phase 4 — Re-cut the eight tracks against the open gate

- [x] **4.1 Give every track exactly one disposition** — promoted, still gated by a named gate, or
      killed with a reason.
      verify: all eight rows carry one of the three; no row is left as prose.
      **landed 2026-09-13.** The table gained a **Disposition** column with the vocabulary stated
      above it. All eight read **gated**, and that is a re-cut rather than the status quo: the
      *common* gate every row shared ("governance-flip Phase 1's ADR") is retired for all eight,
      replaced by eight different, individually checkable conditions — ADR-124 § 6's state-store
      test for the control store; "a second resident process exists" for the supervisor; a recorded
      contention failure for the lease manager; the control store itself for durable handoff; a
      measured risk signal for the concern DAG; a residency-beats-per-command measurement for
      resident code intelligence; a cancelled `[-]` precondition with no owner for the confidence
      ladder; and "something worth replaying exists" for the evidence graph.
      **Why no row reads `promoted` or `killed`:** both are owner rulings. Promotion is reserved by
      `which-track-promotes-is-owner-reserved`; a kill would pre-empt option 4 of the stub's own
      posed question, which the stub leaves open in both directions. The confidence-ladder row is
      surfaced *as* the strongest kill candidate — its precondition is cancelled, not merely
      unmet — without the ruling being taken.
- [x] **4.2 Make each row stand alone.** The stub's track rows point into a consumed inbox tree
      that no clone has.
      verify: each row states its own subject without requiring the pointer to resolve.
      **landed 2026-09-13.** The `Source section` column — eight `§ 3.2`-style pointers into
      `agents/tmp.old/`, gitignored and absent from every clone — is **removed**, not relabelled as
      a historical note. Each Track cell now carries its own one-clause subject ("SQLite/WAL holding
      runs, tasks, leases and events across invocations"; "symbol/reference/dependency graph kept
      warm across commands"), and every gate cell names files that exist in a clone. The provenance
      warning above the table is rewritten to record the removal and why. Nothing in the table now
      depends on the disposable tree resolving.

## Phase 5 — Promote at most one track, or none

> **Phase 5 is not landed in this change, and the reason is the blocker below, not the budget.**
> `which-track-promotes-is-owner-reserved` is a genuine owner judgement that survives the
> capability test: an agent *can* create a roadmap file, so the `Class: 3` label is not what stops
> it — what stops it is that the ranking is a decision about what this package should become, and
> no mechanical evidence in the tree identifies the most valuable track. Phases 1 to 4 were built
> so that this decision is cheaper when it is taken: every row now names a condition the owner can
> check in one command instead of an argument they must re-read. The blocker's own
> **Recommendation** — promote none in this change — is followed, and following a recommendation
> is not the same as taking the decision, so both steps stay open.
>
> **Both steps now carry the inline `blocked-by:` marker, and that is a fix rather than a
> formality.** `scanOpenSteps` in `src/scripts/hooks/run_continuation_hook.ts` reads blockedness
> from the marker and from nothing else — it never parses `## Blockers` — so a step declared
> blocked only in prose still counts as open work to the stop-slot concern, which re-engaged an
> autonomous run into this owner decision on every fire. Measured on this file before the markers:
> `{ open: 2, blocked: 0 }`, with `next` pointing at 5.1; after: `{ open: 0, blocked: 2, next:
> null }`. The dashboard is unmoved by the edit, which is the point — the boxes stay `[ ]` and the
> roadmap stays unarchivable; only the concern's read of them changes.

- [x] **5.1 Promote one track to a roadmap, or record that none qualifies.** Both are acceptable
      outcomes and the second needs a reason, not an apology.
      verify: either exactly one new roadmap exists carrying its estate keys, or the stub records
      why none qualified.
      **DECIDED 2026-09-15 — promote none, per the blocker's own recommendation.** The owner
      approved this session's batch of prepared recommendations. No track carries a ruling on
      the second blocker (`the-governance-conditions-are-a-supervision-read`) yet, and
      `check_estate_count` sits at the floor with no offset in hand (5.2), so promoting any
      track now would either red the estate ratchet or promote on an unruled governance
      condition — exactly the technicality risk rank 1 names. Recorded on the stub itself:
      `agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md` now carries a line
      under its track table stating none qualified this round and why, dated 2026-09-15.
- [x] **5.2 Measure the estate before promoting, not after.**
      verify: `./scripts-run src/scripts/check_estate_count` is green on the promoting change.
      **Measured anyway, so the owner does not have to.** At this revision
      `./scripts-run src/scripts/check_estate_count` is green with `open_blockers 53 (floor 53 at
      origin/main, +0)` and `this change +0 active / -0 disposed`. A promotion adds one active
      roadmap against an unconditional one-in-one-out floor, so it needs an offset named in the
      same change.
      **CLOSED 2026-09-15 by 5.1's decision.** No promoting change exists — none was promoted —
      so there is no offset to name; the measurement above (`open_blockers 53`, floor 53, `+0`)
      is the record this step asked for.

## Blockers

### blocker: which-track-promotes-is-owner-reserved
- **Status:** resolved — 2026-09-15, "promote none this round" (owner-approved recommendation)
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
<!-- risk-review: v1 | reviewed: 2026-09-15 | reviewer: claude/host -->

Re-reviewed 2026-09-15 after Phase 5 landed (promote none). Ranks 3 and 5 discharged
2026-09-13; rank 2 discharges in this pass — Phase 5's measurement is on record and no
promotion occurred, so there is nothing left for it to guard against. Rank 1 stays live: it
guards the per-track governance ruling, which promoting none does not settle. Rank 4 is
**discharged**: the pressure it named was resolved by naming conditions rather than a track,
which is exactly its own stated mitigation landing. Rank 6 stays live — it is about the
table's own staleness, which this re-review is an instance of rather than a fix for.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The gate reads open while its conditions are unmet per track | product | The record is accepted, which is not the same as its conditions being satisfied for a resident process, and conflating the two would unblock eight tracks on a technicality | **Holding, and tested once.** Phase 1.1 enumerated all four conditions with their states before any track moved; the stub's new gate line states in its own text that the common gate is retired and the per-track condition is reserved; the second blocker reserves the ruling. The temptation was live and real — "the ADR exists" reads as "the tracks are unblocked", and the evidence artefact § 2 keeps the two readings apart on purpose | Phase 1 — Read the gate and say whether it is open |
| 2 | Promotion reds the estate ratchet | implementation | The active count is measured against the base ref and a promotion adds to it without an offset | **Discharged 2026-09-15.** Phase 5 decided promote-none; no active roadmap was added, so there is no offset to owe. 5.2's measurement (`open_blockers 53`, floor 53, `+0 active`) is the record of the floor the decision was taken against | Phase 5 — Promote at most one track, or none |
| 3 | The track rows dereference into a deleted tree | implementation | The stub's rows point into a consumed inbox directory no clone carries, so a reader who follows them finds nothing | **Discharged 2026-09-13.** The `Source section` column is removed, not relabelled; every remaining pointer in the table resolves in a clone | Phase 4 — Re-cut the eight tracks against the open gate |
| 4 | The arrival count becomes the argument | product | A large count invites acting on the subject because it keeps coming back, which is capitulation rather than adjudication | **Discharged 2026-09-15.** The owner-approved decision promotes none and cites the per-track gated conditions, not the arrival count, as the reason. The count set the venue; the conditions set the verdict | Phase 2 — Write the arrival count onto the object |
| 5 | Phase 4 produces eight dispositions nobody revisits | product | A table of dispositions written once ages exactly like the prose it replaced | **Discharged as far as authoring can.** Every gate cell names a file, a command or a cancelled step a later reader checks directly. What authoring cannot do is make anyone look, which is what rank 6 now carries | Phase 4 — Re-cut the eight tracks against the open gate |
| 6 | The re-cut table ages the way the sentence it replaced did | product | This roadmap exists because one header line stopped being true and no surface noticed for fifteen days. Eight per-track gates are eight more sentences that can go stale the same way — and two of them cite the state of *other* roadmaps, which move | The stub is now inside `stubs:due`: `reviewed_at`, `blocker_class` and `blocker_opened` are set, and its blocker counts as an owner decision, so a lapse surfaces in the dashboard header instead of waiting for the next arrival. That is a reader, not a guarantee — the honest residual is that nothing re-checks the eight gate conditions themselves | Phase 3 — Give the stub the two fields tooling reads |

## Acceptance Criteria

- [x] AC-1 — Every governance condition the accepted record carries is listed with its state, and
      no state reads as a guess. — `agents/evidence/analysis/substrate-stub-gate-conditions-2026-09-13.md`,
      four conditions, a state and a named file per row.
- [x] AC-2 — The stub's gate line states whether the gate is open, with the date and the record
      checked against. — "Gate: OPEN since 2026-08-27. Checked 2026-09-13 against ADR-249".
- [x] AC-3 — The stub carries an arrival line with its count, codenames only, and its denominator
      named. — landed on `origin/main` by the `depends:` roadmap; re-verified here, source-silence
      gate at baseline 148 after this change's edits to the same file.
- [ ] AC-4 — The blocker linter sees the stub's hold as a parseable entry with all five required
      fields. **Open, and deliberately not laundered.** The five fields are present and the entry
      parses — `count_owner_decisions()` in `src/agent-src/scripts/stubs_due.ts` goes **0 → 1** on
      it, which is what made Phase 3 landable. But the AC names `lint_roadmap_blockers`, and that
      gate does **not** see the entry and structurally cannot: `lint_roadmap_blockers.ts:48` globs
      `agents/roadmaps/*.md` non-recursively, and its own header declares non-active directories
      out of scope on purpose ("`later/` and `archive/` are outside this gate's glob"). `stubs/`
      is outside it on identical terms.
      **Two ways to close it, neither this roadmap's to take.** Widen that glob to `stubs/` — cheap
      on today's measurement (all five stubs that carry blocker headings already pass both the
      required and the decidability field sets) but still a gate-scope decision over 121 files. Or
      amend the AC to name the gate that actually reads stub blockers. Left open rather than
      reworded, because an AC edited to match what was achieved stops being an acceptance test.
      The receiving object for the gate-blindness half already exists:
      `agents/roadmaps/stubs/road-to-blocker-parse-visibility.md`, which records the sibling defect
      in the same parser family. It is a stub, so it is named as a *pointer* and not as a
      `carried-to=` receiver — a deferral needs a real roadmap, and none owns this yet.
- [x] AC-5 — The stub carries a status line and the dashboard reflects it. — `- **Status:** open`
      inside the blocker plus three stub-contract frontmatter fields; dashboard owner-decision
      counter 12 → 13 after regeneration, `stubs:due` OWNER bucket 37 → 38.
- [x] AC-6 — All eight tracks carry exactly one disposition each, and each row stands alone
      without a pointer into a consumed tree. — Disposition column added, `Source section` column
      removed, every gate cell cites a path that exists in a clone.
- [x] AC-7 — Either one track is promoted with its estate keys and the estate gate green, or the
      stub records why none qualified. — **DECIDED 2026-09-15**: promote none, per the owner's
      approval of `which-track-promotes-is-owner-reserved`'s own recommendation. The stub records
      why (all eight rows read `gated` on their own measured condition; nothing was open to
      choose between) at `road-to-runtime-orchestration-substrate.md`, above the track table.
