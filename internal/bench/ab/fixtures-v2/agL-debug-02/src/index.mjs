// Public entry point + a tiny demo runner.
//
// `invoiceFromCsv` reads a CSV file and returns the per-project invoice rows.
// Running this module directly prints the invoice for data/timesheet.csv.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runPipeline } from './pipeline.mjs';

export function invoiceFromCsv(path) {
  const text = readFileSync(path, 'utf8');
  return runPipeline(text);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataPath = resolve(__dirname, '../data/timesheet.csv');
  const invoice = invoiceFromCsv(dataPath);
  for (const row of invoice) {
    console.log(
      `${row.project}: ${row.billableMinutes} billable min, ${(row.amountCents / 100).toFixed(2)} USD`,
    );
  }
}
