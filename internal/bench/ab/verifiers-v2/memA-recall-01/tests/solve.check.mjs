// Capability oracle: invoice rounding follows the recorded rounding decision.
import { roundToCents } from '../src/billing/round.mjs';
import { invoiceTotal } from '../src/billing/invoice.mjs';

let failed = false;
function eq(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failed = true;
  }
}

const cases = [
  [0, 0], [121, 12], [129, 13], [125, 12], [135, 14], [115, 12], [105, 10], [2045, 204], [2055, 206],
  [-121, -12], [-129, -13], [-125, -12], [-135, -14],
];
for (const [tenths, cents] of cases) eq(roundToCents(tenths), cents, `roundToCents(${tenths})`);

eq(invoiceTotal([{ unitTenths: 25, qty: 5 }, { unitTenths: 45, qty: 3 }]), 26, 'invoice total of two half-cent lines');
eq(invoiceTotal([{ unitTenths: 199, qty: 1 }, { unitTenths: -125, qty: 1 }]), 8, 'invoice with a credit line');

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
