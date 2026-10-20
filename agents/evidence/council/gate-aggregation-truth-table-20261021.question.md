<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-21, committed verbatim so the
     verdict beside it can be checked against what was actually asked. It
     tells the seats the asking agent drafted the table and would implement
     the result. -->

# Step 7.1: is this aggregation truth table and rollback policy sound enough to draft a report-only schema against?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Do not assume facts not stated here; where a fact is missing,
say so and say what would settle it. The agent asking you drafted the table
below and would also write the schema that follows from it, so treat its
framing and its proposals with suspicion and say where they overreach.

## Background

Three earlier council rounds (the same two providers as this one) govern this
step. Round 1 (2026-10-10) classified 16 CI checks red on the trunk into four
classes (invariant, snapshot, tolerance, observation) and withheld completion
until a per-check contract registry exists. Round 2 (2026-10-13) put that
registry in a separate `gate-classification.yml` and withheld again. Round 3
(2026-10-19) chose aspect-level rows (one row per check and aspect, one class
per aspect, no fifth class), ruled that missing evidence is an evaluation state
reported by a run and never a registry field, that a freshness window is an
invariant with a time qualifier, and retired "derive mechanically" in favour of
three field categories: computed, governed assertion, observed. It refused to
let a schema be written yet and ordered:

1. an aggregation truth table, with two cells left undecided (snapshot below
   baseline, snapshot unavailable);
2. rollback and activation boundaries;
3. three executable fixtures;
4. a versioned report-only schema draft;
5. all 16 registered, schema revised from what that shows;
6. report-only consistency checks;
7. a separate approval before any class changes enforcement.

Another standing finding (2026-10-13, a different round): treating absent,
unverifiable or malformed evidence as a pass is disqualifying regardless of
rate, and so is any fail-open path in an authorisation-critical verifier.

Separately, the roadmap's Phases 2 and 3 (an authority vocabulary and a
protected verifier) are blocked on an owner-reserved forge setting: no second
principal is required to approve changes to the governance surface. How an
asserted class gets authenticated approval is tied to that blocker. This round
is not asked to resolve it.

## The draft under review (items 1 and 2), verbatim

## What the existing code already does — read before the table

The table is drafted against behaviour that exists, so the current behaviour
was read first. Three facts shaped it.

1. **The ratchet already has five states.** `checkRatchet` in
   `src/scripts/_lib/gate_baseline.ts` returns `unbaselined`, `regressed`,
   `improved`, `stale` and `within`. Only `regressed` and `stale` fail.
   `improved` (fewer violations than the recorded baseline) **passes today**,
   with a message to lower the baseline. `stale` means the baseline has not
   moved or been reaffirmed for more than `STALE_AFTER_DAYS` (56).
2. **"Baseline unavailable" has two different behaviours today.** Read against a
   named target ref, a missing or unresolvable baseline throws
   `BaselineResolutionError`, which is a hard error. Read from the working tree,
   a missing baseline file returns an empty ratchet, so the gate passes only at
   zero violations. The working-tree path therefore fails closed in effect, but
   it cannot tell "no baseline file" from "no baseline needed".
3. **An exit code cannot carry an aspect result.** `check_composite_arming`
   exits `1` both when it finds a property violated and when its evidence store
   does not exist ("not measured yet"). `check_trigger_evals` exits `1` for a
   stale stamp and for an invalid trigger set alike. Both use `2` for a usage
   error. A validator that reads exit codes cannot tell missing evidence from a
   failure, so whatever runs the table needs structured per-aspect output, not
   exit codes.

## The vocabulary the table uses

Following D24: one row per (check, aspect), one class per aspect, and the
class is a governed assertion. A run then reports one **result** per aspect.
The results are observed state and never stored in the registry.

| Result | Meaning |
|---|---|
| `pass` | the aspect's property was evaluated and holds |
| `fail` | it was evaluated and does not hold |
| `evidence-missing` | the evidence the aspect requires is absent, so it was not evaluated |
| `expired` | a time-qualified aspect whose window has run out (a `fail` caused by the clock alone) |
| `error` | the evaluation itself broke: crash, timeout, unparseable input |
| `prerequisite-unavailable` | a declared dependency could not be produced (for example a projection not built) |
| `excepted` | a recorded, unexpired temporary exception covers a `fail` |

