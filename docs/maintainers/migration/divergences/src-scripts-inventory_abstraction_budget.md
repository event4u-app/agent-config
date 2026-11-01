# Divergence: inventory_abstraction_budget

## Script

- Python: `src/scripts/inventory_abstraction_budget.py`
- TypeScript: `src/scripts/inventory_abstraction_budget.ts`

## Symptom

In the generated `frontmatter.csv` / Markdown audit table, the
`dominant_value` column can differ between the Python and TypeScript runs
**on rows where the top frequency is shared by two or more values** (a
top-frequency tie). All other columns — `class`, `field`, `total`,
`distinct`, `dominant_share`, `bloat_candidate` — are byte-identical.

- Observed (CI, ext4): `fm row 5 col 4` — Python `4`, TS `3`.
- Not observed locally (macOS APFS) — the two filesystems happened to
  iterate the source files in the same order, so the tie resolved to the
  same value.
- Affected channel(s): the `dominant_value` cell only, and only on
  rows whose `dominant_share` ≤ 50% (no strict majority → a tie is
  possible).

## Root cause

`dominant_value` is `Counter.most_common(1)[0]` in Python — among the
max-count group it returns the **first-inserted** value, and insertion
order is the file-iteration order. Python `Path.glob("**/*.md")` returns
files in **unsorted OS `readdir` order**; the TS twin's `_globPattern`
sorts (`out.sort()`). When a field has two values tied at the top count,
the "first-inserted" winner depends on that file order, so the sorted-TS
order and the unsorted-Python order can pick different tied values.

This is **unreconcilable**, not a port bug: Python's own glob order is
OS-nondeterministic, so two Python runs on different filesystems can
already disagree on the same tie. Forcing the TS twin to sort does not
help (Python is unsorted); forcing it to read unsorted would still not
reliably reproduce CPython's recursive-glob traversal order across
runtimes. Every other derived value (the counts, the share, the bloat
flag) is order-independent and stays byte-identical.

## Verdict

`formatting-only` — the byte difference is confined to a single
display-label column that is inherently OS-iteration-order-dependent in
the Python original itself. No count, share, or bloat-candidate decision
changes. The column that the script exists to drive (`bloat_candidate`,
gated on `dominant_share > 0.95`) is unaffected, because a >95% share is a
strict majority and therefore never tied.

## Evidence

`tests/scripts/inventory_abstraction_budget.test.ts` — the golden-parity
suite asserts `inventory.csv` byte-identical, and for `frontmatter.csv`
compares every column byte-identical **except** `dominant_value` on rows
without a strict majority (`dominant_share` ≤ 50%, where a top tie is
possible). On rows with `dominant_share > 50%` the dominant value is
provably unique and IS compared. The Markdown table comparison
independently permits a per-line divergence only in the `dominant_value`
cell (pipe-cell index 5) and asserts every other cell identical.

## Approval

- Reviewer: matze4u
- Date: 2026-06-12
