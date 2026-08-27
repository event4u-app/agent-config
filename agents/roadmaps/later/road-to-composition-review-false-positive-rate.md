---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
parent_roadmap: road-to-composition-before-creation
relates:
  - slug: road-to-composition-before-creation
    relation: extends
# relates: created in the same change that closed
# road-to-composition-before-creation, carrying its step 4.2 forward. That step
# needs elapsed time, not effort — one release of advisory operation — so it
# could not be executed inside the parent and is carried rather than dropped
# (roadmap-progress-sync Iron Law 3, preservation test: a carried follow-up
# created in the SAME change is the council-decidable disposition).
estate_growth_exempt: "later_roadmaps 66 -> 67. This change parks one roadmap that a 2/2 convergent council found unexecutable today: its AC-1 requires a population greater than zero and the measured population is 0, because the gate it measures landed two commits before HEAD. Parking is the disposition the later/ contract names for an elapsed-time gate; the alternative that would keep the bucket flat is leaving an unadvanceable roadmap on the active dashboard, which is the state later/ exists to remove. Active roadmaps fall 5 -> 4 in the same change, so the total estate does not grow."
estate_offset_exempt: "consumed at creation (7cb1d1ddf): +1 active, parent archived in the same change, net zero. Parking this file in later/ is a further -1 on the active count with no offsetting event; it lowers the floor and never raises it."
---
# Road to a false-positive rate for the authoring-search record

> **Blocked until at least one release has shipped with
> `lint_composition_review` running advisory**, so that the population of
> additions-without-a-record is non-empty. Ready rather than draft: the
> dashboard should surface it, and execution waits on elapsed time rather than
> on a decision.

## Context

Carries step 4.2 of `agents/roadmaps/archive/road-to-composition-before-creation.md`,
which closed on 2026-08-27. That step is reproduced verbatim below with its
original phase context, so the plan survives the migration:

> **4.2 Measure the false-positive rate before proposing a block.** Run advisory
> for one release and record how often the finding was wrong.
> *verify: the rate is a number in `agents/evidence/analysis/`, and no blocking
> flip is proposed in this roadmap. A measurement is not a gate.*
>
> — Phase 4, "Advisory first, and only then a gate"

The parent's second half is already discharged there — no blocking flip is
proposed anywhere in it, and the advisory half exits 0 by construction, asserted
by a spec. What carries is the measurement.

## Goal

`lint_composition_review` ships advisory: it reports an artefact added without a
`composition_review` record and exits 0. This roadmap produces the one number
that decides whether that half may ever become a block — how often the report was
**wrong** — and produces it from real additions rather than from a fixture.

## Why this is a separate roadmap and not a deferred step

`road-to-composition-before-creation` step 4.2 asks for a rate "from at least one
release of advisory operation". That is a **time** requirement, not an effort one:
on the day the parent closed there were zero additions in the population to
measure, so the step was unexecutable rather than unfinished. Its parent's AC-5
is already satisfied — no blocking flip is proposed anywhere in it — so what
carries forward is the measurement, not an unmet acceptance criterion.

## What counts as a false positive

Stated before the measurement so the number cannot be defined after the fact:

- **True positive** — the artefact was added, carried no record, and a reviewer
  agrees a record was owed: an incumbent existed and was searchable.
- **False positive** — the artefact was added, carried no record, and a record
  was **not** owed. Two known shapes: an artefact split out of an existing one
  where the split itself is the record (the parent's own row 6,
  `storybook-workshop`, is this shape), and a generated or projected artefact
  whose author is a script.
- **Not counted either way** — an addition whose record is present but
  malformed. That is the gate's hard half and is a different finding.

## Measurement Baseline — recorded 2026-08-27, before parking

The population was measured in a clean worktree at `origin/main` = `830e31aa3`
so that the resume does not have to re-derive the starting point:

- **Base ref:** `7cb1d1ddf` — the commit that added
  `src/scripts/lint_composition_review.ts`, timestamped 2026-08-27 21:16:30 +0200.
- **Command:** `./scripts-run src/scripts/lint_composition_review --base-ref 7cb1d1ddf`
- **Result:** `419 artifact(s) — records well-formed; 0 addition(s) without one (advisory).`
- **Population:** **0**.

The advisory half derives its added-artefact set from
`git diff --name-only --diff-filter=A <base>...HEAD`
(`src/scripts/lint_composition_review.ts:410`), and only two commits sit in that
range, neither adding a skill, rule, command or guideline. Step 1.1's verify
clause and AC-1 both require a count **greater than zero**, so the roadmap is
**unexecutable today rather than unfinished** — the shortfall is elapsed time,
not effort.

