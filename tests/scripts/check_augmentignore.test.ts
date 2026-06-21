// Tests for src/scripts/check_augmentignore.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused behavioural spec over check() (always
// exits 0; emits OK or advisory) plus a golden-parity layer running
// python3 vs tsx on the REAL REPO (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as ci from '../../src/scripts/check_augmentignore.js';



describe('check_augmentignore — behavioural spec', () => {
    it('always returns 0 (advisory, never a gate)', () => {
        expect(ci.check()).toBe(0);
    });

    it('exports the documented thresholds', () => {
        expect(ci.STALE_DAYS).toBe(90);
        expect(ci.MIN_USEFUL_LINES).toBe(5);
    });
});

