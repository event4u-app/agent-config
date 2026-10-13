# Account-surface fixtures

A frozen corpus of account-flow code with a known defect state, for
`road-to-account-surface-detector`. Nothing here runs, imports resolve to
nothing, and no file is shipped — this is sample application code, not this
package's own code.

## Why it exists before the detector

The claim `account-surface-finds-planted` in `docs/CLAIMS.md` measures per-class
recall and per-class false positives against this corpus. A fixture set written
after the detector measures the authors rather than the detector, so the corpus
and the claim land first, in a change carrying no `check_account_surface` code.
That ordering is the whole point and is the roadmap's Phase 1.

## Layout

| Path | What it holds |
|---|---|
| `php/unsafe/` | One planted defect per class, in a PHP framework shape |
| `php/safe/` | The twin of each, same path under a different root |
| `node/unsafe/` | One planted defect per class, in a Node/TypeScript shape |
| `node/safe/` | The twin of each, same path under a different root |
| `decoys/` | Files that name the keyed words and must stay silent |
| `ground-truth.json` | Every expected finding, and only those |

A twin sits at the **same relative path** as its unsafe counterpart, with
`unsafe/` swapped for `safe/`. A path predicate therefore cannot tell them
apart; only the content can, which is what makes the twins a real
false-positive measurement rather than a path test.

Every planted file's path carries one of the twelve words the detector's path
predicate keys on (login, register, signup, password, reset, verify, session,
oauth, callback, mfa, otp, passkey). A planted file outside that predicate
would never be opened, so its class would score recall zero however good the
lexical pattern is; the corpus test asserts this rather than leaving it to be
noticed during the measurement.

**One file may carry two classes**, and then it gets two ground-truth entries.
The corpus test matches the *set* of named files against the set of unsafe
files for exactly this reason.

## What a reader must not conclude

`ground-truth.json` lists what a detector **should** find. It is not a
measurement, and no figure in it is a result. The measured figures live in the
claim entry and arrive in Phase 3.

**Every** Threat cell cited in `ground-truth.json` is pending: none of the
seven is in `src/skills/threat-modeling/data/threats.csv` yet. They arrive with
`road-to-account-lifecycle-threat-rows` step 2.2 and are listed under
`pending_threat_rows` with that dependency named.

The list cannot go stale unnoticed. A corpus test asserts that no pending cell
is already present, so the moment step 2.2 merges, that test reds and names the
reconciliation it wants — removing the cell and checking the cited wording
against the row as merged. When the list empties, Phase 2 is unblocked.

## Planted values

Every planted secret-shaped value is an obvious placeholder
(`changeme-pepper`), and no detector was weakened to let this corpus in.

**The reason is not the one a reader would guess, so it is written down.**
`check_secret_leak` never reads this corpus at all: it excludes any path
segment `fixtures` or `tests` in every scope it runs in
(`src/scripts/check_secret_leak.ts:54-55`, "test + golden + parity data
legitimately holds secret-shaped strings"). The `// secret-allow` marker at
`php/unsafe/app/Services/Auth/PasswordPepper.php:16` therefore **suppresses
nothing today** — it is kept so that the line stays correct if that exclusion
is ever narrowed, not because it is load-bearing now. Anyone reading the
marker as evidence that the gate scans this tree would be reading it wrong.

Independently of the path exclusion, the planted values would not match the
rule pack anyway: `pepper` is not one of its keywords, and a placeholder
matching `/changeme/i` is demoted below the confidence the gate acts on.
