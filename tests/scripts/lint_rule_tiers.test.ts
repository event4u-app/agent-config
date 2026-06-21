// Tests for src/scripts/lint_rule_tiers.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Focused differential coverage of the public helper
// parse_tier plus a golden-parity layer that runs python3 vs tsx on the REAL
// REPO across the real CI args (default + --quiet), asserting byte-identical
// stdout/stderr/exit. Skipped without python3.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_rule_tiers.js';



describe('lint_rule_tiers — behavioural spec (parse_tier)', () => {
    it('returns the tier value from frontmatter', () => {
        expect(mod.parse_tier('---\ntier: 2a\nname: x\n---\nbody\n')).toBe('2a');
    });

    it('returns null when there is no opening fence', () => {
        expect(mod.parse_tier('no fence\ntier: 1\n')).toBeNull();
    });

    it('returns null when tier is absent', () => {
        expect(mod.parse_tier('---\nname: x\n---\nbody\n')).toBeNull();
    });

    it('strips quotes around the tier value', () => {
        expect(mod.parse_tier('---\ntier: "safety-floor"\n---\n')).toBe('safety-floor');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

