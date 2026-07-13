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
3. **Read back after every write.** After writing a formula, read the cell back
   and confirm no formula error. The read-back is the spreadsheet's
   verification truth source.
4. **Recalc-verification loop + zero-formula-error contract.** After any
   create/edit batch, force a full recalculation (native app recalc; or reopen
   through an engine that computes) and sweep **every** computed cell. Any
   formula error anywhere — `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NAME?` —
   means the model **fails delivery**: fix the cause and re-run the loop. Zero
   formula errors is a hard contract, not a soft target. On a host without a
   recalc engine, sweep the cached cell values for these error strings and say
   explicitly that a full recalc could not be run (§ Capability-aware
   degradation).
5. **Formulas, not script-computed values.** When generating a workbook via a
   library/script (openpyxl, exceljs, …), write the **formula string** into the
   cell — never the value the generating script computed. A script-baked value
   is the hardcoding defect from step 2 wearing a different coat: it looks
   calculated but never recalculates.
6. **Source-comment web-sourced cells.** Any figure taken from the web carries a
   cell comment with its source. Financial figures follow the
   [`spreadsheet-source-quality`](../../rules/spreadsheet-source-quality.md) rule
   (official sources first; aggregators need permission + unofficial marking).
7. **Expand ranges on structural edits.** After inserting a row/column inside a
   formula's range, expand the range (or use a whole-column / table reference) so
   the new data is included — verified by read-back.
8. **Pivot-first charting.** Chart from a pivot/aggregate of raw data, not
   directly from hundreds of raw transactional rows.
9. **Bulk range operations over manual cell loops.** Prefer a single range
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
- A single `#N/A` or `#NAME?` left in a delivered model fails the zero-error
  contract even when "the important cells look fine" — errors propagate the
  moment a downstream formula touches them.
- A library-generated workbook whose cells hold script-computed values instead
  of formulas passes a visual check and fails the first input change — check
  the cell *content* (formula string present), not the displayed value.

## Do NOT

- Do NOT write a computed value where a formula belongs.
- Do NOT enter a financial figure from an aggregator/news/social source as
  official without the user's explicit permission + a cell-level unofficial mark.
- Do NOT claim a formula was read back / verified on a host that cannot open the
  spreadsheet — say what could not be verified instead.
- Do NOT deliver a model with any formula error (`#REF!`, `#DIV/0!`, `#VALUE!`,
  `#N/A`, `#NAME?`) anywhere in the workbook — zero errors is the contract.
- Do NOT let a generating script bake computed values into cells where formulas
  belong — write the formula string.
