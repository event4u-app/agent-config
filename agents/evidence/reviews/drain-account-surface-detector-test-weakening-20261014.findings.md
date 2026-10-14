# Findings: the one net-removed assertion in `tests/fixtures/account-surface/ground-truth.json`

<!-- evidence-type: analysis -->

`check_test_weakening` refuses PR #2356 at `5ac5a0411` with one file:

```
tests/fixtures/account-surface/ground-truth.json: 1 assertion(s) net-removed
```

The gate counts lines matching its `ASSERTION` pattern
(`src/scripts/_lib/test_delta.ts:112`), which includes `\bassert`, in any file
under `tests/`. It discharges on the presence of a review file here and never
reads one (`_lib/test_delta.ts:40`), so this file is written as if it did.

**Verdict: no assertion was removed or weakened. The counted line is a `$comment`
string in a JSON fixture, and the word it matched is prose.**

## 1. The counted line, exactly

`git diff --unified=0 origin/main...HEAD -- tests/fixtures/account-surface/ground-truth.json`
has exactly one line, on either side, that matches the pattern. It is the
removed `pending_threat_rows.$comment`, which ended:

> "... A test asserts no cell here is already present, so the list cannot go
> stale silently: when step 2.2 merges, that test reds and names the
> reconciliation."

The pattern matched `asserts`. The replacement comment says "Two tests keep the
list honest" and contains no matching word. A JSON fixture holds no executable
assertion. The scores the detector is checked against are its `findings` entries
(`class`, `file`, `line`, `evidence`, `remediation`, `threat_row`), and none of
those changed, apart from the `threat_row` text reconciled below.

Nothing was restored: putting the word back would turn the gate green without
changing what any test checks, which is the cheap exit this file exists to refuse.

## 2. What actually moved in the fixture, and who verified it

| Change | Before | After | Verified by |
|---|---|---|---|
| `pending_threat_rows.cells` | 4 cells | `[]` | see the rows below |
| 3 `threat_row` values | `Account enumeration through any observable difference` · `Reset beyond the token` · `Federated sign-in takeover` | the landed cells `Account enumeration through an observable difference` · `Password reset beyond the token` · `Federated sign-in account takeover` | **the implementer**, mechanically checked by the new near-match test (below) |
| 1 `threat_row` value | `Persistent login and logout` | `Authentication token in script-readable browser storage` (a row added to `threats.csv` in the same PR) | **AI council 2026-10-14, 2/2 seats** (anthropic/claude-sonnet-4-5 + openai/codex-default, one invocation, $0, subscription-authed): option 2, a dedicated row, because the landed `Persistent login and incomplete logout` row's controls cover remember-me and logout and nothing against script-readable storage |
| `$comment` | text above | text describing the reconciliation | n/a, prose |

**The reclassification of the three reworded cells was the implementer's.** No
independent reviewer looked at it. The only check on it is mechanical:
`tests/scripts/account_surface_ground_truth.test.ts` gained `holds no pending cell
that a landed row carries under different wording`. It was run against the
unreconciled fixture first and went red on `Account enumeration through any
observable difference`, with the landed wording named. It is green now. Its
companion `resolves every cited threat row, or declares it pending` still runs,
and with the pending list empty every cited cell must exist verbatim in the Threat
column. So the fixture is checked more strictly than before, not less.

## 3. Net effect on what the tests check

- `account_surface_ground_truth.test.ts`: 16 → 18 cases. Two added (the
  near-match test and its sensitivity pin), none removed or loosened.
- No `expect` in any test file was removed, edited to accept more, or skipped.
  This file is the only one the gate flagged.

Residual, named rather than smoothed away: the gate cannot tell prose from an
assertion in a JSON fixture under `tests/`. That is a precision limit of the
pattern, recorded here, not fixed in this PR.
