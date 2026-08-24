---
model_tier: high
name: spreadsheet-authoring
description: "Use when building or editing a spreadsheet or model — formulas over hardcoded values, read-back after writes, official-source data, pivot-first charts. Triggers on 'spreadsheet', 'build a model'."
domain: process
workspaces:
  - finance
packs:
  - finance-basic
trust:
  level: professional
install:
  removable: true
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# spreadsheet-authoring

> The spreadsheet surface's correctness floor (per
> [`surface-agent-contracts`](../../../docs/contracts/surface-agent-contracts.md)):
> a spreadsheet's **truth source is the formula read-back**, not a plausible
> table of numbers. A cell that holds a hardcoded computed value is a latent
> lie — it silently goes stale the moment an input changes.

## When to use

- Building or editing a spreadsheet / financial model (SaaS, ops, budget, forecast).
- Charting raw tabular data.
- Entering web-sourced or financial figures into cells.

Do NOT use for: per-customer unit-economics *reasoning* (route to
`unit-economics-modeling`), runway *shape* (route to `runway-cognition`), or a
prose document/table (that is the document surface, `doc-coauthoring`).

## Procedure

1. **Detect the surface + capability.** Confirm a spreadsheet is the right
   surface (not a prose table). Confirm native spreadsheet tooling is available;
   if not, see § Capability-aware degradation.
2. **Formulas over hardcoded values.** Any computed cell holds a **formula**
   (`=SUM(...)`, `=B2*C2`), never the typed-in result. Hardcoding a computed
   value is the cardinal spreadsheet defect — it does not recalculate.
3. **Read back after every write, and RECALCULATE first.** After writing a
   formula, force a recalculation, then read the cell back — a library that
   writes formulas without recalculating leaves the cached value stale, so a
   read-back before recalc proves nothing. The **zero-formula-error contract**:
   any of `#REF!` / `#DIV/0!` / `#VALUE!` / `#N/A` / `#NAME?` in a written cell
   is a **failure**, not a warning — reject the output and fix the formula. The
   recalc'd read-back is the spreadsheet's verification truth source.
   **Formulas, never hardcoded computed values** — a library that writes the
   Python-computed number into the cell instead of the `=` formula has produced
   a dead spreadsheet that will not update when inputs change; write the formula
   string and let the recalc compute it.
4. **Source-comment web-sourced cells.** Any figure taken from the web carries a
   cell comment with its source. Financial figures follow the
   [`spreadsheet-source-quality`](../../rules/spreadsheet-source-quality.md) rule
   (official sources first; aggregators need permission + unofficial marking).
5. **Expand ranges on structural edits.** After inserting a row/column inside a
   formula's range, expand the range (or use a whole-column / table reference) so
   the new data is included — verified by read-back.
6. **Pivot-first charting.** Chart from a pivot/aggregate of raw data, not
   directly from hundreds of raw transactional rows.
7. **Bulk range operations over manual cell loops.** Prefer a single range
   formula / fill over hand-editing cells one by one.

## Capability-aware degradation

- **Native tooling present** → write + read back formulas directly.
- **Only exported files + a parser present** → operate on the exported file;
  state that formulas were written into the export, and what the target app will
  recompute on open.
- **Neither** → do NOT pretend formulas were written or read back. Say plainly
  what cannot be verified on this host, and deliver the formula definitions +
  the layout as a durable plan the user applies in their spreadsheet app.

## Output format

1. **The spreadsheet / model** — cells carrying formulas (not baked values),
   source comments on sourced cells, pivots feeding charts.
2. **`assumptions.md`** — every input value, sourced or marked `assumption`;
   the official-vs-unofficial status of each financial figure.
3. **`verification-note.md`** — which cells were read back, any formula errors
   found + fixed, and — on a degraded host — exactly what could not be verified.

## Gotcha

- Hardcoding a computed value instead of a formula is the #1 spreadsheet defect:
  it looks right today and is silently wrong after the next input change.
- A formula range not expanded after a row insert silently drops the new row
  from every downstream total.
- Charting straight off a raw transactional table (no pivot) produces an
  unreadable chart and hides the data's real shape.
- An aggregator/news figure entered as if it were official financial data is a
  sourcing defect even when the number happens to be right — see
  `spreadsheet-source-quality`.
- On a host without spreadsheet tooling, claiming "formulas written + verified"
  is a fabricated verification (never do it — degrade honestly).

## Do NOT

- Do NOT write a computed value where a formula belongs.
- Do NOT enter a financial figure from an aggregator/news/social source as
  official without the user's explicit permission + a cell-level unofficial mark.
- Do NOT claim a formula was read back / verified on a host that cannot open the
  spreadsheet — say what could not be verified instead.
