<!-- evidence-type: analysis -->

# Revision 2 has one closure blocker: a fifth value in the class column

AI council, 2026-10-24, the eighth round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-classification-ledger-r2-20261024.question.md`. It
asked whether revision 2 of the ledger applied the five corrections D31 required.

## Verdict: convergent — not closed, and exactly one blocker

Both seats answer Q3 *no* and name the same single missing item:

- anthropic: *"a taxonomy-compliant classification for row 16's store-absent
  behavior."*
- openai: *"a four-category classification for row 16's absent-store
  behavior."*

Both say this repair **does not need the owner-reserved second principal**.
Classifying the current behaviour is within existing authority. Only the
bootstrap deadline is a council value. openai rejects the permissive reading
that row 16's other classified aspects already satisfy the criterion: *"too
formalistic for a governance verdict intended to drive 7.2 enforcement
changes."*

## Q1 — the five corrections

Corrections 1 (row 1 is an invariant), 2 (row 10 split), 3 (row 11 named) and
5 (rows 9 and 12 scope) are accepted, with refinements. Correction 4 is rejected
as incomplete: row 16 separates the outcomes, but *store absent* carried
`evaluation state`, which is not one of the four classes.

## Q2 — further corrections both seats ask for, applied in revision 3

1. Remove the stale reference to "the one snapshot". It contradicted
   `snapshot 0`.
2. Give *store absent* a class. `not-evaluated: evidence-missing` stays as
   runtime metadata. Keep current behaviour apart from a post-deadline
   transition.
3. Define the scope of rows 9 and 12 operationally. That means the file
   enumeration, index versus working tree, staged deletions, renames and
   partially staged files. anthropic's hardest pushback is that the ledger
   classified the check it wanted rather than the one that runs. The fix is to
   classify the current implementation and keep the target separate.
4. Row 5 claims *age ≤ 90* while future dates pass. State the property as
   computed, or reject future dates.
5. Enumerate row 11's *other error-severity rules*.

Raised and carried to 7.2, not 7.1:

- the C3 live-URL check is a server-side request trust boundary in CI;
- C5 depends on git history depth;
- `dist/` checks trust the build;
- clock checks trust the runner;
- classification is really a property of
  `(property, input scope, invocation mode, runtime state, consumer)` (openai's
  hardest pushback).

## Q4 — 7.2's first item, convergent

**The invocation-mode and consumer inventory.** For each caller it records:

- the exact command and flags;
- the environment;
- whether warnings or exit codes block;
- the downstream consumers;
- missing- and malformed-evidence behaviour;
- the current rollback path.

It is read-only and needs no reserved authority. The row 9 and 12 scope fix may
run in parallel, but no enforcement decision relies on those rows until it is
verified. Before any demotion there is a kill switch restoring prior blocking
behaviour, a named operator, measurable rollback triggers, and prior baselines
and evidence preserved.