## The table

"Blocks" means: once the registry is authoritative, this aspect result makes
the check's required gate fail. In report-only mode nothing in this table
changes any existing gate's exit code (see § Rollback and activation).

| Class | `pass` | `fail` | `evidence-missing` | `expired` | `error` | `prerequisite-unavailable` | `excepted` |
|---|---|---|---|---|---|---|---|
| invariant | no | **blocks** | **blocks** | **blocks** | **blocks** | **blocks**, reported as its own reason | no, only while the exception record is valid and unexpired; an invalid or expired record blocks |
| snapshot | no (`within`) | **blocks** (`regressed`) | see cell B | **blocks** (`stale` baseline) | **blocks** | **blocks** | same as invariant |
| tolerance | no (inside the bound) | **blocks** (outside) | **blocks** | **blocks** (risk acceptance expired) | **blocks** | **blocks** | not applicable: a tolerance is already an accepted risk, and a second exception on it is refused |
| observation | no | no | no | no | no, reported | no, reported | not applicable |

Rationale for the uniform columns, stated once:

- `evidence-missing` blocks for every enforcing class because D18 lists
  "treating absent, unverifiable or malformed evidence as a pass" as
  disqualifying regardless of rate. A required aspect with no evidence is
  not a pass.
- `error` blocks for every enforcing class because a validator crash that
  passes is a fail-open path, which D18 also lists.
- Zero tolerances and zero observations exist in the population today (D14).
  Their rows are drafted so the table is complete, not because a check needs
  them now.

## The two undecided cells

### Cell A — snapshot below baseline (`improved`)

Fewer violations than the recorded baseline. Today this passes with a warning.

- **Proposal: does not block; it produces a mandatory `tighten` finding** that
  the report lists and that cannot be suppressed. Reason: blocking on an
  improvement would make every fix a two-step change (fix, then lower the
  number), and a red caused by doing the right thing trains people to stop
  fixing.
- **Alternative: blocks until the baseline is lowered in the same change.**
  Reason: an unlowered baseline lets the gain be given back silently later,
  which is exactly what the ratchet's own message warns about. Under this
  alternative a fix and its baseline update always travel together.
- **What would decide it:** whether a lowering may be made by the agent that
  made the fix. If yes, the alternative costs one extra line per fix. If
  lowering is a governed assertion (D24 makes `refresh_authority` one),
  blocking would route every improvement through that authority, and the
  proposal is cheaper.

### Cell B — snapshot unavailable (`evidence-missing` on a snapshot aspect)

The baseline the snapshot compares against cannot be read: missing file, bad
JSON, unresolvable target ref.

- **Proposal: blocks once authoritative; in report-only mode reported as
  `error` and never blocking.** Reason: without a baseline, a snapshot has no
  referent, and passing it would let an infrastructure fault decide policy,
  which is the reasoning `BaselineResolutionError` already gives.
- **Alternative: falls back to invariant semantics** (passes only at zero
  violations), which is what the working-tree path does today.
- **Why the proposal departs from the working-tree behaviour:** the fallback
  conflates "no baseline file" with "no baseline needed", and a deleted
  baseline file then reads as a demand to reach zero rather than as a broken
  input. The two are different findings and should be reported differently,
  even though both block.

## Aggregation: where it runs and how aspects combine

- **Combination:** a check's required gate fails if **any** enforcing aspect
  blocks. Observation aspects never contribute. There is no majority and no
  weighting.
- **Unknown aspects:** a result for an aspect the registry does not list, or a
  registered aspect with no result, is reported in report-only mode. Once
  authoritative, a registered aspect with no result is `evidence-missing` and
  blocks; an unregistered aspect is a registry/CI mismatch and blocks.
- **Where:** a central validator, not inside each check. If each check combined
  its own aspects, the check's author would decide its blocking behaviour,
  which is the discretion D14 refused. The validator reads structured
  per-aspect output; per fact 3 above, exit codes are not enough.

