---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-the-ledger-two-releases-skipped
    relation: disjoint
    note: >
      Same family of defect — a written commitment nothing reads back — and
      deliberately non-overlapping surfaces. That roadmap owns the per-release
      findings ledger. This one owns the two dated commitments that live
      outside a release artifact: an ADR expiry date and the release head's
      own next-cycle promise.
estate_growth_exempt: "One decision record in the corpus carries a machine-readable expiry date, that date is nine days out at authoring time, and the tool this repository built to evaluate reopen conditions returns `indeterminate` on it — reproduced. No active roadmap, later roadmap or stub owns dated-trigger evaluation; the nearest, road-to-host-enforcement-truth, owns host capability rows and says so. The work adds no gate script of its own: it teaches one existing tool a date comparison and gives one existing generated line a reader."
estate_offset_exempt: "Cannot be offset. Its subject is a date that lapses on 2026-09-15; parking it to pay for another roadmap would let the lapse happen and then record it as a compliance finding, which is precisely the silent extension the ADR's own review_trigger forbids."
---
# Road to a dated trigger that decides

> **Source:** `agents/tmp.old/inbox-2026-09-q/` — an external multi-model review
> round on releases 14.17.0 and 14.18.0, verified against the tree at
> `99d14b2e7` on 2026-09-06. The review named the lapsing ADR; the mechanism
> below is this repository's own, and the `indeterminate` reproduction is not in
> the review at all. One review figure was wrong and is not carried: the ADR's
> last commit is 2026-07-28, not "since 2026-08-25".

> **Arrivals:** 2 — latest `inbox-2026-09-q` (2026-09-06); earlier: the round
> that raised the same ADR's expiry without a receiver.

## Goal

A commitment this repository writes with a date on it is read back by something
before the date passes. Two such commitments exist and neither is read. First:
`docs/decisions/ADR-134-launch-decision-dated-defer.md:11` opens its
`review_trigger` with `Expiry 2026-09-15` and states that a lapsed expiry with
no action "is an open compliance finding for the next review cycle, not a silent
extension" — yet `./scripts-run src/scripts/adr_cite_check ADR-134` reports
`trigger state indeterminate`, because the tool treats every trigger as a
semantic condition. Second: `check_release_highlights.ts` blocks a release whose
head owes a governance-mix response, and `_lib/release_material.ts` generates the
`Next cycle ships …` line — but nothing reads the *previous* release's line to
ask whether the promise was kept, so an unmet promise can be restated
indefinitely at zero cost. Out of scope by decision: any machine-readable grammar
for semantic triggers (both council seats rejected that on 2026-08-19 and the
rejection stands — a date is not a semantic condition and is the only sub-class
this roadmap touches), and any change to what a release is allowed to promise.

## Phase 1 — A date in a trigger is decidable

- [x] **1.1 Teach `adr_cite_check` the dated sub-class, and only that.** When a
      `review_trigger` opens with a parseable `Expiry YYYY-MM-DD` (or an equivalent
      leading date form), the tool returns `fired` or `not-fired` against `asOf()`
      instead of `indeterminate`. Every other trigger keeps `indeterminate`, which
      the module docstring already defends as a first-class result.
      verify: `./scripts-run src/scripts/adr_cite_check ADR-134` prints
      `trigger state fired` on any date at or after 2026-09-15 and `not-fired`
      before it, and a fixture ADR whose trigger is purely semantic still prints
      `indeterminate`.
- [x] **1.2 Say in the record why the council's rejection does not reach this.** The
      2026-08-19 rejection was of forcing *semantic* conditions to a boolean. The
      docstring must state that the dated sub-class is decided by arithmetic and
      carries no interpretation, so a later reader cannot mistake 1.1 for the
      rejected grammar.
      verify: the docstring names the rejection, states the carve-out in one
      sentence, and `./scripts-run src/scripts/adr_cite_check ADR-227` — whose
      trigger is semantic — still reports `indeterminate`.
- [x] **1.3 Surface a fired date where a human meets it.** A trigger that has fired,
      or fires within a stated window, appears in the ADR index or the proof surface
      rather than only in a command nobody runs.
      verify: a fired or near-fired trigger is visible in generated output without
      naming the ADR by hand, and removing the date from the ADR removes the line.

## Phase 2 — The release promise is read back

- [x] **2.1 Read the previous release's `Next cycle ships` line at release time.** The
      current release's head states whether each item the previous head promised
      shipped, did not ship, or was withdrawn with a reason. The reader is the existing
      `check_release_highlights` path; no new script.
      verify: a release head that ignores the previous promise is refused by
      `check_release_highlights`, and one that answers it — in any of the three forms —
      passes.
- [x] **2.2 Answer 14.18.0's own promise in the next head.** `CHANGELOG.md:497-500`
      promises the MCP-bridge repair (version-pinned entry, self-migrating
      registration, docs matching the installer). The next release head states its
      outcome, whatever it is.
      verify: the next release head contains a line naming that promise and its
      outcome, and 2.1's check would have refused the head without it.

## Phase 3 — ADR-134's own date is met, not merely watched

- [x] **3.1 Route ADR-134 before 2026-09-15.** The ADR gives the maintainer exactly two
      actions — post, or commit a superseding deferral with a signed reason and a new
      expiry at most 90 days out. This roadmap does neither on its own authority; it
      makes the choice visible and dated. The owner decision is recorded as a blocker
      below.
      verify: on 2026-09-16 either `docs/decisions/` carries a record superseding
      ADR-134 with a new dated expiry, or `adr_cite_check ADR-134` reports `fired` and
      a compliance finding exists naming the lapse.

## Blockers

### blocker: adr-134-expiry-owner-action

