<!-- evidence-type: analysis -->

# How often a verification leaves no usable record — one reading, two corpora

Produced by `agents/roadmaps/road-to-a-failed-command-the-recorder-sees.md` step
3.2, with `src/scripts/report_verification_record_coverage.ts`. Taken on
2026-10-01 at 10:31Z, after the `PostToolUseFailure` binding of Phase 2 landed.

The witness corpus is **live and machine-local**: it is gitignored, pruned on a
session boundary, and written to by whatever sessions are running. Two readings
four seconds apart during this work differed by two records. So every number
below is a point-in-time snapshot of one machine, not a population figure, and
nothing here should be quoted as a rate for the package.

## Corpus A — this worktree, after the fix

One session, created by step 2.2's deliberate failing command.

| host | binds recorder | sessions | records | `exit_code` available | `instrument_gap` count | share |
|---|---|---|---|---|---|---|
| claude | yes | 1 | 1 | 1 | 0 | 0.0% |
| augment | yes | 0 | 0 | 0 | 0 | unobserved |
| cline | yes | 0 | 0 | 0 | 0 | unobserved |
| cowork | yes | 0 | 0 | 0 | 0 | unobserved |
| cursor | yes | 0 | 0 | 0 | 0 | unobserved |
| gemini | yes | 0 | 0 | 0 | 0 | unobserved |

Verdicts: `INVALID_RUN:nonzero_exit_without_test_failure` ×1 — which is the
correct class for `tsc` exiting 2 with no test summary to parse, and the record
carries `exit_code: 2` with `exit_source: "error_prefix"`.

**Five of the six hosts that bind the recorder are `unobserved`, and that is the
honest state rather than a clean one.** This package has measured the failure
event on claude and on no other host. Whether augment, cline, cowork, cursor or
gemini split success and failure across two events, or surface an exit code at
all, is not established by anything in this tree.

## Corpus B — the parent checkout, before the fix

17 sessions written by ordinary work on this machine, all predating the
`platform` field, so every one reads `unattributed`.

| host | sessions | records | `exit_code` available | `instrument_gap` count | share |
|---|---|---|---|---|---|
| unattributed | 17 | 106 | 106 | 0 | 0.0% |

Verdicts: `INVALID_RUN:not_a_verification_command` ×77 · `PASS_EVIDENCE_OK` ×24
· `FAIL_EVIDENCE` ×5.

### The 0.0% is the finding, and it does not mean what it looks like

Every one of 106 records carries an exit code, so by the instrument-gap measure
this corpus is perfect. It is not. These records were written by a tree where a
failing command fired an event bound to nothing — so a red run produced **no
record at all**, and a reading over records cannot see it. A 0% gap rate here
means *every record that exists is well-formed*, which is a much weaker claim
than *every command that ran was recorded*.

This is the blind spot the reporter prints with every table, and it is why step
3.1 refuses an empty scan rather than reporting 0% over nothing: on this measure
the broken state and the repaired state are indistinguishable.

### Then why are there five `FAIL_EVIDENCE` records at all

Because a shell pipeline hides the exit code. `npx vitest run … 2>&1 | tail -40`
exits with `tail`'s status, which is 0, so the host treats the call as a success,
fires `PostToolUse`, and the recorder writes `exit_code: 0` — with a test summary
in the output that reports failures. `classifyRun` reads the summary and
correctly returns `FAIL_EVIDENCE` over the zero exit.

So before the fix the only failing runs this host recorded were the ones whose
failure a pipe had concealed from it. That is worth stating plainly: the five
reds are not evidence that the pre-fix carrier worked. They are evidence of a
second path to the same record, one that happens to survive the missing binding
and that nobody designed.

## What the reading does not establish

- **No per-host comparison exists**, because exactly one host is attributed.
- **No rate over time**, because the corpus is pruned and machine-local.
- **Nothing about a consumer install.** Both corpora come from this repository's
  own sessions on one machine.
- **The `not_a_verification_command` majority (77 of 106) is not a defect.** The
  recorder deliberately writes a record for every command its wide selector
  admits, so the gate can tell "the turn ran `echo test`" from "the turn ran
  nothing"; the classifier then rejects them. A reader counting those as failures
  of the instrument would be counting its design as its defect.
