<!-- evidence-type: analysis -->

# Independent verdict — the pin tests removed in stage 2 (2026-10-16)

`check_test_weakening` reports `tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts`
as asserting less than on main (11 assertions net-removed). This records the
independent verdict that covers that removal; the implementer is not the arbiter.

## What was removed, and why it could not stay

The removed assertions tested `PENDING_MECHANISM_PINS`, `gitBlobId` and
`pinViolations` — the blob pin that bound `src/scripts/_lib/ratification_subject.ts`
while it was not gated. Stage 2 gates the module and deletes that machinery, so
the assertions tested code that no longer exists:

- "every pending module is pinned to its current blob";
- "the committed trunk satisfies its own pins";
- "refuses a diff that moves a pinned module off its pin, and passes it unchanged";
- "a tree that never had a pinned module is not a deletion";
- the `PENDING` exception in "every module the gate imports is gated and digested".

## What replaces the protection they asserted

The property the pin provided — the calculator cannot change without review,
whatever file list a caller passes — is now asserted through the gate:

- every module of the gate's import closure is gated and digested, with no
  exception list (the module is in `IMPORTED`);
- an unratified edit of the calculator is refused by `evaluate` end to end;
- through `main()`: refused with no `--files`, with a `--files` list that omits
  it, and with an unresolvable base (exit 3).

Sensitivity, measured: removing the module from `MECHANISM_IMPORT_PATHS` turns
four closure tests and the CLI test red; replacing the list-plus-range union with
the list alone turns the omitted-list case red. Both restored.

## Who decided

The AI council (anthropic/claude-sonnet-4-5, openai/codex-default), four rounds,
each shown the complete diff of the test file including the removals — prompts
committed under `agents/evidence/council/gate-the-subject-calculator-stage-2-review*-20261016.question.md`.
Round 1 both seats requested changes precisely because the pin's
omission-independent protection was being removed; rounds 2 and 3 drove the
replacement assertions above; round 4 approved 2 of 2. Record:
`agents/evidence/ratifications/gate-the-subject-calculator-stage-2.md`.

The seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed.
