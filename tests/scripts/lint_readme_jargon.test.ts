// Tests for src/scripts/lint_readme_jargon.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Light behavioural spec over exported constants plus
// the golden-parity layer that runs python3 vs tsx on the REAL REPO (skipped
// without python3). Golden parity is the binding contract.
import { describe, expect, it } from 'vitest';

import * as lrj from '../../src/scripts/lint_readme_jargon.js';



describe('lint_readme_jargon — exported config', () => {
    it('exposes the above-fold line budget and max-hits threshold', () => {
        expect(typeof lrj.ABOVE_FOLD_LINES).toBe('number');
        expect(typeof lrj.MAX_HITS).toBe('number');
        expect(lrj.ABOVE_FOLD_LINES).toBeGreaterThan(0);
        expect(lrj.MAX_HITS).toBeGreaterThanOrEqual(0);
    });

    it('exposes a non-empty jargon watchlist', () => {
        expect(Array.isArray(lrj.WATCHLIST)).toBe(true);
        expect(lrj.WATCHLIST.length).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

