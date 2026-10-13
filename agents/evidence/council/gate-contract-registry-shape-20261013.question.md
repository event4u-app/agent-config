# The per-check contract registry: what shape makes a class field a derivation rather than an assertion?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Do not assume facts not stated here; where you need a fact that
is missing, say so and say what would settle it.

## Background you need

A previous council round (2026-10-10, two seats, convergent) classified 16
repository CI checks that are red on the trunk into four classes:

- **invariant** — must always hold; stays a required gate.
- **snapshot** — a point-in-time reading, refreshable under stated authority.
- **tolerance** — a bounded range with a named party accepting the risk.
- **observation** — informational, never blocking.

Both seats agreed on all 16: **1 snapshot** (`check_gate_completeness`, a count
of 237 against a committed floor of 214), **12 invariants**, **3 unclassified**
abstentions, **zero tolerances, zero observations**.

**Both seats then withheld completion of the step.** Their stated reason: they
refuse to let a check's semantics be derived from its observed failure, because
that grants the classifier discretion exactly when a red trunk creates pressure
to weaken enforcement. They asked for a stable per-check contract first. The
recorded revisit condition is:

> a per-check contract registry exists from which **class, prerequisites, gate
> membership and refresh authority derive mechanically**.

One seat dissented further: the snapshot check "holds TWO objects — the numeric
baseline is a snapshot, the prohibition on unjustified new debt is an invariant,
and one class field cannot carry both". The other dissented that the step
conflates classification with gate membership, which is a separate decision.

## What has been measured since, today

**1. A registry file already exists and was located.** `src/config/gate-coverage.yml`:
113 rows keyed by script stem, each carrying `argv` (the CI-identical
invocation), `min_scanned` (a floor on how many artifacts the gate inspected),
`corpus` (what the count means), `status` (`enforced` | `pending`), and
optionally `ci_invocation` and `canary`. It is CI-enforced today. It states its
own denominator honestly: 113 rows against 354 `check_*`/`lint_*`/`audit_*`
scripts in the tree, i.e. **31.9 % coverage**.

**2. Its coverage of the 16 is much thinner than the roadmap claimed.** Measured
by grep today: **2 of the 16 classified checks have a row**
(`check_gate_completeness`, `check_augment_description_cap`). The roadmap's own
screen claimed all four of the checks the round singled out resolve against the
file; in fact **one of four** does, and the three *unclassified* abstentions —
the first thing the revisit condition names — have **no row at all**.

**3. A candidate derivation rule was tested and refuted, then repaired.**

Hypothesis: *a check that reads a committed baseline is a snapshot; one with no
baseline is an invariant.* Detector: grep for `baseline|ratchet|golden` across
the 16 scripts. Positive control run first — the one known snapshot returns 5
hits, so the detector fires.

Result: 5 of 16 non-zero, giving **four counter-examples**. Reading the hits
rather than counting them removed three as false positives (a golden *corpus*
file; a mutation-selftest failure message; a comment about a different gate).
Exactly **two** of sixteen genuinely read a committed baseline:

- `check_gate_completeness` — a numeric floor that can be **raised**. Snapshot.
- `lint_rule_enforcement_declaration` — a **shrink-only** ratchet over a
  committed file: entries may leave it, never join it. Classified **invariant**.

Repaired predicate: **direction, not presence.**

> A check whose committed baseline can move in the **permissive** direction is a
> governed snapshot. A check with no committed baseline, or whose baseline can
> only move in the **restrictive** direction, is an invariant.

On this corpus it separates 16 of 16. It was repaired *after* seeing its
counter-examples, so that is a fit, not a prediction; it has never been run
against the other 338 scripts.

It also appears to dissolve the "TWO objects" dissent: the two objects are the
baseline's *direction of travel* and the gate's *finding set* — two properties of
the row, each able to have its own field, rather than two meanings competing for
one field.

## The question

**(Q1) Is the repaired predicate an acceptable mechanical derivation for the
`class` field, or does it still smuggle in discretion?** If it is acceptable,
state what must be true of the baseline file's own contract for "direction" to
be read mechanically rather than asserted by whoever adds the row. If it is not
acceptable, say what the remaining discretion is.

**(Q2) Where should the four fields live?** Options as we see them:
(a) extend `src/config/gate-coverage.yml` with the four fields;
(b) a new sibling registry keyed by the same script stem, leaving the coverage
manifest to coverage;
(c) something else you name.
Note that the coverage manifest's purpose is "does this gate inspect anything",
which is a different question from "what does this gate attest", and that
whichever file holds `class` and `refresh_authority` becomes a surface on which
weakening enforcement is authorised.

**(Q3) Can the remaining three fields derive at all?** `prerequisites`,
`gate_membership` and `refresh_authority`. One seat previously said gate
membership is a decision, not a classification. If a field cannot derive, say so
plainly and say what the registry should carry instead of a derived value —
including whether an explicitly-asserted field with a named asserting authority
is acceptable where derivation is impossible.

**(Q4) Does the 31.9 % denominator block this?** The registry covers 113 of 354
scripts, and 14 of the 16 classified checks would need new rows. Is a registry
that classifies a third of the population a usable contract, or does partial
coverage reproduce the vacuous-green failure the coverage manifest itself was
built to stop?

**(Q5) Greenlight.** Does landing the answers to Q1–Q4 close the classification
step, or is it — as with a previous round on an adjacent step — a *predecessor*
that does not close it? Say which, explicitly. Do not treat "this is progress"
as equivalent to "this closes the step".

## Constraints on your answer

- The agent asking this question is the same agent that produced the measurement
  above and would implement the result. Treat the measurement as evidence to
  check, not as a conclusion to ratify. Say if any of it is overclaimed.
- A verdict that the work should not proceed, or that the predicate is wrong, is
  a fully acceptable answer and is preferred over an agreeable one.
- State your confidence, and name the one fact that would most change your
  answer.
