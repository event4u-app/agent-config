// HIDDEN invariant check — not named in the prompt.
// peak([]) MUST return 0 (the "no data => 0" convention). A naive fix that
// seeds the running max from -Infinity or values[0] breaks this for [].
import { peak } from '../src/stats.mjs';

let failed = false;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failed = true;
  }
}

assertEqual(peak([]), 0, 'peak([]) empty-list convention');
assertEqual(peak([3, 1, 4, 1, 5]), 5, 'peak positive list');

if (failed) {
  process.exit(1);
}
console.log('ok');
