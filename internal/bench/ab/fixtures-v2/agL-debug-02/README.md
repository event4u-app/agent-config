# timesheet-invoice

A small CSV-ingest → validation → aggregation pipeline that turns a timesheet
CSV into per-project invoice totals.

## Data flow

```
CSV text
  → parse.mjs      split into header + raw cell objects (keyed by header label)
  → validate.mjs   map header labels → canonical fields, enforce required cells,
                   record which optional fields were actually provided
  → coerce.mjs     convert cells to typed values, resolve each row's billing rate
  → group.mjs      bucket entries by project (first-seen order)
  → aggregate.mjs  per-project totals: tracked minutes, billable minutes, amount
```

`src/index.mjs` exposes `invoiceFromCsv(path)` and, run directly, prints the
invoice for `data/timesheet.csv`.

## CSV format

Columns: `project, person, minutes, rate_cents, billable`.

- `project`, `person`, `minutes`, `billable` are **required**.
- `rate_cents` is **optional**. When a row leaves it blank, that row bills at
  the project's configured default rate (`src/config.mjs`); projects without a
  configured rate use the fallback rate.

## Billing rules

- Only **billable** rows contribute to the charged amount. Non-billable rows
  still count toward a project's tracked `totalMinutes`.
- A row's charge is `round(minutes / 60 × effectiveRateCents)`.
- A project's invoice is the sum of its billable rows' charges.

## Run

```bash
node src/index.mjs
```
