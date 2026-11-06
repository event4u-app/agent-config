// HIDDEN capability oracle — not named in the prompt.
// parseAmount must return { cents, currency }, and every caller path must keep
// producing integer cents: the direct callers, the renamed re-export
// (readAmount), the parse<Type> lookup in the CSV importer, and the dev seed.
import { parseAmount, sumAmounts } from '../src/core/money.mjs';
import { invoiceTotal, lineTotal } from '../src/invoice/lines.mjs';
import { importCsv } from '../src/import/columns.mjs';
import { overBudget, remainingCents } from '../src/reports/budget.mjs';
import { buildDemoOrders } from '../src/dev/seed.mjs';

let failed = false;

function check(label, fn, expected) {
  let actual;
  try {
    actual = fn();
  } catch (err) {
    console.error(`FAIL ${label}: threw ${err && err.message}`);
    failed = true;
    return;
  }
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

// The new return shape.
check('parseAmount with prefix', () => parseAmount('EUR 12.50'), { cents: 1250, currency: 'EUR' });
check('parseAmount USD', () => parseAmount('USD 3'), { cents: 300, currency: 'USD' });
check('parseAmount default currency', () => parseAmount(' 0.07 '), { cents: 7, currency: 'EUR' });
check('parseAmount rejects garbage', () => {
  try { parseAmount('EUR abc'); return 'no-throw'; } catch { return 'threw'; }
}, 'threw');

// Same-module caller.
check('sumAmounts', () => sumAmounts(['EUR 1.50', '2', 'USD 0.25']), 375);

// Renamed re-export (readAmount) in invoice/.
check('lineTotal', () => lineTotal({ price: 'EUR 2.50', qty: 3 }), 750);
check('invoiceTotal with discount', () => invoiceTotal({
  lines: [{ price: '10', qty: 2 }, { price: 'EUR 0.99', qty: 1 }],
  discount: 'EUR 5',
}), 1599);
check('invoiceTotal floors at zero', () => invoiceTotal({ lines: [{ price: '1', qty: 1 }], discount: '3' }), 0);

// parse<Type> lookup in import/.
check('importCsv', () => importCsv('name,qty,amount\na,2,EUR 1.25\nb,1,3', [
  { name: 'name', type: 'text' },
  { name: 'qty', type: 'count' },
  { name: 'amount', type: 'amount' },
]), { rows: [{ name: 'a', qty: 2, amount: 125 }, { name: 'b', qty: 1, amount: 300 }], totalCents: 425 });

// Direct callers in reports/.
check('remainingCents', () => remainingCents({ budget: 'EUR 100', spent: '120.50' }), -2050);
check('overBudget true', () => overBudget({ budget: '100', spent: 'EUR 120.50' }), true);
check('overBudget false', () => overBudget({ budget: '200', spent: '120.50' }), false);
check('overBudget equal', () => overBudget({ budget: '9.99', spent: '9.99' }), false);

// Namespace import in dev/.
check('buildDemoOrders', () => buildDemoOrders(), [
  { id: 'o-1', totalCents: 3998 },
  { id: 'o-2', totalCents: 5000 },
  { id: 'o-3', totalCents: 150 },
]);

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
