---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  Nothing in the active estate can be archived to pay for this one. The receiver
  it would otherwise join, road-to-a-ledger-that-closes-the-loop, is the roadmap
  that WROTE the honest prose bound this roadmap turns into a field, and it is
  mid-window under a pre-registered bar that resets on any change to the
  detector's exposure - so folding a schema change into it would reset the very
  qualification it is accumulating. Parking it loses the one measurement that is
  cheap only while the window is still empty.
relates:
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: extends
    note: >-
      That roadmap owns the detector, the shadow bar and the refutation. This
      one adds the writer-identity field its own corpus bound already describes
      in prose, and asks the corpus question its refutation surfaced.
---
# Road to an obligation row that names its writer

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t04/` — a round of independent
> code-level review outputs against one pinned head, plus a supplied audit
> artifact. Three of the reviewers converged on the same unaddressed
> consequence of this tree's own strongest self-refutation.

## Goal

An obligation-ledger row records **which tree wrote it**, so a later reader can
separate rows produced inside the maintainer checkout from rows produced by an
installed consumer copy — and the pre-registered shadow bar cannot be satisfied
by a corpus that is one machine, without that fact being visible in the data
rather than only in a roadmap paragraph. Falsifiable: after Phase 1, every new
row carries a writer field, and a reader can compute the maintainer-versus-other
split from the ledger alone.

## Why now, and what changed since the source was written

The source read the tree at a head where the detector commit was unreleased and
attributed the empty window to that. Re-measured against this tree on
2026-09-29, nine days later:

- `git merge-base --is-ancestor 70b3559bd 16.1.0` now exits **0** — the detector
  IS in a cut release. The release the earlier reading treated as the unblocker
  has happened.
- `grep -rl appendDelivered` over the installed global tree still returns **0**
  files. The installed copy does not carry the writer.
- `agents/runtime/state/obligations/` holds **7** session ledgers (2 at the
  source's pin). Every one carries `"shadow": []`. Total `delivered` rows: 121.
  Shadow rows: **0** of the pre-registered floor of 100.

So the release changed the tag and changed nothing the bar counts, exactly as
`road-to-a-ledger-that-closes-the-loop` predicted in prose — and the prose is
still the only place that fact lives. A row is `{rule, class, at}`; the ledger
is `{discharged, shadow, session_id, delivered}`. Nothing in either says which
tree produced it.

## Phase 1 — Make the writer visible in the row

- [ ] **1.1 Add a writer-identity field to the ledger record.** A stable,
      non-identifying discriminator — the resolved dispatcher root's role, not a
      path, not a username, not a hostname — so the field cannot carry a
      developer's directory layout into a record set the bar will be read from.
      Absent or unresolvable is its own value, never a guess.
      verify: a newly written ledger under `agents/runtime/state/obligations/`
      carries the field, and `node -e` over it prints the discriminator
- [ ] **1.2 Confirm the field cannot hold free-form content.** The record type
      gains one enumerated field and no `payload`, `notes` or `extra` slot, so
      privacy is a property of the shape rather than of a scrubber.
      verify: the type declaration lists only enumerated members; grep the
      writer path for any interpolation of a filesystem path into the record
- [ ] **1.3 State in the bar whether the field resets qualification.** The
      pre-registered clause resets on any change to the detector's exposure and
      carries an additive carve-out for a field that leaves every count and
      every allow path untouched. Say which this is, in the claim, before the
      field ships.
      verify: `docs/CLAIMS.md` obligation-settle-shadow-bar names this change
      and its qualification effect

## Phase 2 — Report the split, decide the corpus

- [ ] **2.1 Report the maintainer-versus-other split, read-only.** A reporter
      over the existing ledgers that prints rows by writer class. It writes
      nothing into the tracked tree.
      verify: run it against the current 7 ledgers; it prints a split and exits 0
- [ ] **2.2 Resolve the corpus blocker below.** The reporter makes the question
      answerable with a number; the answer is not an agent's to give.
      verify: the blocker's `Status` reads `resolved` with the chosen option named

### blocker: shadow-corpus-is-one-machine

**Status:** open
**Owner:** maintainer
**Blocks:** 2.2, and the arming decision in `road-to-a-ledger-that-closes-the-loop`
**What to do:** exactly one of —
  (a) accept the one-machine corpus, and amend the pre-registered bar to say in
      its own words that a passing reading describes this checkout's habits and
      is not evidence about a consumer;
  (b) widen the corpus deliberately — a second tree that runs the built
      dispatcher — and restate the sample floor against the widened population;
  (c) file the window `resolved-null` now on the ground that the population it
      needs does not exist, and require a new pre-registered claim before any
      arming.
**Resolved when:** the chosen option is written into the claim in
`docs/CLAIMS.md`, and the roadmap step that reads the bar cites it.
**Recommendation:** (a) is the cheapest honest move and loses nothing that is
not already lost — the bar's own sample floor is unreachable at the observed
rate, and an amended bar that says so is a smaller claim than a green one.
**If you do nothing:** the window keeps accumulating rows that cannot be
separated by writer, and the first reading that clears the floor will be cited
as evidence about a population it never measured.

## Acceptance criteria

- Every obligation-ledger row written after Phase 1 carries a writer field.
- The split reporter runs read-only against the existing ledgers and prints a
  number for each class.
- The pre-registered bar states whether this change reset its qualification.
- The corpus blocker carries a resolved status with one named option.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The writer field becomes a path or a hostname | implementation | The obvious implementation of "which tree wrote this" is the dispatcher root's filesystem path, which carries a developer's directory layout and usually their username. A governance ledger becomes a privacy surface in one field, and because the bar is read by quoting rows, every row already written would have to be discarded rather than scrubbed. | Step 1.1 restricts the field to a resolved role discriminator with absent as its own value, never a guess. Step 1.2 makes the enumerated shape the control — no `payload`, `notes` or `extra` slot — the same by-construction posture the telemetry event uses, and its verify greps the writer path for any interpolation of a filesystem path. | Phase 1 — Make the writer visible in the row |
| 2 | The field resets the shadow window's qualification unnoticed | implementation | The pre-registered bar resets qualification on any change to the detector's exposure, with an additive carve-out for a change leaving every count and every allow path untouched. Shipping the field without deciding which side it falls on means the window keeps accumulating under a qualification nobody confirmed still holds, and the reset surfaces when the window is read — at which point the accumulated rows are worth nothing. | Step 1.3 puts the qualification question into `docs/CLAIMS.md` before the field ships, and its verify requires the obligation-settle-shadow-bar claim to name this change and its effect. The decision is taken while the window is still empty and therefore cheap to restart. | Phase 1 — Make the writer visible in the row |
| 3 | The split is reported and read as licence to arm early | product | A reporter that prints a maintainer-versus-other split hands the arming discussion its first real number, and a number is read as a verdict. Arming the detector on the observed corpus — 7 ledgers, 121 delivered rows, 0 of a pre-registered floor of 100 shadow rows — would put a live gate behind a bar that measured one machine's habits. | Step 2.2 routes the decision to the corpus blocker rather than to the reporter's output, and all three of that blocker's options name arming as owner-reserved. The reporter itself writes nothing into the tracked tree and reaches no verdict; it prints a split and exits 0. | Phase 2 — Report the split, decide the corpus |
| 4 | Widening the corpus is read as an instruction to generate traffic | product | Option (b) asks for a second real tree running the built dispatcher. The cheap misreading is to manufacture shadow rows — synthetic sessions, replayed prompts, a loosened detector threshold — until the floor of 100 is cleared. That satisfies the count and destroys the only thing the count was ever evidence for. | The blocker's option (b) names a second real tree, and neither alternative offers a synthetic path: (a) amends the bar downward in the open, (c) files the window `resolved-null`. Four of the source's reviewers independently refused threshold-tuning, and that refusal is recorded beside the options rather than left implicit. | Phase 2 — Report the split, decide the corpus |
