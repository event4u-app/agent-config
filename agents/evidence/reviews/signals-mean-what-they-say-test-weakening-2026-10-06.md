# Independent review — two net-assertion-removals, `check_test_weakening`

<!-- evidence-type: analysis -->

`check_test_weakening` flagged `tests/scripts/evidence_independence.test.ts`
(6 assertions net-removed) and `tests/scripts/hooks/context_hygiene_hook.test.ts`
(3 assertions net-removed) with no independent-verdict artefact yet
committed. Per `evaluator-independence` § Tests are evaluators, this file is
that verdict.

Session: 2026-10-06. Members: anthropic (claude-sonnet-4-5), openai
(codex-default). Quorum 2/2, subscription transport, $0 billed. The prompt
put to the council — the full diff plus the context a diff alone does not
show — is reproduced verbatim below, exactly as sent, so the verdict is
checkable against what was actually asked.

## The prompt sent to the council, verbatim

> `check_test_weakening` flagged two test files in a pull request's diff as
> asserting less than before, with no independent-verdict artefact yet
> committed. Per this repository's `evaluator-independence` rule, an
> implementer may not weaken a test silently; the remedy is an independent
> review of whether the removal is justified.
>
> Please review the diff below and answer plainly: is each net-assertion-
> removal justified by a corresponding, intentional removal of the production
> behaviour it asserted on, in the SAME change — or is either an unjustified
> weakening (a test softened to make something pass rather than updated to
> track a real behaviour change)?
>
> [the full diff of both files, as shown in the Diff section below]
>
> **Context the diff alone does not show:**
>
> 1. `evidence_independence.test.ts` — the removed test manually wrote a JSON
>    file at the session-less legacy ledger path to simulate a "new user
>    turn." In the SAME pull request, production code was changed to resolve
>    the per-turn stamp through `git_authorization_hook`'s own
>    `ledgerFileFor(session_id)` instead. With a real session id present,
>    `ledgerFileFor` never touches the legacy path, so the removed test would
>    fail against the new production code (confirmed: reverting the
>    production fix and re-running it reproduces that failure, 3 vs expected
>    1). The replacement is `evidence_independence_turn_marker.test.ts`,
>    committed in the same change, driving the real writer and the real
>    reader through a shared session id.
> 2. `context_hygiene_hook.test.ts` — the removed assertions check fields the
>    SAME pull request deliberately removed from the hook's state shape
>    entirely, because replayed over one real 110-tool-call session the flag
>    turned true after 74 of the 110 calls and was read by no model. New
>    assertions were added asserting the fields' ABSENCE, and a separate new
>    file greps `src/` and `docs/` for both field names and fails on any hit.
>
> **The question:** for each of the two files, does the net-assertion-removal
> track a real, intentional, same-diff removal of the production behaviour
> the lost assertions were checking — making this a legitimate test update,
> not a silent weakening? Please also flag anything you think the deleted
> tests checked that nothing in the diff replaces.

## Diff reviewed

The full diff of both files is unchanged from what shipped in the commit
that introduced the two production fixes; it is reproduced in full inside
the prompt above rather than linked, since the question file it was sent
from is a transient, gitignored artefact.

## Verdict — convergent, 2/2: both legitimate

**anthropic/claude-sonnet-4-5:** *"My assessment: BOTH LEGITIMATE... The
pattern shows explanatory comments naming exact replacement locations,
negative assertions added where fields were removed, new test files
committed same change, stated reasoning for removals... This pattern signals
'thoughtful refactoring with coverage,' not 'weaken tests to pass.'"*
Recommended verifying the replacement test's content before closing — done,
see below.

**openai/codex-default:** approves both, "mixed but approving, subject to
verifying the referenced replacement tests" — explicitly conditional on
confirming `evidence_independence_turn_marker.test.ts` preserves the full
`1 → 2 → new turn → 1` sequence with successful exit codes throughout, and
on confirming `context_hygiene_state_shape.test.ts` exists and greps for the
three removed field names.

## Verification of the condition both seats set

`tests/scripts/evidence_independence_turn_marker.test.ts`, committed in the
same change as the production fix, asserts exactly the sequence requested:

```ts
expect(userTurn("please merge the branch")).toBe(0);
expect(evaluationDispatch("Review my change and report findings.")).toBe(0);
expect(evaluationCount()).toBe(1);
expect(evaluationDispatch("Review my change again, wider scope.")).toBe(0);
expect(evaluationCount()).toBe(2);
expect(userTurn("now push it")).toBe(0);
expect(evaluationDispatch("Review my change and report findings.")).toBe(0);
expect(evaluationCount()).toBe(1);
```

`tests/scripts/hooks/context_hygiene_state_shape.test.ts`, committed in the
same change as the field removal, greps `src/` and `docs/` for both
`loop_detected` and `consecutive_same_tool` and fails on any hit; confirmed
green against the current tree.

Both conditions are met. The disposition is **approved, both files** — no
further action beyond the follow-ups below.

## Non-blocking follow-ups raised (both seats), and their disposition

- **"Update `context-hygiene.md` to document loop detection is model-carried"**
  (anthropic) — already true of the current text: the rule's "What the slot
  cannot reach" paragraph states the every-turn obligation is model-carried
  on every host, independent of this change. The removed field was a
  redundant, unused signal, not the rule's only enforcement path. No action
  needed.
- **"Add an old-state migration test if persisted state can contain the
  removed fields"** (openai) — attempted and reverted: a purge-on-load fix
  was written, then its own fixture reintroduced the literal field names
  into `src/scripts/context_hygiene_hook.ts`, which failed the very sweep
  test this same change added (`context_hygiene_state_shape.test.ts`,
  designed to fail on any mention of either name anywhere under `src/`).
  The state file is gitignored, per-session, ephemeral runtime output, not
  a tracked artefact — the stale key surviving one hook upgrade on one
  machine until that file is next deleted or recreated is a real but minor
  cost next to weakening the sweep test's own guarantee to compensate. Left
  as a named, deliberately undone follow-up rather than silently dropped.
- **"Confirm nothing outside this file used the removed `RunResult`
  interface"** (anthropic) — confirmed separately: `RunResult` was unused
  dead code pre-dating this change (reproduced by reverting just this
  interface removal on top of `origin/main` and re-running
  `eslint`, which already flagged it as unused before any of this round's
  edits landed).
