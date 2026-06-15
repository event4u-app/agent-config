// Column schema for the timesheet CSV ingest.
//
// The CSV has five columns. Some are required, some optional. `rate_cents` is
// optional per-row: an entry that omits it should bill at the project's
// configured default rate (see config.mjs), NOT at some other row's rate.
//
// `field` is the canonical key used everywhere downstream; `column` is the
// header label expected in the CSV.

export const COLUMNS = [
  { field: 'project', column: 'project', required: true, type: 'string' },
  { field: 'person', column: 'person', required: true, type: 'string' },
  { field: 'minutes', column: 'minutes', required: true, type: 'int' },
  { field: 'rateCents', column: 'rate_cents', required: false, type: 'int' },
  { field: 'billable', column: 'billable', required: true, type: 'bool' },
];

// A blank cell ('' or whitespace) means "not provided". For an optional field
// that resolves to the project default downstream; for a required field it is
// a validation error.
export function isBlank(cell) {
  return cell === undefined || String(cell).trim() === '';
}
