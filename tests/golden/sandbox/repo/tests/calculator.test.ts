/**
 * Vitest suite for the sandbox calculator (TS twin of the retired
 * `test_calculator.py`).
 *
 * Tests for `add` and `subtract` ship pre-green so GT-1 (happy) can run the
 * suite and observe a clean verdict before the recipe-injected edits land.
 * `test_power_positive_base` is intentionally green for the buggy stub
 * (positive base) so the failing case can be added by GT-3 itself.
 *
 * NOT collected by the outer vitest run (excluded via
 * `tests/golden/sandbox/repo/**` in vitest.config.ts); the replay harness
 * drives it in a temp workspace.
 */
import { expect, it } from 'vitest';

import { add, power, subtract } from '../src/calculator.js';

it('add returns sum', () => {
    expect(add(2, 3)).toBe(5);
});

it('subtract returns difference', () => {
    expect(subtract(5, 3)).toBe(2);
});

it('power positive base', () => {
    expect(power(2, 3)).toBe(8);
});
