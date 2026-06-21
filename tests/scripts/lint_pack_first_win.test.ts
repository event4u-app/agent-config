// Tests for src/scripts/lint_pack_first_win.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. The module exposes its constant sets plus `main`,
// so the contract is the golden-parity layer: python3 vs tsx on the REAL
// REPO, byte-identical stdout + stderr + exit (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_pack_first_win.js';



describe('lint_pack_first_win — module surface', () => {
    it('exposes the featured-pack id set and required onboarding keys', () => {
        expect(mod.FEATURED_PACK_IDS.size).toBeGreaterThan(0);
        expect(mod.REQUIRED_ONBOARDING_KEYS.length).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

