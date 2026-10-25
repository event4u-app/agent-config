---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to release records that match the tree

> **Source:** `agents/tmp.old/inbox-2026-10-am/` — a set of external reviews,
> a 49-row rescore, a status update and a parity audit of `main` at
> `1e885a4`/`efa1cca` (2026-10-20), re-verified at `384e9e85c9` (17.4.0) on
> 2026-10-25. About ninety points were extracted; most were overtaken by the
> 17.0.0–17.4.0 cuts or are already owned by a parked roadmap or stub, whose
> arrival counters this round raised. This file carries what was still true and
> owned by nobody.

## Goal

A record a reader trusts says what the tree does: a deletion-claim disproof
acquits only the artifact the claim was about, a contract does not call a
shipped component absent, the security policy names the version that gets
fixes, the owner register does not keep an answered decision open, and an ADR
the code has moved past points at the code.

## Phase 1 — A disproof acquits only what was claimed

- [x] **1.1 Bind a removal word to the names in its own sentence.**
      `contradictedByTree` read any removal word anywhere in a finding as a
      claim about every name the finding carries, its own `file` included. At
      16.5.0 that de-blocked three security findings (one high) about a
      ratification record that said a seat's entry "was removed from" a probe
      file — by checking that the record itself was not deleted. It now reads
      `removalClaimNames`: the names in a sentence that carries the removal
      word, plus `file` when that sentence names it.
      verify: the two cases under "a removal word is a claim only about what
      its own sentence names" in `tests/scripts/self_review_contradicted.test.ts`
      were seen red without the fix and pass with it, and the 16.1.0
      fabrication case still disproves — 153 tests across the self-review and
      disposition suites.

## Phase 2 — Records that say what the tree holds

- [x] **2.1 The collector exists.** `docs/contracts/runtime-component-classes.md`
      said the supervised collector is "not in this tree yet";
      `src/scripts/collector_daemon.ts` is, default-off behind an opt-in marker.
      verify: the contract's collector row and its Class-B paragraph name the
      file and its opt-in.
      reach exempt: a documentation-only step that names the collector's path; the collector ships default-off behind an opt-in marker, so no production entry imports it by design.
- [x] **2.2 The security policy names the published version.** `SECURITY.md`
      said fixes go to the latest published version and listed `main` as the
      supported row; the table now lists the published version as supported
      and unreleased `main` as where fixes land first.
      verify: the table and the sentence above it name the same thing.
- [x] **2.3 Decision 6 of the owner register carries its ruling.** ADR-249
      (`authority_basis: owner_intent`) answered it on 2026-08-27; the register
      still read "Surfaced, not decided" and its header said both "Arrivals: 6"
      and "the counter stops at five". The entry carries the ruling the way
      Decisions 2 and 3 do, the withdrawn sentence says why, and the open
      residue is OQ-8 of `agents/owner-questions.md`, where the owner's
      decisions are read.
      verify: the register's Decision 6 opens with an ANSWERED block citing
      ADR-249, and OQ-8 names every decision still open there.
- [x] **2.4 ADR-282 points at the gate the code runs.** A dated note, not a
      reopening: #2375 and #2381 gave `classify_merge_risk.ts` a third verdict
      and run it from the base revision; the ADR's text still describes two.
      verify: the note sits under § Status and names both PRs.

## Declined or owned elsewhere, with the reason

- **Re-disposing the three 16.5.0 rows.** The release no longer reads a
  findings ledger (owner, 2026-10-22, #2591), so stripping their `contradicted`
  value would red a closed record for no cut; their substance — a ratification
  reached by repeated rounds — is owned by blocker `review-attempt-bound` of
  `later/road-to-authority-routing-mechanism`.
- **Recomputing `contradicted` in `check_finding_dispositions`.** With 1.1 the
  writer no longer over-acquits; recomputing needs the range the reader does
  not have.
- **"Known limitations: _none_" derived from ledger counts (rescore F-2).** No
  17.x release carries a ledger to count from.
- **`failClosed` returning `needs-council` for an unreadable diff.** Inside
  `/pr:merge` § 9a the range is read before the classifier runs, so the path
  is unreachable, and the exit code is documented.
- **An age check on owner-directive overrides.** The override applies only to
  an unreviewed ledger, which no longer blocks a cut.
- **Credential-guard shapes, consumer-matrix `_cli/**`, command links,
  unattended exit 3.** `later/road-to-17-0-follow-ups` 1.10, 3.14, 6.6 and 3.16.
- **Review-input bloat, subagent return gate, code-graph benchmark, ADR-134
  expiry.** Their stubs' arrival counters were raised; each already carries
  its owner question.
- **The 2026-10-29 shadow-bar window.** Blocker `obligation-shadow-rows-live`
  of `later/road-to-a-stop-that-holds-carried` names the date and both
  outcomes; it is calendar-bound.

## Decisions

| ID | Decision | Rung | Record |
|---|---|---|---|
| C1 | Step 1.1's prose verify names the red-then-green tests; no open choice | not a decision | closure scan, 2026-10-25 |
| C2 | Step 2.3 records an owner ruling from 2026-08-27 (ADR-249); it decides nothing new | not a decision | closure scan, 2026-10-25 |
| C3 | "`/pr:merge` § 9a" names a command; the failClosed decline is recorded above with its reason | not a decision | closure scan, 2026-10-25 |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The narrower disproof misses a real fabrication | implementation | A reviewer writes the deletion claim in one sentence and the artifact's name in the next, so no disproof fires and a fabricated block stands. | That is the safe direction: the finding stays blocking and is adjudicated by a person; the 16.1.0 fabrication, written in one sentence, still disproves. | Phase 1 — A disproof acquits only what was claimed |
| 2 | A corrected record is read as a new decision | product | The ADR note or the register annotation is taken to change authority. | Both say they record a ruling or a repair that already happened, with its date and source. | Phase 2 — Records that say what the tree holds |

## Acceptance Criteria

- [x] AC-1 — a removal claim about a file a finding does not name in that
      sentence cannot de-block the finding.
- [x] AC-2 — no record touched here describes the tree differently from the
      file it names.
