// HIDDEN check — free-shipping threshold is inclusive, end to end through
// computeTotals, with no regression elsewhere in the totals pipeline.
import { computeTotals } from '../src/orders/totals.mjs';

let failed = false;
function eq(label, got, expected) {
  if (got !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${got}`);
    failed = true;
  }
}
const line = (unitCents, qty = 1) => ({ unitCents, qty });

// the reported bug: exactly at the threshold ships free
let t = computeTotals({ lines: [line(2500, 2)] });
eq('5000 shipping', t.shipping, 0);
eq('5000 total', t.total, 5950);

// just below still pays the flat rate
t = computeTotals({ lines: [line(4999)] });
eq('4999 shipping', t.shipping, 495);

// above stays free
t = computeTotals({ lines: [line(6000)] });
eq('6000 shipping', t.shipping, 0);

// threshold is checked on the DISCOUNTED subtotal
t = computeTotals({ lines: [line(5500)], coupon: 'FIVER' });
eq('5500-500 subtotal', t.subtotal, 5000);
eq('5500-500 shipping', t.shipping, 0);
t = computeTotals({ lines: [line(5000)], coupon: 'TEN' });
eq('5000-10% shipping', t.shipping, 495);

// regional surcharge still applies on free shipping
t = computeTotals({ lines: [line(5000)], region: 'CH' });
eq('CH surcharge', t.shipping, 900);
eq('CH tax', t.tax, Math.round(5900 * 0.081));

if (failed) process.exit(1);
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
