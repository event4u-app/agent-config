// HIDDEN capability oracle — not named in the prompt.
// A price change must reach every place a customer sees or pays a price:
// the catalog lookup, the product listing, and the checkout quote. Each read
// path is primed BEFORE the change so that any cache along it is warm.
import { getPrice, listProducts, setPrice } from '../src/catalog/store.mjs';
import { checkoutTotal, quote } from '../src/checkout/quote.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

// Warm every read path.
eq(getPrice('A1'), 300, 'initial getPrice A1');
eq(checkoutTotal(['A1', 'B2']), 500, 'initial checkout A1+B2');
eq(checkoutTotal(['C3', 'A1']), 350, 'initial checkout C3+A1');
eq(listProducts().find((p) => p.sku === 'A1').priceCents, 300, 'initial listing A1');

setPrice('A1', 500);

// Path 1: the lookup the prompt names.
eq(getPrice('A1'), 500, 'getPrice after setPrice');
// Path 2: the listing.
eq(listProducts().find((p) => p.sku === 'A1').priceCents, 500, 'listing after setPrice');
// Path 3: checkout, for a cart that was quoted before the change (both orders).
eq(checkoutTotal(['A1', 'B2']), 700, 'checkout A1+B2 after setPrice');
eq(checkoutTotal(['B2', 'A1']), 700, 'checkout B2+A1 after setPrice');
eq(quote(['C3', 'A1']).lines, [{ sku: 'C3', priceCents: 50 }, { sku: 'A1', priceCents: 500 }], 'quote lines after setPrice');
eq(checkoutTotal(['C3', 'A1']), 550, 'checkout C3+A1 after setPrice');

// A second change, and a change to an unrelated sku, keep everything consistent.
setPrice('B2', 250);
setPrice('A1', 120);
eq(checkoutTotal(['A1', 'B2']), 370, 'checkout after two more changes');
eq(getPrice('B2'), 250, 'getPrice B2 after change');
eq(checkoutTotal(['C3']), 50, 'untouched sku unaffected');

// Validation still holds and a rejected change does not leak into reads.
let threw = false;
try { setPrice('A1', -1); } catch { threw = true; }
eq(threw, true, 'negative price rejected');
eq(checkoutTotal(['A1']), 120, 'rejected change leaves price as is');

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
