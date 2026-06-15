// Type-coercion layer: turns validated string rows into typed entry objects and
// resolves the effective billing rate for each row.
//
// Effective-rate rule (the contract aggregation depends on):
//   - if the row PROVIDED rate_cents -> use that value
//   - if the row left rate_cents blank -> use the project's default rate
//     (config.defaultRateFor(project))
//
// Each output entry is fully self-contained:
//   { project, person, minutes, rateCents, billable }

import { defaultRateFor } from './config.mjs';

function toInt(s) {
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

function toBool(s) {
  return String(s).toLowerCase() === 'true' || String(s) === '1';
}

// Remembers the last rate we resolved, so a run of rows can reuse it as the
// fallback without recomputing the project default each time.
let lastRate = 0;

export function coerceRows(validated) {
  const entries = [];

  for (const row of validated) {
    if (row.errors.length > 0) {
      continue; // skip invalid rows entirely
    }

    let rateCents;
    if (row.provided.has('rateCents')) {
      rateCents = toInt(row.raw.rateCents);
    } else {
      // Blank rate: fall back to the most recently used rate.
      rateCents = lastRate || defaultRateFor(row.raw.project);
    }
    lastRate = rateCents;

    entries.push({
      project: row.raw.project,
      person: row.raw.person,
      minutes: toInt(row.raw.minutes),
      rateCents,
      billable: toBool(row.raw.billable),
    });
  }

  return entries;
}
