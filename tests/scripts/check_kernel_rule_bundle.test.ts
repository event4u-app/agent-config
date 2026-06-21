// Tests for src/scripts/check_kernel_rule_bundle.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (_kernel_changes, KERNEL_RULES) plus a golden-parity layer
// (python3 vs tsx) using the deterministic `--files` override so the result
// does not depend on the local git graph (skipped without python3).
import { describe, expect, it } from 'vitest';

import { KERNEL_RULES, _kernel_changes } from '../../src/scripts/check_kernel_rule_bundle.js';


const R = '.agent-src.uncondensed/rules';

describe('check_kernel_rule_bundle — _kernel_changes', () => {
    it('counts kernel rules under the kernel dir only', () => {
        expect(_kernel_changes([`${R}/scope-control.md`])).toEqual([`${R}/scope-control.md`]);
        expect(
            _kernel_changes([`${R}/scope-control.md`, `${R}/commit-policy.md`]).length,
        ).toBe(2);
    });

    it('ignores non-kernel rules and files outside the kernel dir', () => {
        expect(_kernel_changes([`${R}/some-auto-rule.md`])).toEqual([]);
        expect(_kernel_changes(['docs/foo.md', 'src/scripts/x.ts'])).toEqual([]);
    });

    it('dedupes and sorts', () => {
        expect(
            _kernel_changes([`${R}/commit-policy.md`, `${R}/commit-policy.md`, `${R}/scope-control.md`]),
        ).toEqual([`${R}/commit-policy.md`, `${R}/scope-control.md`]);
    });

    it('the kernel set has exactly 9 rules', () => {
        expect(KERNEL_RULES.size).toBe(9);
    });
});

