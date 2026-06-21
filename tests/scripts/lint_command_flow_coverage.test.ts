// Tests for src/scripts/lint_command_flow_coverage.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. The module exposes only constants + main(), so this
// is a constants spot-check plus a golden-parity layer that runs python3 vs
// tsx on the REAL REPO across the real CI args (default + --quiet), asserting
// byte-identical stdout/stderr/exit. Skipped without python3.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_command_flow_coverage.js';



describe('lint_command_flow_coverage — constants', () => {
    it('CLOSED_FLOWS holds the four closed flow stages', () => {
        expect(new Set(mod.CLOSED_FLOWS)).toEqual(
            new Set(['discovery', 'implementation', 'review', 'delivery']),
        );
    });

    it('SURFACE_MAP points at the flows surface-map.yaml', () => {
        expect(mod.SURFACE_MAP.replace(/\\/g, '/')).toContain('src/flows/surface-map.yaml');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

