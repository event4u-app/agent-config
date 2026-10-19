<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-19, committed verbatim so the
     verdict beside it can be checked against what was actually asked. It
     tells the seats the asking agent would implement the result. -->

# The classification registry schema: which taxonomy shape, and does an asserted field count as "derived mechanically"?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Do not assume facts not stated here; where you need a fact that
is missing, say so and say what would settle it. The agent asking you would
also write the schema you choose, so treat its framing with suspicion and say
where it overreaches.

## Background

Two earlier council rounds (same two providers as this one) govern this step.

**Round 1 (2026-10-10)** classified 16 repository CI checks that were red on
the trunk into four classes — invariant (must always hold), snapshot (a
point-in-time reading, refreshable under stated authority), tolerance (a bounded
range with a named party accepting the risk), observation (informational, never
blocking). Result: 1 snapshot, 12 invariants, 3 abstentions, zero tolerances,
zero observations. Both seats then **withheld completion**: they refuse to let a
check's semantics be read off its observed behaviour, and asked for a per-check
contract registry "from which class, prerequisites, gate membership and refresh
authority derive mechanically". One seat dissented that the snapshot check holds
TWO objects — a numeric baseline (snapshot) and a prohibition on unjustified new
debt (invariant) — and one class field cannot carry both.

**Round 2 (2026-10-13)** decided the registry's location and withheld completion
again. Its rulings: the four fields live in a separate `gate-classification.yml`,
not in the existing coverage registry, so a coverage-floor bump never travels the
same approval surface as a class change. `gate_membership` and
`refresh_authority` cannot be derived; they are decisions. An explicitly asserted
field carrying `asserted_by`, `asserted_on`, `reasoning`, `reviewed_by` is
acceptable **if** "mechanical" means *rule-following with recorded inputs* rather
than *computation with zero human input* — and the round flagged that reading as
**unconfirmed**, to be put to the seats directly. It also ruled the TWO-objects
dissent a **taxonomy** problem, not a schema one, with three live options:
(1) a multi-valued class, (2) aspect-level rows, (3) splitting the check. And it
set an order: schema, then baseline contracts, then all 16 registered, then
rollback criteria, and only then may a class change any enforcement. Gate
membership splits into `effective_gate` (derivable from CI config) and
`required_gate` (a decision), with any mismatch to be caught by CI.

## What is new since round 2 (re-measured 2026-10-17, one run per check)

- 9 of the 16 are green now, 7 stay red. Two of the three abstentions went green;
  a pass says nothing about meaning, so that resolves neither.
- `check_composite_arming` reports that **evidence is missing** ("not measured
  yet, which is NOT the same as armable"), not that a property holds or is
  violated. None of the four classes is a statement about absent evidence.
- `check_trigger_evals` (90-day staleness window) and in part
  `lint_eval_freshness` change verdict **as the calendar moves**, with no tree
  change. A freshness window is an invariant ("every item is fresh") evaluated
  against a moving bound. The four classes have no slot for "becomes false with
  time".
- `check_gate_completeness` grew from 237 to 240 against a floor of 214.

Nothing on round 2's still-required list has landed. No schema exists.

## Questions

**Q1 — Taxonomy shape.** Which of the three options should the schema adopt:
(1) multi-valued `class: [snapshot, invariant]` on one row per check,
(2) aspect-level rows — one row per (check, aspect), each aspect single-valued,
with the check's blocking behaviour derived from its aspects,
(3) split every two-object check into two scripts. Or a fourth shape. Say what
each option loses. Say whether the four-class taxonomy itself needs a new
member (for example an evidence-presence class for the arming check, or a
time-bounded qualifier for freshness windows), or whether those cases fit an
existing class once aspects are separated.

**Q2 — "Derive mechanically".** Round 1 set the condition. Does a field whose
value is asserted by a named party, with recorded reasoning and a reviewer
distinct from the asserter, satisfy "derive mechanically" as you intended it?
If not, what minimum would — given round 2's finding that two of the four fields
are decisions by nature?

**Q3 — Is this enough to write the schema now?** If your answers to Q1 and Q2
converge, may the schema (field list, allowed values, aspect structure,
provenance fields, the effective/required split) be committed as round 2's first
ordered item — with no entries that change any gate's enforcement — or is
something else owed first? Name it.

Answer each question with a recommendation, the strongest objection to it, and
your confidence.
