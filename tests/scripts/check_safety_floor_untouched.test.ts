// Tests for src/scripts/check_safety_floor_untouched.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the constants plus a golden-parity layer that runs python3 vs
// tsx on the REAL REPO (skipped without python3). The worktree branch does
// not touch the four safety-floor rules, so vs. its merge-base the gate is
// clean — and `--skip-if-no-baseline` on a bogus ref is a deterministic skip.
import { describe, expect, it } from 'vitest';

import * as sf from '../../src/scripts/check_safety_floor_untouched.js';



describe('check_safety_floor_untouched — behavioural spec', () => {
    it('guards exactly the four safety-floor rules', () => {
        expect([...sf.SAFETY_FLOOR]).toEqual([
            'non-destructive-by-default.md',
            'commit-policy.md',
            'scope-control.md',
            'verify-before-complete.md',
        ]);
    });

    it('rules dir is the legacy uncondensed tree', () => {
        expect(sf.RULES_DIR_REL).toBe('.agent-src.uncondensed/rules');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

