# Completion review — resume request-scoped-rule-load out of `later/`

**Skipped:** no code surface for this completion — one parked roadmap moved into the active tree with a resumption-evidence note, a Risk Register and a status flip, one step closed on the roadmap that owns the note, the regenerated dashboard, and a two-number estate-ratchet entry in `src/config/estate-count-budget.json`; the validator reports 0 code path(s) of 5 changed file(s), scope 8aebc48111a8f52ffdd2edf6cc816a0099bc4d1e38b33cb97be66a9a9541131e, declared 2026-08-19

## Why a skip rather than a review

Every changed path is a roadmap, a generated roadmap view, or a gate baseline in
`src/config/`. No script, hook, test, schema, rule body or skill body changes, so
there is no executable surface for R2 to bind to. `src/config/*.json` is
deliberately outside `CODE_EXTENSIONS`, which is why the gate measures zero code
paths rather than one — verified by the gate's own count line rather than by
reading the extension list.

## What a reviewer would otherwise check, and what was verified instead

The substance of this change is a **claim about the past**, so it was verified by
probing the tree rather than by reasoning about a diff. Each of the four facts
the step requires was established with a command:

- **The resume condition** — read verbatim from the park block:
  *"Resume when P2.1 of `road-to-rule-delivery-integrity` closes"*, restated
  2026-08-08, owner maintainer.
- **The date it was satisfied** — P2.1's own completion marker in the archived
  parent reads `done 2026-08-08`.
- **The artefact that satisfied it** — named by that same marker:
  `agents/evidence/analysis/skill-catalogue-description-delivery.md`.
- **No resumption event followed** — `git log --since=2026-08-08` over the parked
  file returns **zero commits**, i.e. eleven days.

Two adjacent facts were probed because the note asserts them: the parent roadmap
archived 2026-08-09 at `259039157` (`git log --diff-filter=A`), and the
machine-decidable probe reports FIRED on that archival rather than on P2.1
itself — so the written condition and the probe agree while measuring different
events, and the note says which is which rather than blurring them.

## The three gate consequences, none of them incidental

1. **Gate R1 lifted its grandfather exemption.** `lint_plan_risk_register`
   exempts a pre-2026-08-04 plan only until it changes substantially; the
   resumption note is that change. A Risk Register was added covering Phase 4 and
   the resumption itself, not the 35 landed steps. Two of its four rows initially
   carried `Anchored under` values that resolve to no heading (`resumption note
   (park block)`, `Goal · Acceptance criteria`) and the gate rejected both — a
   register can be substantively right and still dangle, and only the gate says so.
2. **The estate ratchet needed a raise, and the exempt field did not cover it.**
   `estate_offset_exempt` satisfies the diff-scoped one-in-one-out half only; the
   raw COUNT half is diff-blind and reported `active_roadmaps 33 → 34` regardless.
   The legal discharge is a baseline raise landing exactly on the measurement with
   a `baseline_history` entry naming the metric — plus the `later_roadmaps 50 → 49`
   walk-down, which the gate demands separately and which is what makes the net
   estate zero. `open_blockers` unchanged at 71 is the invariant that proves the
   move was a disposition change and not growth.
3. **`lint_roadmap_family_cap` was checked rather than assumed.** The done-note on
   step 1.1 claims the file is a `road-to-request-*` singleton; measured 1 of 1,
   gate green at 1/2 slots.

## Residual risk this change knowingly leaves

- **The raise is not underwritten by future work.** Every prior raise in that
  history is redeemed by a measurement or a closure; this one walks down only when
  Phase 4 terminates, and Phase 4 is council-parked with a maintainer owner. The
  entry says so rather than implying a return path it does not have.
- **Resumption can be misread as promotion.** Rank 1 of the new Risk Register, and
  the reason both Phase 4 steps stay `[ ]` and the heading still reads PARKED. The
  mitigation is prose, so it is model-carried: nothing mechanically stops the next
  session from executing a parked phase.
- **The dashboard on the trunk was stale before this change** (277/523 committed
  against 280/523 live, pre-existing drift), so the header delta in this PR is
  larger than the resumption alone accounts for. Named here so a reader does not
  attribute the whole jump to the un-park.

## What this change did NOT do, deliberately

It does not touch the five other open steps of `road-to-standing-context-40k`.
Each carries a dated non-executable verdict, and two were re-probed today rather
than taken from the file: no `norm`-pinning script exists under `src/scripts/`
(2.1 and 2.2 sequencing genuinely unmet), and `InstructionsLoaded` appears zero
times in `dispatch_hook.ts` (3.0's premise refuted). Step 0.1 names colleague
hardware and a per-machine settings write, which is a Hard-Floor halt.