### Council decision — 2026-08-27, park in `later/`

Convened on the disposition (members: anthropic, openai; both present; actual
cost $0.0352). **Convergent 2/2 on parking in `agents/roadmaps/later/`.**

Options put: (a) park in `later/`; (b) re-scope AC-1 to a retroactive population
using a much earlier base ref; (c) add a `## Blockers` entry and leave the
roadmap active at 0/8; (d) name another.

Rationale recorded: (b) was refused because a retroactive population predates the
record entirely, so every row is an addition-without-a-record by construction —
it would measure the *absence of the mechanism*, not the *wrongness of a
finding*, which is precisely the failure Risk #1 and Risk #2 in this file were
written to prevent. (c) was refused because an active roadmap no run can advance
is the exact state `later/` exists to remove. The council additionally required
that this baseline section be written **before** the move, so the file is
self-contained on resume; that requirement is discharged above.

**Estate effect:** −1 on the active-roadmap count. The `+1 / -1` offset this file
declared was consumed at creation in `7cb1d1ddf`, where the parent archived in
the same change; this move carries no offsetting parent event.

**Revisit-if:** a release has shipped carrying `lint_composition_review` in
advisory mode **and** the post-`7cb1d1ddf` range produces more than zero in-scope
additions without a `composition_review` record. No fixed artefact threshold is
set — Step 1.1's floor is "greater than zero", and the measurement itself decides
whether the number is actionable.

## Phase 1 — Collect

- [ ] **1.1 List every skill and rule added since `lint_composition_review`
      landed.** The gate's own advisory output over the release range is the
      population; a hand-assembled list is not.
      verify: the count is stated with the command that produced it and the two
      commit ends of the range, and it is greater than zero — a rate over an
      empty population is not a rate and closes nothing.
- [ ] **1.2 Adjudicate each one against the definitions above.** Per artefact:
      true positive, false positive, or not-counted, with one sentence.
      verify: every row carries a verdict and a reason; the not-counted rows are
      listed rather than silently dropped.

## Phase 2 — Report, and stop

- [ ] **2.1 Write the rate to `agents/evidence/analysis/`.** The number, the
      population size, the range, and the adjudication table.
      verify: the artefact carries `<!-- evidence-type: analysis -->` and states
      the rate as a fraction with its denominator, never as a bare percentage.
- [ ] **2.2 State what the rate implies — and propose no flip here either.**
      A rate is an input to a decision about enforcement, not the decision. If it
      is low, say what a flip would then need (a council round, a canary proving
      the blocking path, a migration note); if it is high, say which
      false-positive shape dominates and whether the gate can exclude it.
      verify: the roadmap contains no change to the gate's exit behaviour, and
      the recommendation names its next decision venue rather than acting as one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The rate is computed over an empty or near-empty population and reported as if it meant something | product | If few artefacts are added in the window, a 0/1 or 0/2 rate reads as "no false positives" when it is really "no evidence". This is the honest-null shape this tree has recorded before. | 1.1's verify requires the population to be greater than zero and the denominator to be published with the rate; 2.1 forbids a bare percentage, so a reader always sees the denominator | Phase 1 — Collect |
| 2 | The false-positive definition is written after the numbers are known | product | Whoever adjudicates has an interest in the mechanism they just built looking correct, and "was a record owed?" is exactly the judgement that can absorb that pressure. | The definition and its two known false-positive shapes are written in this file before any collection, and the parent's own row 6 is named as an instance so the definition is anchored to a real artefact rather than to a hypothetical | What counts as a false positive |
| 3 | The rate becomes an argument for a block without a separate decision | implementation | A low number reads as permission. The parent roadmap's whole sequencing is advisory-first precisely so that enforcement is a separate, argued step. | 2.2's verify requires that this roadmap change no exit behaviour and that the recommendation name a decision venue rather than act as one | Phase 2 — Report, and stop |

## Acceptance Criteria

- [ ] AC-1 — The population is enumerated by the gate's own output over a stated
      commit range, with a count greater than zero and the command that produced
      it.
- [ ] AC-2 — Every artefact in the population carries a true-positive /
      false-positive / not-counted verdict and a one-sentence reason.
- [ ] AC-3 — The rate is published in `agents/evidence/analysis/` as a fraction
      with its denominator, in an artefact declaring `evidence-type: analysis`.
- [ ] AC-4 — No change to `lint_composition_review`'s exit behaviour is made or
      proposed in this roadmap; the recommendation names its next decision venue.
