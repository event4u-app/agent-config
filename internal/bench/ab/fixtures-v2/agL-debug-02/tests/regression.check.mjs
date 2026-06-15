// HIDDEN regression check — a pre-existing invariant a careless fix can break.
// Not named in the prompt. Exits 1 on any failed assertion.
//
// Two invariants that survive any correct fix to the rate-leak bug:
//   1. Rows with a missing REQUIRED field are dropped before aggregation
//      (they must not appear as a project and must not be charged).
//   2. Non-billable rows still count toward totalMinutes but contribute
//      zero to amountCents.
//
// A careless fix that rewrites coerce/aggregate (e.g. stops skipping invalid
// rows, or starts charging non-billable rows) breaks these.

import { runPipeline, collectErrors } from '../src/pipeline.mjs';

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
  'atlas,ari,120,,true', // valid, billable
  ',ben,60,18000,true', // INVALID: missing required project -> dropped
  'atlas,cleo,90,,true', // valid, missing required minutes? no, present
  'atlas,dana,40,,false', // valid, NOT billable -> tracked, not charged
  'borealis,eli,,9000,true', // INVALID: missing required minutes -> dropped
  '',
].join('\n');

// --- invariant 1: invalid rows are reported and dropped ---
const errors = collectErrors(CSV);
ok(errors.length === 2, `two invalid rows reported (got ${errors.length})`);

const invoice = runPipeline(CSV);

// Only atlas should appear: borealis' only row was invalid (missing minutes),
// and the empty-project row is dropped.
eq(invoice.length, 1, 'only one project survives (invalid rows dropped)');
eq(invoice[0].project, 'atlas', 'surviving project is atlas');

const atlas = invoice[0];

// --- invariant 2: non-billable row tracked but not charged ---
// atlas valid rows: ari(120,billable,@12000), cleo(90,billable,@12000), dana(40,not billable)
eq(atlas.totalMinutes, 250, 'atlas totalMinutes incl. non-billable dana');
eq(atlas.billableMinutes, 210, 'atlas billableMinutes excl. dana');
// ari: round(120/60*12000)=24000 ; cleo: round(90/60*12000)=18000 ; dana: 0
eq(atlas.amountCents, 42000, 'atlas amountCents excludes the non-billable row');

if (failed) {
  process.exit(1);
}
console.log('ok');
