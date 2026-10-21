<!-- evidence-type: analysis -->

# A drafted truth table for what blocks, and a rollback policy beside it

Drafted 2026-10-21 from `origin/main` @ `a2aa408ab`, for step 7.1 of
`road-to-authority-routing-mechanism`. D24 (council, 2026-10-19) ordered this
before any classification schema: first an aggregation truth table, then
rollback and activation boundaries, then fixtures. This file is the draft the
next round is asked to judge. **It decides nothing.** The two cells D24 left
open carry a proposal and an alternative each, and the proposal is the asking
agent's, not a verdict.

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
