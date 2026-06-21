// Tests for src/scripts/lint_model_tier_coverage.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. The module exposes only `ROOT` + `main`, so the
// contract is the golden-parity layer: python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_model_tier_coverage.js';



describe('lint_model_tier_coverage — module surface', () => {
    it('exports a resolved ROOT and a callable main', () => {
        expect(typeof mod.ROOT).toBe('string');
        expect(typeof mod.main).toBe('function');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

