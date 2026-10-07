# Independent review — moved assertions, `check_test_weakening`

<!-- evidence-type: analysis -->

`check_test_weakening` flagged `tests/hooks/telemetry_usage_hook.test.ts` (11 assertions
net-removed) on branch `drain/road-to-neighbours-that-pull-their-weight-20261006c`. The
recorder those assertions covered moved out of `telemetry_usage_hook.ts` into the new
`mcp-usage-observation` concern in the same change. Per `evaluator-independence` § Tests are
evaluators, this file is the independent verdict.

Session: 2026-10-06. Members: anthropic (claude-sonnet-4-5), openai (codex-default). Quorum
2/2, subscription transport, $0 billed. The prompt is reproduced verbatim below; the diff it
carried was the branch-versus-main diff of the three test files it names.

## The prompt sent to the council, verbatim

> # Independent test review — assertions moved between test files
>
> `check_test_weakening` reports that `tests/hooks/telemetry_usage_hook.test.ts` net-removes 11 assertions. In the same change, the code those assertions covered (a foreign-MCP tool-name recorder) moved out of `src/scripts/hooks/telemetry_usage_hook.ts` into a new concern, `src/scripts/hooks/mcp_usage_observation_hook.ts`, and a new test file `tests/hooks/mcp_usage_observation_hook.test.ts` was added. `tests/scripts/neighbour_mcp_use.test.ts` was also edited: a block that asserted the recorder was NOT reachable through the dispatcher was replaced by one asserting that it is.
>
> You are the independent reviewer under the repository's rule that an implementer may not weaken a test silently. Read the diff below and answer:
>
> 1. For each assertion removed from `telemetry_usage_hook.test.ts` and `neighbour_mcp_use.test.ts`, is an equivalent or stronger assertion present in the new or edited file, against the code that now owns the behaviour? Name any that is lost or weakened.
> 2. Do the replacement tests have the sensitivity the removed ones had (would they fail if the behaviour they cover regressed)?
> 3. Your verdict, one of: `no-weakening` (the assertions moved with their subject), `weakening-justified` (some coverage is lost but the removal is correct), `weakening-not-justified` (coverage is lost and should be restored), with reasons.
>
> ## Diff
>
> [the full diff of the three test files]

## Verdicts

- **anthropic — `no-weakening`.** Every removed assertion has an equal or stronger
  counterpart against the code that now owns the behaviour; the privacy,
  malformed-envelope and manifest assertions are new coverage.
- **openai — `no-weakening`.** The removed assertions moved with their behaviour or were
  correctly inverted (the unreachable-recorder test became the reachable one); privacy,
  malformed-input and manifest coverage increased.

Unanimous. Both seats named one residual gap that is not a weakening: no test drives a
real dispatcher invocation end to end into the new hook. Recorded as a follow-up, not
addressed in this change.