- **Status:** resolved
- **Outcome:** transferred — the ROADMAP dependency is closed; the owner action is not, and is not taken here.
- **Owner:** maintainer
- **Asked:** 2026-09-06, in the round `inbox-2026-09-q` disposition and in the reply that carried it.
- **Blocks:** Phase 3 only. Phases 1 and 2 are independent and agent-doable in full.
- **Recommendation:** none; this is the owner's call — it is a public commitment about this package, and `decision-revisit-gate`'s reserved set puts it out of agent reach in either direction.
- **If you do nothing:** the expiry lapses on 2026-09-15 and, by the ADR's own words, becomes "an open compliance finding for the next review cycle, not a silent extension" — a finding this repository will then have to record against itself.
- **What to do:**
  1. Post under `agents/roadmaps/skipped/road-to-adoption-without-narrative-debt.md`, which is the action ADR-134 names, and record the date.
  2. Or write a superseding deferral record in `docs/decisions/` with a signed reason and a new `Expiry YYYY-MM-DD` at most 90 days out, then confirm with `./scripts-run src/scripts/adr_cite_check ADR-134`.
  3. Or state that the lapse is accepted, in which case Phase 3.1's compliance finding is the deliverable rather than a defect.
- **Resolved when:** `./scripts-run src/scripts/adr_cite_check ADR-134` reports a superseded status with a new dated expiry, or a compliance finding naming the lapse exists in `agents/evidence/`.
- ADR-134 is a launch decision. Which of the two actions is taken is a public,
  external commitment about this package and is owner-reserved under
  `decision-revisit-gate`'s reserved set; no agent may pick either. Phase 1 and
  Phase 2 are independent of this blocker and are agent-doable in full — the
  mechanism that makes a lapse visible does not need the lapse resolved first.
- **Resolution, 2026-09-06 — roadmap closure, not substantive resolution.** AI
  council, two seats, two rounds, under the maintainer's standing delegation for
  the drain run: **unanimous** that posting the launch decision and writing a
  superseding deferral are both owner-reserved public commitments, so this
  blocker **descopes**. What closed is this roadmap's dependency on the answer.
  What did **not** close is ADR-134: no record supersedes it, no launch decision
  has been posted, and neither action was taken here or may be taken by an agent.
  The `Resolved when:` clause is met on its second branch — a compliance finding
  naming the lapse exists at
  `agents/evidence/analysis/adr-134-expiry-compliance-finding.md`. That finding
  does not say the action is unnecessary, deferred, implicitly extended, or
  satisfied; it records that the expiry is 2026-09-15, that the action is
  unrouted, and that ADR-134's own text makes a lapse "an open compliance finding
  for the next review cycle, not a silent extension". The substantive question
  stays where it already lived, in the date carrier
  `agents/roadmaps/stubs/road-to-adr-134-expiry.md`, which is not duplicated and
  not superseded. Phases 1 and 2 were independent of this blocker throughout and
  were executed in full.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The dated carve-out grows into the rejected trigger grammar | implementation | Once one trigger shape is machine-decided, the next author adds "reopens when N exceeds M" and then a keyword table, arriving at exactly the grammar two council seats rejected — by increments, each of which looks like the previous one. | 1.1 restricts the parse to a leading date and nothing else; 1.2 puts the rejection and the carve-out in the docstring so the boundary is stated where the next edit happens; 1.1's verify requires a semantic-trigger fixture to stay `indeterminate`. | Phase 1 — A date in a trigger is decidable |
| 2 | The corpus is one ADR, so the mechanism is untested by breadth | implementation | Exactly one ADR in the corpus carries a dated expiry, so a parse that works for its exact phrasing may fail on the second one and fail silently by returning `indeterminate` — the pre-existing state, which no test would flag as a regression. | 1.1's verify pins both directions on the real ADR, and the fixture in 1.2 is a second, deliberately differently-phrased case; a trigger that opens with a date and still reads `indeterminate` is a parse failure and must be reported as one rather than degraded to the old answer. | Phase 1 — A date in a trigger is decidable |
| 3 | The promise read-back becomes a ritual sentence | product | "The previous promise did not ship" costs one line to write and nothing to mean, so the mechanism can produce a compliant head every cycle while the promise is restated forever — which is the failure the reviewer predicted in the phrase "the debt is merely booked". | 2.1 accepts three outcomes and forces one to be chosen, so an unmet promise is recorded as unmet rather than silently reprinted; 2.2 exercises it on the promise already outstanding, where the honest answer is knowable at the time of writing. | Phase 2 — The release promise is read back |
| 4 | Phase 3 is read as authorization to decide the launch | product | A roadmap that names both of the maintainer's options and dates them is one step from an autonomous run picking the cheaper one, which would convert an owner-reserved public commitment into an agent action. | The blocker states the reservation explicitly and 3.1's own text says the roadmap does neither on its own authority; its verify is satisfied by either outcome, including the lapse being recorded, so nothing about it rewards deciding. | Phase 3 — ADR-134's own date is met, not merely watched |

## Acceptance Criteria

- [x] AC-1 — `adr_cite_check` reports `fired` or `not-fired` for a trigger whose condition is a leading date, and `indeterminate` for every trigger that is not.
- [x] AC-2 — The dated carve-out and the 2026-08-19 rejection it does not reach are both stated in the tool's own docstring.
- [x] AC-3 — A fired or near-fired dated trigger is visible in generated output, and deleting the date from its ADR removes the line.
- [x] AC-4 — A release head that neither confirms, denies, nor withdraws the previous head's promise is refused by an existing gate.
- [x] AC-5 — ADR-134 has either a superseding record with a new dated expiry, or a recorded compliance finding naming the lapse — never neither.
- [x] AC-6 — No new gate script, no new hook concern and no trigger grammar beyond the dated form exists in the tree as a result of this roadmap.
