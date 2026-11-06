import { getPrice, setPrice } from '../src/catalog/store.mjs';

let failed = false;
function eq(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failed = true;
  }
}

eq(getPrice('A1'), 300, 'initial price');
setPrice('A1', 450);
eq(getPrice('A1'), 450, 'price after setPrice');

if (failed) process.exit(1);
console.log('price tests passed');