## Rollback and activation boundaries

The first kill switch disables **only the new validator**. Existing CI gates
keep running exactly as they do today, in every mode.

| Failure | Report-only mode | Authoritative mode |
|---|---|---|
| unsupported schema version | validator reports and exits 0 | validator blocks every check it governs until a supported version is restored |
| a registered check disappears or is renamed | reported | blocks until the registry row is updated through the governed path |
| an unregistered check appears in CI | reported | reported, not blocking: an unregistered check keeps its existing CI behaviour |
| unknown aspect in a result | reported | blocks (registry/CI mismatch) |
| CI config and registry disagree on `effective_gate` vs `required_gate` | reported | blocks |
| bad provenance on an assertion (missing `asserted_by`, missing approval) | reported | the assertion is ignored and the check keeps its previous enforced class; the mismatch blocks |
| validator crash or timeout | reported as a validator failure, existing gates unaffected | blocks; never read as a pass |
| emergency suspension | not needed | allowed, logged, time-boxed, with expiry; the authority to suspend is held separately from the authority to reactivate (D19) |

Fail-open is acceptable only in report-only mode, where the validator decides
nothing. It is not the default once the registry is authoritative, and each
failure type keeps its own policy rather than one global switch.

## Worked against the three fixtures D24 named

These are readings, not classifications. Assigning a class is a governed
assertion this file does not make.

- **`check_gate_completeness`** has three aspects in its code: the ratchet on
  un-adopted gates (snapshot candidate), malformed exemption markers (invariant
  candidate, exits 1 before the ratchet runs), and a dead scan scope via
  `assertScanned` (invariant candidate). Under the table, today's
  `240 > 214` is `fail` on the snapshot aspect and blocks; the other two pass.
  This is the TWO-objects case resolved as rows, as D24 chose.
- **`check_composite_arming`** with no store is `evidence-missing`. If its
  aspect is asserted an invariant it blocks; if an observation it does not.
  The class is one of D14's abstentions and stays unasserted here. What the
  table does settle is that the result is reported as `evidence-missing`, not
  as `fail`, which the current exit code cannot express.
- **`check_trigger_evals`** has a freshness aspect (invariant with a time
  qualifier: local calendar date, 90-day window, no grace) and a validity
  aspect (invariant). Today's 51 old stamps are `expired` on the freshness
  aspect and block. A malformed trigger set is `fail` on the validity aspect.
  The same exit code covers both today.

## Limits

- This drafts the table against three fixtures and the ratchet helper. It was
  not run against all sixteen checks, which D24 orders after the schema draft.
- The `excepted` column assumes an exception record format that does not exist
  yet. The table says how an exception behaves, not what one looks like.
- How approval of an assertion is authenticated stays tied to the open blocker
  `external-bootstrap-boundary-for-phases-2-3`, which is owner-reserved. This
  file does not route around it.

## Questions

**Q1 — The table.** Are the uniform columns right (in particular:
`evidence-missing` and `error` block for every enforcing class)? Is any row or
column missing, wrong, or self-contradictory? Is "any enforcing aspect blocks"
the right combination rule?

**Q2 — Cell A (snapshot below baseline).** Proposal, alternative, or something
else? Answer the deciding question the draft names: may the agent that made a
fix also lower the baseline, or is lowering a governed assertion?

**Q3 — Cell B (snapshot unavailable).** Proposal (block once authoritative,
report as `error` in report-only), the existing fallback (invariant semantics),
or something else?

**Q4 — Rollback and activation.** Is the table complete? Is any policy wrong,
especially "an unregistered check keeps its existing CI behaviour" and "bad
provenance means the assertion is ignored and the previous enforced class
stays"?

**Q5 — Next item.** Given your answers, may round 3's item 3 (three executable
fixtures) and item 4 (a versioned report-only schema draft, enforcing nothing)
proceed, or is something else owed first? Name it.

Answer each question with a recommendation, the strongest objection to it, and
your confidence.
