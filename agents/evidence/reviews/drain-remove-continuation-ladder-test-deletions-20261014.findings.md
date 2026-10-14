# Findings: the net-removed assertions on `drain/remove-continuation-ladder-20261014`

<!-- evidence-type: analysis -->

`check_test_weakening` refuses this diff with two files:

```
tests/e2e/adversarial-verification-fixtures.test.ts: 45 assertion(s) net-removed
tests/lib/loop_guards.test.ts: 11 assertion(s) net-removed
```

The gate discharges on the presence of any file under `agents/evidence/reviews/`
in the same diff and never reads it (`_lib/test_delta.ts:40`). This artifact is
written as if it did.

**Verdict: a deletion of the subject, not a weakening of a judge.** Every removed
assertion exercised `_lib/continuation_ladder.ts` or one of the three
`_lib/loop_guards.ts` functions only that ladder's withdrawn caller used. The
owner decided on 2026-10-14 to remove that code; its tests leave with it. No
removed assertion tests anything that still exists.

## 1. Who checked, and how

The implementer (this lane) made the deletions. A separate subagent of the same
model (level L1 — another session, same model, same provider) was asked, with no
expected outcome stated, to map every removed `expect(` to the production symbol
it exercised and grep `src/` at HEAD for that symbol. The prompt, verbatim in its
question part:

> for every `expect(...)` assertion REMOVED from those two test files, identify
> the production symbol(s) it exercised, and determine — by searching `src/` at
> HEAD — whether that symbol still exists anywhere in `src/` at HEAD. Also check
> whether any assertion that was REWRITTEN (not just removed) changed what it
> checks.

No council ran: `check_kernel_edit_ratified` reports no governance surface in the
diff, and this is the owner's own decision being executed, not a lock being
reopened.

## 2. What was removed

| Group | `it`s removed | Subject | Exists at HEAD |
|---|---|---|---|
| `T7 / T8` (whole describe) | 7 | `ladder`, `DELIVERY_STATES`, `DELIVERY_ENDINGS`, `deliveryBlocksCompletion`, `MAX_ITERATIONS`, `WALL_CLOCK_CAP_MS` | no |
| `T1` | 2 of 5 | `ladder`, `TERMINAL_STATE_BY_ACTION`, `terminalStateFor`, `HALT_ACTIONS` | no |
| `AC-7` | 6 of 9 | `ladder`, `terminalStateFor`, `DELIVERY_ENDINGS`, `WALL_CLOCK_CAP_MS`, `MAX_ITERATIONS` | no |
| `T6` | 0 — one line | `WALL_CLOCK_CAP_MS` | no |
| `matchesWholeLine` | 5 | `matchesWholeLine` | no |
| `detectUnavailableDependency` | 4 (one `it.each`, 6 rows) | `detectUnavailableDependency` | no |

The reviewer counted 42 removed `expect(` calls in the e2e file against the
gate's 45; the gate also counts other assertion shapes, and the difference is
not a hidden deletion — no `expect(` was added anywhere, and every removed one is
in the table above. `LadderState` still resolves by name in `src/`, but only as
the unrelated memory-eviction type in `memory_eviction.ts`.

## 3. What stayed, and the one rewrite

- `T1` keeps its three test-delta and same-session-flag cases; their subjects
  (`check_test_delta`, `evidence_independence`) are untouched.
- `AC-7` keeps its mission-record cases: the record survives the phase boundary
  and the session end, one resume twelve hours later re-asks nothing, and a
  record without decisions closes nothing. Renamed to say it now covers the
  mission half only.
- **`T6` is the one rewrite.** `expect(TWELVE_HOURS_MS).toBeGreaterThan(WALL_CLOCK_CAP_MS * 2)`
  is gone because the constant is gone; the `restore(...)` assertions beside it
  are unchanged. What is lost: the test no longer ties the twelve-hour gap to a
  run cap, because no run cap exists in code any more.
- `atomicWriteJson` and `stallSignal` lost no assertions.
- The critical-group floor in `AC-2` (`>= 9`) still holds: ten critical groups
  remain after `T7 / T8` left.

## 4. Residual, recorded rather than fixed

What the removed tests pinned as a COMPOSITION — a run bounded while the mission
is not — is no longer exercised by any code, because the run bound is gone. That
is the owner's decision taking effect, not a test weakening, and it is noted at
`AC-7`, `AC-1` and `8.1` of the parked
`road-to-adversarial-verification-and-long-runs` for the owner to settle.

The reviewer also noted `interruption_report.ts` still reads `halt-stall` journal
events. It parses historical ledger lines, not the removed function; nothing will
produce new ones. Left as is: the ledger is kept by the withdrawal's own record.
