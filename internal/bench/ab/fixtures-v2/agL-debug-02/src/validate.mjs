// Validation layer: remaps each parsed row from header labels to canonical
// field names, enforces required fields, and records whether each optional
// field was actually provided.
//
// Output row shape (one per input row):
//   { raw: { <field>: <cell-or-undefined> }, provided: Set<field>, errors: [] }
//
// The `provided` set is the single source of truth downstream for "did this
// row supply a value for this field". A blank required cell is an error; a
// blank optional cell is simply absent from `provided`.

import { COLUMNS, isBlank } from './schema.mjs';

export function validateRows(parsed) {
  const out = [];

  for (const row of parsed.rows) {
    const raw = {};
    const provided = new Set();
    const errors = [];

    for (const col of COLUMNS) {
      const cell = row[col.column];
      if (isBlank(cell)) {
        if (col.required) {
          errors.push(`missing required field: ${col.field}`);
        }
        // optional + blank -> not added to `provided`, raw stays undefined
        raw[col.field] = undefined;
        continue;
      }
      raw[col.field] = String(cell).trim();
      provided.add(col.field);
    }

    out.push({ raw, provided, errors });
  }

  return out;
}
