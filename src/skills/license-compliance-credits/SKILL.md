---
model_tier: lite
name: license-compliance-credits
description: "Regenerate docs/THIRD-PARTY-NOTICES.md from provenance/borrows.jsonl after any ledger change — even a single new entry — never hand-edit the notices file"
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# license-compliance-credits

## When to use

- `provenance/borrows.jsonl` just gained, lost, or changed a line (a new
  borrow was ledgered via
  [`license-compliance-borrow-check`](../license-compliance-borrow-check/SKILL.md),
  or a correction line was appended).
- `npx tsx node_modules/@event4u/agent-config/src/scripts/lint_provenance.ts`
  reports the notices file is out of sync with the ledger.
- Someone asks "are our third-party notices up to date?" or "regenerate the
  credits file".

Do NOT use when:

- You want to add a NEW borrow — that starts at
  [`license-compliance-borrow-check`](../license-compliance-borrow-check/SKILL.md);
  this skill only regenerates the derived file from an already-updated
  ledger.
- The ledger itself needs fixing (a deny-class entry, a missing note) — fix
  the offending line via `license-compliance-borrow-check`'s discipline
  first; this skill cannot repair a bad ledger, only render it.

## Procedure

1. **Inspect the current state** — read `provenance/borrows.jsonl` (it may
   be legitimately empty) and note how many lines it has before
   regenerating, so the diff is checkable.
2. **Regenerate the notices file:**
   ```bash
   npx tsx node_modules/@event4u/agent-config/src/scripts/lint_provenance.ts --regenerate-notices
   ```
3. **Diff `docs/THIRD-PARTY-NOTICES.md`** before vs. after — confirm only
   that generated file changed, and that `provenance/borrows.jsonl` itself
   was not touched (it is append-only; this command never writes to it).
4. **Verify sync + validity** with a plain run (no flag):
   ```bash
   npx tsx node_modules/@event4u/agent-config/src/scripts/lint_provenance.ts
   ```
   Exit code 0 confirms every ledger record is schema-valid, no deny-class
   or `unknown` license slipped through, no transformation note reads as
   rename-only, and the notices file now matches the ledger byte-for-byte.
5. **If the linter fails**, stop — do not hand-patch
   `docs/THIRD-PARTY-NOTICES.md` to make it pass. Fix the actual offending
   line in `provenance/borrows.jsonl` via
   [`license-compliance-borrow-check`](../license-compliance-borrow-check/SKILL.md),
   then re-run step 2.

## Output format

1. The regenerate command's exit status and a one-line summary of what
   changed in the notices file (e.g. "added 1 entry: `<source_url>`
   (`<license>`)", or "no borrows recorded" for the honest empty-ledger
   state).
2. The follow-up `lint_provenance` (no flag) exit code, confirming sync —
   never report success on the regenerate step alone.

## Gotcha

- **`docs/THIRD-PARTY-NOTICES.md` is generated** — a hand-edit is invisible
  until the next `lint_provenance` run flags the drift as a linter failure,
  not as an obvious diff. Always regenerate; never patch the file directly.
- **An empty ledger is the honest starting state, not a bug** — it renders a
  plain "no borrows recorded" line. Do not "fix" that by adding a
  placeholder entry.
- **This skill cannot make a bad ledger pass** — if `lint_provenance`
  (no flag) still fails after regenerating, the defect is in
  `provenance/borrows.jsonl`, not in the notices file.

## Do NOT

- NEVER hand-edit `docs/THIRD-PARTY-NOTICES.md`.
- NEVER skip the post-regenerate `lint_provenance` (no-flag) run —
  regeneration and validation are two different checks; passing one does
  not imply the other passed.
- NEVER add or edit a line in `provenance/borrows.jsonl` from this skill —
  that belongs to `license-compliance-borrow-check`.

## See also

- [`code-provenance`](../../rules/code-provenance.md) — the rule that makes
  a ledger entry mandatory before a conscious borrow lands.
- [`license-compliance-borrow-check`](../license-compliance-borrow-check/SKILL.md) —
  where new ledger entries are drafted and fixed.
- `provenance/README.md` — the ledger's append-only contract.
- `node_modules/@event4u/agent-config/src/scripts/lint_provenance.ts` — the linter this skill wraps.
