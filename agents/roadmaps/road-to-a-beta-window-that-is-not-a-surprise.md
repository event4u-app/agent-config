---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-dated-trigger-that-decides
    relation: disjoint
    note: >
      Sibling shape, opposite defect. That roadmap covers dated commitments
      nothing reads back — an ADR expiry a tool reports as indeterminate. Here
      the gate reads the date correctly and fires; what is missing is an owner
      for the eight days before it does.
estate_growth_exempt: "A contract lapses on 2026-09-14 as a FRESH lapse, which `check_beta_review_markers` classifies as an error rather than a warning because `docs/contracts/reasoning-discipline-protocol.md` is absent from `src/config/lapsed-beta-baseline.json` — verified by grep. That is eight days from authoring and it reddens every pull request, not only reasoning changes. No active roadmap, later roadmap or stub owns any beta window; the 84 already-lapsed contracts sit under an inherited baseline whose own clearance date is 2026-11-23, and nothing owns that either."
estate_offset_exempt: "Cannot be offset. Its subject is a date eight days out; parking it to pay for another roadmap lets the lapse land and turns a scheduled decision into a broken trunk."
---
# Road to a beta window that is not a surprise

> **Source:** `agents/tmp.old/inbox-2026-09-r/` — one of eleven prepared harvest
> loops delivered on 2026-09-06. The lapsing contract was named there; the
> fresh-versus-inherited distinction and the 2026-11-23 cliff are this run's own
> reproduction against `6af83a64b`.

## Goal

No `stability: beta` contract in this repository reaches its `keep-beta-until`
date without someone having decided what happens at it. Reproduced at
`6af83a64b`: `docs/contracts/reasoning-discipline-protocol.md:3` carries
`keep-beta-until: 2026-09-14`; `grep -c reasoning-discipline-protocol
src/config/lapsed-beta-baseline.json` returns 0, so the checker's
error-versus-warning split (`check_beta_review_markers.ts:233-247`) puts it in
the error branch the moment the date passes. Separately,
`./scripts-run src/scripts/check_beta_review_markers` reports **84** violations
and exits **0**, because all 84 are inherited entries in the frozen 2026-08-25
baseline with a stated clearance of 2026-11-23 — a date that is 78 days out at
authoring and that no roadmap, stub or blocker names. Out of scope by decision:
promoting or superseding any contract on this roadmap's own authority (that is
the owner's call, recorded as a blocker), and any change to the 90-day window
arithmetic.

## Phase 1 — The next lapse is visible before it lands

- [ ] **1.1 Report the fresh-lapse horizon, not only the lapse.** The checker
      prints a contract as lapsed on the day it lapses. Make it also name contracts
      whose window closes within a stated horizon and which are absent from the
      baseline — the set that will become errors rather than warnings.
      verify: a run on 2026-09-06 names `reasoning-discipline-protocol.md` as due
      within the horizon and does not name any contract already in the baseline;
      exit code is unchanged for both.
- [ ] **1.2 Say which of the two branches a contract is in, in the output.** Today a
      reader cannot tell an inherited warning from a future error without opening
      `lapsed-beta-baseline.json`.
      verify: each reported line carries `inherited` or `fresh`, and moving a fixture
      contract between the two changes the label and the exit code together.

## Phase 2 — The inherited baseline gets a named end

- [ ] **2.1 Attach the 2026-11-23 clearance to something that will be read.** The date
      lives in the checker's message and in no plan. Record it where a run meets it —
      a blocker on this roadmap, a `review_by`, or a registry entry — so the day the
      baseline expires is not the day it is discovered.
      verify: `grep -rn "2026-11-23" agents/roadmaps/ docs/` returns at least one
      tracked, dated obligation naming the baseline, and removing the baseline file
      reddens a check rather than silently passing.
- [ ] **2.2 Count the 84 by contract, not by line.** The figure is a violation count;
      the decision needs the number of distinct contracts and how many are duplicated
      across surfaces.
      verify: the run prints both counts, and their relationship is stated rather than
      left for the reader to infer.

## Phase 3 — The eight-day contract is routed

