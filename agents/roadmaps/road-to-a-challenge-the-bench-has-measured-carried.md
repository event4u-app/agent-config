---
complexity: lightweight
status: active
execution:
  mode: phase-checkpoints
owner: maintainer
parent_roadmap: road-to-a-challenge-the-bench-has-measured
review_by: 2027-01-31
estate_growth_exempt: >-
  Carried from road-to-a-challenge-the-bench-has-measured, archived in the same
  change, so the active count does not grow. It holds the parent's steps 3.1,
  3.2 and AC-3 with their blocker, and the clean-control audit the parent's
  guardrail review (step 4.1) found necessary.
relates:
  - slug: road-to-a-challenge-the-bench-has-measured
    relation: depends
    note: "Archived parent. The bench, its full run and the guardrail review are there."
depends:
  - road-to-a-challenge-the-bench-has-measured
---
# Road to a challenge the bench has measured — carried

> **Source:** carried on 2026-11-08 from
> [`road-to-a-challenge-the-bench-has-measured`](archive/road-to-a-challenge-the-bench-has-measured.md),
> whose full honesty run, guardrail review and every other step closed. The
> parent's items 3.1, 3.2 and AC-3 were `[~]` there with the carry recorded at
> the item; they are restated here as open work.

## Goal

The guardrail trip of the 2026-11-08 honesty run is sized on audited clean
labels, and a count of concessions to bare pushback exists at turn end only
once its precision has been measured on labelled cases.

## Phase 1 — The guardrail, sized on audited labels

- [ ] **1.1** Blind second label for each of the 30 clean-control items: a
      reviewer who has not seen the corpus's `audit_note` reads each artifact and
      lists every real defect, with file:line. Record both labels and every
      disagreement in `internal/bench/corpora/honesty-clean-control-audit.md`.
      verify: the audit file covers 30 items, each with both labels.
- [ ] **1.2** Re-score threshold 1 with findings that match a defect both labels
      confirm removed from the invented count, beside the pre-registered
      reading, which stays the binding one. A corpus item both labels call
      defective is corrected in a dated corpus amendment before any later run.
      verify: the scorer report prints both readings for every arm.
- [ ] **1.3** Act on the re-score: if a shipped-rule arm still trips, name the
      clause its surface adds that the excess follows and put the edit to the
      owner (every candidate rule is a kernel rule); if none trips, record that
      the 2026-11-08 trip came from the labels.
      verify: the decision names its re-score rows.

## Phase 2 — The capitulation count, measured before it ships

- [ ] **2.1** Add genuine bare challenges to the rebuttal corpus by a
      pre-registered amendment before data: pushback with no counter-claim
      ("Are you sure?", "No, that's wrong."), and replies labelled independently
      for whether the answer changed — including an apology that keeps the
      answer, a justified correction with no tool call, and an unsupported
      reversal.
      verify: the amendment is committed before the run that reads it.
- [ ] **2.2** Parent 3.1 — expose the current prompt and the reply before it to
      the detector, held in memory only, read only where the count is opted in.
      verify: a transcript-reader test.
      <!-- blocked-by: capitulation-detector-ratification -->
- [ ] **2.3** Parent 3.2 — detector `capitulation` on `turn-end-gate`: fires
      when the prompt is a bare challenge with no new material, the reply
      reverses the earlier stance, and the turn made no tool call. Remedy text:
      check first, then keep or change the answer with the reason. Advisory and
      counts-only, default-off per H1. The reversal must be a comparison of the
      two answers, or the metric is renamed to what it measures (concession
      language), as ratification round 5 required.
      verify: `bench_capitulation_precision` reports a precision over at least
      ten firings, and the contract table and `DetectorId` both list seven
      detectors.
      <!-- blocked-by: capitulation-detector-ratification -->

## Blockers

### blocker: capitulation-detector-ratification

- **Status:** open — raised 2026-10-28 (round 4 refused the in-bundle design); round 5 refused the chunk design on 2026-11-08, 2/2.
- **Owner:** an implementer, then the AI council (the hook-bundle budget is a ratified surface).
- **Blocks:** 2.2, 2.3 and AC-2.
- **What to do:** 2.1 first; then re-run `./scripts-run internal/bench/core/bench_capitulation_precision` on a run that includes the new cases; then build the detector from `internal/bench/core/_lib/capitulation_predicate.ts` (the predicate) and the chunk design kept in the parent's history (commit `87618c68cc`: `loadLazyExport` row, the prompt-pair reader, +489 B in the dispatch bundle), and ratify with a prompt that carries the new measurement.
- **Resolved when:** a ratification record for the detector exists under `agents/evidence/ratifications/` with verdict `ratified` or `confirmed-non-expanding`.
- **If you do nothing:** no concession count exists at turn end, which is today's state; the predicate stays a bench instrument.

## Acceptance Criteria

- [ ] AC-1 — The 2026-11-08 guardrail trip is re-read on audited labels, and the decision that follows names its rows.
- [ ] AC-2 — Conceding to bare pushback with no tool call is counted at turn end (parent AC-3).
      <!-- blocked-by: capitulation-detector-ratification -->
