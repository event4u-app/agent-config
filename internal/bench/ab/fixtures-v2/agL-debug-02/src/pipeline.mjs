// Pipeline orchestrator: wires the stages together.
//
//   CSV text
//     -> parse   (header labels -> raw cell objects)
//     -> validate (canonical fields, required checks, `provided` set)
//     -> coerce  (typed entries, resolved rates)
//     -> group   (by project, first-seen order)
//     -> aggregate (per-project invoice totals)

import { parseCsv } from './parse.mjs';
import { validateRows } from './validate.mjs';
import { coerceRows } from './coerce.mjs';
import { groupByProject } from './group.mjs';
import { aggregate } from './aggregate.mjs';

export function runPipeline(csvText) {
  const parsed = parseCsv(csvText);
  const validated = validateRows(parsed);
  const entries = coerceRows(validated);
  const groups = groupByProject(entries);
  return aggregate(groups);
}

// Collected validation errors, in row order (skips clean rows).
export function collectErrors(csvText) {
  const parsed = parseCsv(csvText);
  const validated = validateRows(parsed);
  const errors = [];
  validated.forEach((row, i) => {
    if (row.errors.length > 0) {
      errors.push({ row: i, errors: row.errors });
    }
  });
  return errors;
}
