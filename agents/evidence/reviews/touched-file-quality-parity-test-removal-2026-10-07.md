<!-- evidence-type: original-review -->
# Test-weakening verdict — touched_file_quality parity test removal, 2026-10-07

Commissioned by the implementing lane of
`road-to-touched-file-quality-that-says-when-it-did-not-look` after
`check_test_weakening` reported `tests/scripts/touched_file_quality.test.ts` net
2 assertions down. Reviewer: an independent subagent session (level L1 — another
session, same model), read-only, run against head `c04640194`. The prompt and the
verdict are recorded below verbatim.

## Prompt

> You are reviewing a test change in the repository at
> <worktree path>
> (branch drain/road-to-touched-file-quality-that-says-when-it-did-not-look-20261007). Read-only: do not edit, commit or push anything.
>
> Scope: the full diff `git diff origin/main...HEAD -- tests/scripts/touched_file_quality.test.ts tests/scripts/touched_file_quality_parity.test.ts src/scripts/_lib/touched_file_quality.ts`, plus whatever in `src/agent-src/templates/scripts/work_engine/stack/runner.ts` (function `resolve_toolchain` and its `_*_quality` helpers) you need to judge it.
>
> The CI gate `check_test_weakening` reports that `tests/scripts/touched_file_quality.test.ts` asserts net 2 fewer times after this diff: one `it(...)` block named "the scoped table names no command the resolver cannot emit" was deleted.
>
> Question: is that deletion a weakening of what the test suite checks? Determine, from the code, which behaviours the deleted test could detect a regression in, and for each one whether some test in the diff (or already on the branch) still detects it. Run any targeted vitest file you need (`npx vitest run <file>`), but do not run the full suite.
>
> Report: a verdict line (one of: NOT-A-WEAKENING, WEAKENING, CANNOT-DETERMINE), then each behaviour the deleted test covered with the test that now covers it or "uncovered", then any findings about the new test's own correctness or sensitivity (file:line, severity). Plain text.

(The worktree's absolute path is replaced by `<worktree path>`; nothing else is edited.)

## Verdict

VERDICT: NOT-A-WEAKENING

The deleted test read runner.ts as text and asserted that a hand-copied list of
five literals ('npx eslint .', 'vendor/bin/phpstan analyse', 'vendor/bin/pint',
'ruff check', 'mypy .') each appears as a quoted string in that file. It never
read SCOPED_FORMS, so it could catch only a regression where one of those
literals vanished from the source. It would not catch a literal surviving in a
comment or dead code, a new table row the resolver never emits, or a resolver
command with no row.

Behaviours the deleted test could detect, and what covers each now:

1. The resolver stops emitting one of the five scoped commands (deleted or
   renamed). Covered by the parity test "every table key is a command the
   resolver emitted"; all five are keys of SCOPED_FORMS. Stronger than before:
   the old text match stayed green if the literal survived only in a comment or
   an unreachable branch.
2. The table names a command the resolver cannot emit (the stated D2 intent).
   The old test only half-covered this — it checked the copy, not the table. The
   parity test catches any key in any of the three lists.

Nothing the old test caught is missed by the new suite. It adds "every emitted
command is classified" and "no command is classified twice".

Evidence: `npx vitest run tests/scripts/touched_file_quality_parity.test.ts
tests/scripts/touched_file_quality.test.ts` — 2 files, 42/42 passing.
Sensitivity was reasoned from the code; the review was read-only and mutated
nothing.

Findings on the new test:

- Low, touched_file_quality_parity.test.ts:62 — the empty-set guard
  `emitted.size >= Object.keys(STACKS).length` is loose; it would pass if one
  stack's fixture emitted nothing. Test 2 already catches that for every listed
  key, so nothing is uncovered. Tighter: one non-empty emission per stack.
- Low, touched_file_quality.ts:218 — TYPE_CHECK_COMMANDS has no parity test; a
  future type checker missing from that set would leave typecheck_not_run
  incomplete. Not covered by the deleted test either: a gap in the new feature,
  not a weakening.
- Info, touched_file_quality_parity.test.ts:23-37 — fixtures depend on the
  resolver's stack detection; a detection change goes red loudly, acceptable.
- Info — the fs, path and os imports in touched_file_quality.test.ts are still
  used, so the deletion leaves no orphaned imports.

## Disposition (implementer, not the reviewer)

Both low findings were acted on in the commit that adds this page: the guard now
asserts a non-empty emission per stack, and a new case asserts every
`TYPE_CHECK_COMMANDS` key is a command the resolver emitted. That later commit
has NOT been independently reviewed; this verdict is about head `c04640194`.
