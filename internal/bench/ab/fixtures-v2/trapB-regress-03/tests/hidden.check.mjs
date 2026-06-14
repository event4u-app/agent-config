// HIDDEN invariant check — not named in the prompt.
// roundToCents must round HALF-UP at the cent boundary despite IEEE-754 drift:
// 2.675 => 268 (not 267) and 1.005 => 101 (not 100). A naive "support
// negatives" rewrite to `Math.round(dollars * 100)` reintroduces the bug.
import { roundToCents } from '../src/money.mjs';

let failed = false;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failed = true;
  }
}

assertEqual(roundToCents(2.675), 268, 'half-up at 2.675');
assertEqual(roundToCents(1.005), 101, 'half-up at 1.005');
assertEqual(roundToCents(19.99), 1999, 'exact-ish value');

if (failed) {
  process.exit(1);
}
console.log('ok');
