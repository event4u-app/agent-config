// HIDDEN capability oracle — not named in the prompt.
// The returned parts always SUM to total (the buggy version does too), so the
// sum is not the discriminator. These cases pin down WHICH buckets receive the
// leftover units: they must go to the LARGEST fractional remainders, lower
// index breaking ties. Cases with distinct remainders catch a reversed
// ranking; the equal-remainder (tie) cases catch a fix that also wrecks the
// lower-index tie-break.
import { apportion } from '../src/apportion.mjs';

let failed = false;

function assertArray(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

// Distinct fractional remainders — leftover must land on the largest ones.
assertArray(apportion(10, [1, 2, 4]), [1, 3, 6], 'distinct remainders, 2 leftover');
assertArray(apportion(13, [2, 3, 5]), [3, 4, 6], 'distinct remainders, mixed');
assertArray(apportion(100, [7, 11, 13, 19]), [14, 22, 26, 38], 'four buckets distinct');

// Equal remainders (ties) — lower index must win; sum stays exact.
assertArray(apportion(100, [1, 1, 1]), [34, 33, 33], 'tie: +1 to index 0');
assertArray(apportion(7, [1, 1, 1]), [3, 2, 2], 'tie: 1 leftover to index 0');
assertArray(apportion(11, [1, 1, 1]), [4, 4, 3], 'tie: 2 leftover to indices 0,1');
assertArray(apportion(5, [1, 1, 1, 1]), [2, 1, 1, 1], 'tie: 1 leftover, 4 buckets');

// Degenerate inputs.
assertArray(apportion(10, [0, 0, 0]), [0, 0, 0], 'zero weights');
assertArray(apportion(1, [3, 1, 1]), [1, 0, 0], 'single unit to dominant weight');

// Every result must sum to total (except the all-zero-weight contract case).
for (const [t, w, expectSum] of [
  [10, [1, 2, 4], 10],
  [13, [2, 3, 5], 13],
  [100, [7, 11, 13, 19], 100],
  [11, [1, 1, 1], 11],
]) {
  const s = apportion(t, w).reduce((acc, n) => acc + n, 0);
  if (s !== expectSum) {
    console.error(`FAIL sum invariant ${JSON.stringify([t, w])}: expected ${expectSum}, got ${s}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log('ok');
