<!-- evidence-type: analysis -->

# The schema waits on the rule that decides what blocks

AI council, 2026-10-19. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds with blind peer review, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`gate-classification-taxonomy-20261019.question.md`.

Asked for step 7.1 of `road-to-authority-routing-mechanism`. This round puts
the two questions D22 left open to the seats directly: the TWO-objects
taxonomy shape, and what "derive mechanically" meant. It did not re-classify
any check.

## Verdict: convergent on Q1 and Q2, and the schema is NOT written yet

Both seats answered Q3 with no. Their reasons differ in strength but point the
same way:

- openai: *"I would not greenlight this as an authoritative schema yet. I would
  approve a versioned, report-only prototype."* Its final line: *"Approve a
  non-authoritative prototype only. Withhold architectural completion until
  identity, aggregation, authenticated governance, versioning, runtime-state
  separation, and rollback semantics are specified and exercised against all
  16 checks."*
- anthropic went further: *"Approve only semantic definitions and provenance
  requirements. Withhold approval of schema structure until aggregation rule +
  rollback policy + representative fixtures exist."*

The stricter reading is taken. A report-only prototype that anthropic would not
approve is not a convergent clearance, so no schema file lands in this change.

## Q1: aspect-level rows, and no fifth class (convergent, both high confidence)

One row per (check, aspect), with exactly one class per aspect. What the other
options lose:

| Option | Loses |
|---|---|
| Multi-valued `class` | Per-aspect provenance, refresh authority and result attribution. It also leaves open which class decides blocking. |
| Aspect rows | Nothing semantic. The cost is identity and aggregation complexity, and that has to be solved explicitly. |
| Split scripts | It ties governance meaning to how CI packages jobs, and it multiplies the jobs. |
| A fifth "evidence" class | It mixes what is required with whether it can be checked right now. |

The two cases the 2026-10-17 re-measure raised both fit the four classes once
three dimensions are kept apart:

- **Missing evidence is an evaluation state, not a class.** The registry records
  what evidence an aspect requires. A run reports whether it was there. Storing
  `evidence_state: absent` in the registry would put runtime output on a
  governed approval surface. anthropic called that *"a category error"*.
- **A freshness window is an invariant with a time qualifier.** The qualifier
  names the clock source, the window and the grace period. "Becomes false with
  time" is evaluation policy, not a fifth meaning.

The strongest objection, from openai: aspect rows may be more machinery than 16
checks justify. It wins only if fixtures show every composite check has the
same provenance, authority and evaluation behaviour across its aspects.

## Q2: retire "derive mechanically" (convergent, both high confidence)

Both seats rejected the reading round 2 had offered, that a field asserted with
provenance counts as mechanically derived. openai: *"A human assertion with
provenance is not mechanically derived. It is a governed decision that can
subsequently be consumed mechanically."* anthropic: *"the question is
malformed."*

Use three categories instead:

- **Computed:** deterministic output from declared inputs (`effective_gate`,
  parsed from CI config, never stored as authoritative data).
- **Governed assertion:** an authenticated human decision with rationale and
  approval (`required_gate`, `refresh_authority`, class).
- **Observed:** runtime state from CI, evidence or the clock (pass, fail,
  unknown, error, stale).

Provenance fields are necessary and not sufficient. `reviewed_by` differing
from `asserted_by` as text does not establish separation of duties. Approval
has to be enforced by repository controls, and an assertion needs cited
criteria plus expiry and supersession rules. That ties the registry's approval
path to the open blocker `external-bootstrap-boundary-for-phases-2-3`. The
seats did not say so; this record notes the connection and does not count it as
their finding.

## Q3: what is owed before the schema, in order

Both seats rejected round 2's order (schema → contracts → register all 16 →
rollback). Rollback and aggregation decide which fields the schema needs, so
they cannot come last. anthropic: *"the structure/content split is false."* The
merged sequence:

1. **Aggregation truth table.** For each (aspect class, aspect result), say
   whether the check blocks. Cover invariant failure, snapshot drift, missing or
   stale evidence, evaluation errors, mixed aspect outcomes, unavailable
   prerequisites and temporary exceptions. Say where aggregation runs (in the
   check, a central validator or a CI adapter). Two cells are undecided:
   *snapshot below baseline* and *snapshot unavailable*.
2. **Rollback and activation boundaries.** Cover an unsupported schema version, a
   disappeared or changed check, unregistered checks and unknown aspects, a
   CI/registry mismatch, bad provenance, a validator crash or timeout, and
   emergency suspension (who, how long, audit, expiry). The first kill switch
   turns off only the new validator and leaves existing CI gates alone. Fail-open
   suits report-only mode. It must not become the default once the registry is
   authoritative. Each failure type gets its own policy.
3. **Three executable fixtures:** the snapshot/invariant composite
   (`check_gate_completeness`), missing evidence (`check_composite_arming`), and
   the expired freshness window (`check_trigger_evals`).
4. **A versioned, report-only schema draft** exercised against those fixtures.
   It needs stable `check_id` + `aspect_id`, a semantic-change policy and a
   schema version.
5. **All 16 registered, and the schema revised from what that shows.**
   Registration validates the schema. It is not a later task that cannot change
   it.
6. Registry/CI consistency checks in report-only mode, then exercises of
   mismatch, failure, rollback and kill switch.
7. **Separate approval** before any class changes enforcement.

## What this round did NOT decide

- The two undecided truth-table cells. They are decisions, so they go to the
  next round with a drafted table rather than being filled in here.
- Whether `prerequisites` is a check-ID graph, a prose note or something else.
  Round 2 already called it underspecified, and it still is.
- How approval is authenticated while the repository has no qualified second
  principal. That is the open blocker named above, which is owner-reserved.
