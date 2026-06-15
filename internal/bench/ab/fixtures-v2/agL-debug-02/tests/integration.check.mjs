// HELD-OUT end-to-end integration check for the timesheet -> invoice pipeline.
// Not named in the prompt. Exits 1 on any failed assertion.
//
// Asserts the full contract end-to-end, including the HARD case: a project
// whose entries MIX a rate-provided row with a rate-blank row. The blank row
// must bill at the *project default*, never at the other row's rate, and each
// entry must contribute its OWN minutes/rate — not a value leaked from another
// row processed elsewhere in the pipeline.

import { runPipeline } from '../src/pipeline.mjs';

let failed = false;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}
function eq(actual, expected, label) {
  ok(actual === expected, `${label} (expected ${expected}, got ${actual})`);
}

const CSV = [
  'project,person,minutes,rate_cents,billable',
  'atlas,ari,120,,true', // blank rate -> atlas default 12000 -> 24000
  'atlas,ben,60,18000,true', // explicit 18000 -> 18000
  'borealis,cleo,90,,true', // blank -> borealis default 9000 -> 13500
  'borealis,dana,30,,false', // blank, NOT billable -> 0 charged, 30 tracked
  'cobalt,eli,240,,true', // blank -> cobalt default 15000 -> 60000
  'cobalt,fin,45,20000,true', // explicit 20000 -> 15000
  '',
].join('\n');

const invoice = runPipeline(CSV);

// --- structural ---
eq(invoice.length, 3, 'three projects in first-seen order');
eq(invoice[0].project, 'atlas', 'project[0] is atlas');
eq(invoice[1].project, 'borealis', 'project[1] is borealis');
eq(invoice[2].project, 'cobalt', 'project[2] is cobalt');

const by = Object.fromEntries(invoice.map((r) => [r.project, r]));

// --- atlas: HARD case — mixed blank/explicit rate in the SAME project ---
eq(by.atlas.totalMinutes, 180, 'atlas totalMinutes');
eq(by.atlas.billableMinutes, 180, 'atlas billableMinutes');
// 24000 (120min @ default 12000) + 18000 (60min @ 18000) = 42000
eq(by.atlas.amountCents, 42000, 'atlas amountCents (blank row uses project default, not the 18000 row rate)');

// --- borealis: non-billable row tracked but not charged ---
eq(by.borealis.totalMinutes, 120, 'borealis totalMinutes (incl. non-billable)');
eq(by.borealis.billableMinutes, 90, 'borealis billableMinutes');
eq(by.borealis.amountCents, 13500, 'borealis amountCents (90min @ default 9000)');

// --- cobalt: another mixed project, far from the start of the file ---
eq(by.cobalt.totalMinutes, 285, 'cobalt totalMinutes');
eq(by.cobalt.billableMinutes, 285, 'cobalt billableMinutes');
// 60000 (240min @ default 15000) + 15000 (45min @ 20000) = 75000
eq(by.cobalt.amountCents, 75000, 'cobalt amountCents (blank row uses project default, not the 20000 row rate)');

// --- grand total cross-check ---
const grand = invoice.reduce((s, r) => s + r.amountCents, 0);
eq(grand, 42000 + 13500 + 75000, 'grand total amountCents');

if (failed) {
  process.exit(1);
}
console.log('ok');
