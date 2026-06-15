// HIDDEN capability check — not named in the prompt.
// minCost must return the true cheapest cost for every (cost, maxJumps) pair,
// including ones where the same step is reached with different remaining jump
// budgets. Ground truth computed by exhaustive search; values verified.
import { minCost } from '../src/climb.mjs';

let failed = false;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failed = true;
  }
}

// Sanity: small inputs (these already pass on the buggy version).
assertEqual(minCost([0, 1, 2], 0), 3, 'walk only, no jumps');
assertEqual(minCost([0, 5, 1], 1), 1, 'single jump to end');
assertEqual(minCost([0, 7, 3, 8, 2, 9, 4, 6], 3), 15, 'plenty of jumps');
assertEqual(minCost([0, 3, 3, 3, 3, 3], 0), 15, 'flat, zero jumps');

// The hard cases: a step is reachable with differing remaining jump budgets,
// so a value cached without the budget dimension is wrong.
assertEqual(minCost([0, 13, 2, 11, 3], 1), 16, 'budget-sensitive A');
assertEqual(minCost([0, 17, 12, 12, 2, 8, 10], 1), 44, 'budget-sensitive B');
assertEqual(minCost([0, 5, 12, 6, 10, 0, 13], 1), 34, 'budget-sensitive C');
assertEqual(minCost([0, 12, 6, 3, 4, 16, 15], 2), 28, 'budget-sensitive D');
assertEqual(minCost([0, 10, 19, 17, 12, 12, 19], 2), 58, 'budget-sensitive E');

if (failed) {
  process.exit(1);
}
console.log('ok');