- [ ] **3.1 Put the reasoning-discipline-protocol window in front of its owner.** Three
      actions are legal under the contract's own rules: promote to stable, extend with
      a stated reason and a new date at most 90 days out, or record it superseded. This
      roadmap takes none of them; it makes the choice dated and visible. Recorded as a
      blocker below.
      verify: on 2026-09-15 either the contract carries one of the three outcomes, or
      `check_beta_review_markers` exits non-zero and a record names the lapse as accepted.

## Blockers

### blocker: rdp-contract-beta-window

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-06, in the round `inbox-2026-09-r` disposition and in the reply that carried it.
- **Blocks:** Phase 3 only. Phases 1 and 2 are independent and agent-doable in full — the horizon report and the baseline's own end date are needed whichever way this contract goes.
- **Recommendation:** none; this is the owner's call — promoting a contract to `stable` is a public commitment about what consumers may rely on, which `decision-revisit-gate`'s reserved set puts out of agent reach.
- **If you do nothing:** on 2026-09-15 `check_beta_review_markers` moves this contract into its error branch and every pull request in the repository turns red until someone edits the file under time pressure.
- **What to do:**
  1. Promote it — set `stability: stable` in `docs/contracts/reasoning-discipline-protocol.md` and delete the `keep-beta-until` line, then confirm with `./scripts-run src/scripts/check_beta_review_markers`.
  2. Or extend it — replace the date with one at most 90 days out (2026-12-05 is the maximum on 2026-09-06) and state the reason in the same edit.
  3. Or supersede it — add `superseded-by: <contract-id>` naming the record that replaces it.
- **Resolved when:** `./scripts-run src/scripts/check_beta_review_markers` reports the contract in none of its lapsed branches, or an evidence record names the lapse as deliberately accepted.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The horizon report becomes a second warning nobody reads | product | The tree already prints 84 warnings that exit 0; adding a third class of advisory line to the same output is the most likely way for this work to change nothing at all. | 1.2 requires the fresh/inherited label to move with the exit code rather than beside it, so a fresh lapse is distinguishable by consequence and not only by wording; 3.1 puts the one contract that is actually about to fire in front of a named owner with a date. | Phase 1 — The next lapse is visible before it lands |
| 2 | The horizon is set wide enough to fire on everything | implementation | A horizon of 90 days would name every beta contract in the tree on every run, which is the same as naming none — and the number is easy to pick to make the first run look useful. | 1.1's verify pins both directions on real contracts: the fresh one must appear, every baseline entry must not; a horizon that names a baselined contract fails the step. | Phase 1 — The next lapse is visible before it lands |
| 3 | The baseline is extended instead of cleared | product | 2026-11-23 arrives with 84 entries unaddressed and the cheapest action is to move the date, which converts a one-time amnesty into a standing one. | 2.1 requires the clearance date to live in a tracked obligation rather than in a checker message, so moving it is a visible edit to a plan; 2.2 makes the real size of the set known before that decision rather than after. | Phase 2 — The inherited baseline gets a named end |
| 4 | Phase 3 is read as authorization to promote the contract | implementation | Promotion is one keystroke and the roadmap names it first among three options, which is exactly the state where an autonomous run picks it. | The blocker states the reservation and carries no recommendation; 3.1's verify is satisfied by any of the three outcomes including a recorded acceptance of the lapse, so nothing about it rewards promoting. | Phase 3 — The eight-day contract is routed |

## Acceptance Criteria

- [ ] AC-1 — `check_beta_review_markers` names contracts whose window closes within a stated horizon and are absent from the baseline, and names no baselined contract in that set.
- [ ] AC-2 — Every reported line says whether it is inherited or fresh, and the label moves together with the exit code.
- [ ] AC-3 — The inherited baseline's clearance date exists as a tracked, dated obligation, and deleting the baseline file reddens a check.
- [ ] AC-4 — The violation count and the distinct-contract count are both printed, with their relationship stated.
- [ ] AC-5 — `docs/contracts/reasoning-discipline-protocol.md` is promoted, extended, or superseded — or a record names its lapse as accepted. Never none of the four.
