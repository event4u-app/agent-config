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

A twin carries the **same basename** as its unsafe counterpart. A path
predicate therefore cannot tell them apart; only the content can, which is what
makes the twins a real false-positive measurement rather than a path test.

## What a reader must not conclude

`ground-truth.json` lists what a detector **should** find. It is not a
measurement, and no figure in it is a result. The measured figures live in the
claim entry and arrive in Phase 3.

Six of the Threat cells cited in `ground-truth.json` are not in
`src/skills/threat-modeling/data/threats.csv` yet; they arrive with
`road-to-account-lifecycle-threat-rows` step 2.2 and are listed under
`pending_threat_rows` with that dependency named.

## Planted values

Every planted secret-shaped value is an obvious placeholder
(`changeme-pepper`), and the one line a credential scanner would match carries
the audited inline allow-marker. No detector was weakened to let this corpus in.
