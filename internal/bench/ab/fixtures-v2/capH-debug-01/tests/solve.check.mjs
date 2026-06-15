// HIDDEN capability oracle — not named in the prompt.
// Verifies countBelow is a true lower_bound (count of elements STRICTLY below
// target) and that countEqual is exact, across duplicate-heavy and boundary
// cases. A plausible-but-wrong fix that only patches countEqual (e.g. flips
// the subtraction or adds a constant) fails the countBelow assertions; an
// upper-bound implementation fails the duplicate cases.
import { countBelow, countEqual } from '../src/window.mjs';

let failed = false;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failed = true;
  }
}

// --- countBelow: strict lower bound (insertion point of target) ---
assertEqual(countBelow([1, 3, 3, 5], 3), 1, 'countBelow target present (dup)');
assertEqual(countBelow([1, 3, 3, 5], 4), 3, 'countBelow target absent mid');
assertEqual(countBelow([1, 3, 3, 5], 0), 0, 'countBelow below all');
assertEqual(countBelow([1, 3, 3, 5], 9), 4, 'countBelow above all');
assertEqual(countBelow([1, 3, 3, 5], 1), 0, 'countBelow at first element');
assertEqual(countBelow([1, 3, 3, 5], 5), 3, 'countBelow at last element');
assertEqual(countBelow([2, 2, 2, 2], 2), 0, 'countBelow all-equal present');
assertEqual(countBelow([2, 2, 2, 2], 3), 4, 'countBelow all-equal above');
assertEqual(countBelow([], 1), 0, 'countBelow empty');
assertEqual(countBelow([7], 7), 0, 'countBelow singleton equal');
assertEqual(countBelow([7], 8), 1, 'countBelow singleton above');

// --- countEqual: exact multiplicity ---
assertEqual(countEqual([1, 3, 3, 3, 5], 3), 3, 'countEqual run of 3');
assertEqual(countEqual([1, 3, 3, 3, 5], 4), 0, 'countEqual absent');
assertEqual(countEqual([2, 2], 2), 2, 'countEqual pair');
assertEqual(countEqual([1, 2, 3, 4, 5], 5), 1, 'countEqual last unique');
assertEqual(countEqual([1, 2, 3, 4, 5], 1), 1, 'countEqual first unique');
assertEqual(countEqual([5, 5, 5, 5, 5], 5), 5, 'countEqual all-equal');
assertEqual(countEqual([], 1), 0, 'countEqual empty');

if (failed) {
  process.exit(1);
}
console.log('ok');
