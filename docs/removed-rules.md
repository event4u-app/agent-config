# Removed rules — the tombstone register

A rule that vanishes without a row is indistinguishable from one that never
existed, which is how a removed obligation comes back as a fresh proposal six
months later. This file is the row.

> **One row per removed rule.** Name · what it required · when it went · why.
> Written in the SAME change that removes the rule — a register somebody
> promises to backfill is the second file nobody updates, which is the failure
> `docs/CLAIMS.md` § `retires_phrasings` records for the claims ledger.

Created by `road-to-retired-claims-stay-retired` Phase 3.3.

## What counts as a removal

A rule file leaving `src/rules/` **and taking an obligation with it**. Three
things that look like removals and are not, each of which gets a row only in
the § Not removals table below:

- **A rename.** The obligation survives under a new name; the register would
  otherwise report a loss that did not happen.
- **A body migration.** The Iron Law stays in `src/rules/`, the mechanics move
  to a guideline or a skill. This is the `road-to-kernel-and-router` P4 shape
  and it is the most common large edit to a rule; nothing is removed.
- **A merge.** Two rules become one, and the surviving rule carries both
  obligations — `brand-consistency` into `brand-source-of-truth`, 2026-08-04.
  The absorbed file stays as a pointer stub precisely so inbound references
  keep resolving.

## Removed rules

| Rule | What it required | Removed | Why |
|---|---|---|---|
| _(none)_ | — | — | — |

**The empty table is a measurement, not a placeholder.** Re-derive it:

```bash
git log --no-renames --diff-filter=D --name-status --format='%h %ad %s' \
    --date=short 14.10.0..HEAD -- src/rules/
```

Run on 2026-08-30 at `4898f753a`, over the two releases preceding this
roadmap's landing (`14.10.0` → `14.11.0` → `14.12.0` → HEAD): **zero deletions**.
`--no-renames` is load-bearing — with rename detection on, a removal that
coincides with an unrelated addition can be paired away and reported as a
rename, which is the one failure mode that would make an empty table wrong.

## Not removals — the full `D` history of `src/rules/`

Widening the same query to the whole history returns exactly one deletion, and
it is a rename. It is recorded here rather than omitted, because "the register
is empty" and "nothing has ever been deleted" are different statements and a
reader deserves to know which one this file is making.

| File | Commit | Date | Disposition |
|---|---|---|---|
| `augment-source-of-truth.md` | `4360eec14` | 2026-06-09 | Renamed to `source-of-truth.md`. The obligation — edit `src/`, never a generated projection — is unchanged and live. |

## See also

- [`docs/CLAIMS.md`](CLAIMS.md) § `retires_phrasings` — the same
  retire-never-delete discipline for public claims, with a gate behind it.
- `src/rules/decision-revisit-gate.md` — a recorded decision is not a permanent
  law; this register is what makes a removed rule's decision findable when
  somebody proposes it again.
- `src/rules/recurring-criticism.md` — the entrance that fires when the same
  criticism arrives a second time, which is what an unrecorded removal
  guarantees.
