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

## 4. Addendum 2026-10-15 — the three reworded cells, checked independently

§ 2 names its own gap plainly: *"The reclassification of the three reworded
cells was the implementer's. No independent reviewer looked at it."* This
section closes that, after the fact — the PR had already merged as
`6aa338fd4` when it was written, so nothing here gated anything. It is a
record, not a clearance.

Each wording the fixture now cites was grepped against the live catalogue and
against the fixture itself, at `main` after the merge. Not read off the
implementer's comment, which is what § 2 says nobody had done:

| Wording cited | `threats.csv` | `ground-truth.json` |
|---|---:|---:|
| `Account enumeration through an observable difference` | 1 | 2 |
| `Password reset beyond the token` | 1 | 1 |
| `Federated sign-in account takeover` | 1 | 1 |
| `Authentication token in script-readable browser storage` | 1 | 2 |
| `Persistent login and incomplete logout` | 1 | 0 |

All three reworded cells resolve, and the row the fourth finding moved AWAY
from still exists and is simply no longer cited — the repointing left no
dangling reference in either direction. The mechanical near-match test § 2
describes is therefore confirmed by an independent read of the same two files,
not only by its own green run.

**The repointing was put to the repository owner and confirmed on 2026-10-14.**
A second council round, run on the broader question (is the whole fixture
change legitimate or a weakening) rather than § 2's narrow one, did NOT
converge: one seat called it legitimate — no stated finding disappeared,
provisional references were replaced by exact ones — and the other objected
that the fourth cell was not reworded but replaced by a row created in the same
change, which it called "redefining the taxonomy to make the test pass". Both
seats, independently, named the same item for a human. The owner confirmed it.
The split is recorded here because § 2's "2/2 seats" answers a narrower
question and should not be read as agreement on the wider one.

**One defect this check turned up, in prose only.** § 2's table and the
fixture's own `$comment` call the row `Persistent login and logout`. The
catalogue says `Persistent login and incomplete logout`; the short form matches
nothing. No finding cites it — it appears only in explanatory text — so no
citation is unresolvable. Worth correcting when that comment is next touched.

**What would reopen this:** a second finding repointed onto a row added in its
own change without an independent verdict. One repointing is a correction; a
habit of them is the taxonomy bending to the tests.
